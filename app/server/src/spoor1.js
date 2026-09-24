import { pool } from './db.js';
import { Invoerfout } from './resources.js';
import {
  aflossingenVoor,
  boxIndicatie,
  breakEven,
  dividendToets,
  leaverPrijs,
  leaverRegel,
  plusJaren,
  schuldOp,
  schuldverloop,
  simulatie,
  jaaroverzicht,
  waardeReeks,
  volleJaren,
} from './rekenen.js';

const SPOOR = 1;
const vandaag = () => new Date().toISOString().slice(0, 10);

async function laad() {
  const q = (sql, p = []) => pool.query(sql, p).then((r) => r.rows);
  const [posities, leningen, dividenden, aflossingen, waarderingen, noemers, regels, instellingen, gebeurtenissen, entiteiten] =
    await Promise.all([
      q('SELECT * FROM certificaatpositie WHERE spoor = $1 ORDER BY id', [SPOOR]),
      q('SELECT * FROM lening WHERE spoor = $1 ORDER BY id', [SPOOR]),
      q('SELECT * FROM dividend ORDER BY datum'),
      q('SELECT * FROM aflossing ORDER BY datum'),
      q('SELECT * FROM waardering ORDER BY peildatum, id'),
      q('SELECT * FROM noemer ORDER BY aantal'),
      q('SELECT * FROM leaver_regel ORDER BY id'),
      q('SELECT * FROM instelling'),
      q('SELECT * FROM gebeurtenis WHERE spoor = $1 ORDER BY datum', [SPOOR]),
      q('SELECT id, naam FROM entiteit'),
    ]);
  const naam = Object.fromEntries(entiteiten.map((e) => [e.id, e.naam]));
  const instelling = Object.fromEntries(instellingen.map((i) => [i.sleutel, i.waarde]));
  return { posities, leningen, dividenden, aflossingen, waarderingen, noemers, regels, instelling, gebeurtenissen, naam };
}

// Meest recente peildatum telt; alle labels op die datum vormen de bandbreedte.
function actueleWaarderingen(waarderingen, vennootschapId, peildatum) {
  const eigen = waarderingen.filter((w) => w.vennootschap_id === vennootschapId && w.peildatum <= peildatum);
  const laatste = eigen.at(-1)?.peildatum;
  return eigen.filter((w) => w.peildatum === laatste);
}

function leningVoor(d, positie) {
  const lening = d.leningen.find((l) => l.positie_id === positie.id);
  if (!lening) return { lening: null, aflossingen: [] };
  return { lening, aflossingen: aflossingenVoor(lening, d.aflossingen) };
}

export async function overzicht(peildatum = vandaag()) {
  const d = await laad();
  const posities = d.posities.map((p) => {
    const { lening, aflossingen } = leningVoor(d, p);
    const schuld = lening ? schuldOp(lening, aflossingen, peildatum) : { saldo: 0, opgelopen_rente: 0, totaal: 0 };
    const waarderingen = actueleWaarderingen(d.waarderingen, p.vennootschap_id, peildatum);
    const noemers = d.noemers.filter((n) => n.vennootschap_id === p.vennootschap_id);
    // Rente over het lopende contractjaar (saldo zonder de nog niet bijgeschreven rente).
    const jaarrente = lening ? (schuld.saldo * lening.rente_pct) / 100 : 0;
    const matrix = waarderingen.map((w) => ({
      waardering: w,
      cellen: noemers.map((n) => {
        const waarde = (w.ondernemingswaarde / n.aantal) * p.aantal;
        return { noemer: n.aantal, per_certificaat: w.ondernemingswaarde / n.aantal, waarde, netto: waarde - schuld.totaal };
      }),
    }));
    const netto = matrix.flatMap((m) => m.cellen.map((c) => c.netto));
    const ontvangen = d.dividenden.filter((x) => x.positie_id === p.id && x.datum <= peildatum);
    const dividendTotaal = {
      bruto: ontvangen.reduce((s, x) => s + x.bruto, 0),
      netto: ontvangen.reduce((s, x) => s + x.netto, 0),
    };
    return {
      positie: { ...p, vennootschap: d.naam[p.vennootschap_id] },
      lening: lening && {
        ...lening,
        geldgever: d.naam[lening.geldgever_id],
        einddatum: plusJaren(lening.startdatum, lening.looptijd_jaren),
      },
      schuld,
      verloop: lening ? schuldverloop(lening, aflossingen, { vandaag: vandaag() }) : [],
      dividend_toets: lening
        ? dividendToets(lening, d.dividenden, d.aflossingen, Number(peildatum.slice(0, 4)))
        : null,
      aflossingen,
      dividend_totaal: dividendTotaal,
      noemers,
      matrix,
      netto_bandbreedte: netto.length ? { min: Math.min(...netto), max: Math.max(...netto) } : null,
      jaarrente,
      break_even: lening
        ? noemers.map((n) => breakEven(jaarrente, p.aantal, n.aantal, lening.aflossing_uit_dividend_pct))
        : [],
      box: noemers.map((n) => ({ noemer: n.aantal, label: n.label, ...boxIndicatie(p.aantal, n.aantal) })),
    };
  });
  return { peildatum, posities, gebeurtenissen: d.gebeurtenissen };
}

export async function leaver({ positie_id, vertrekdatum = vandaag(), categorie = 'good', extra_korting, ...plan }) {
  const d = await laad();
  const p = d.posities.find((x) => x.id === Number(positie_id)) ?? d.posities[0];
  if (!p) throw new Invoerfout('Geen positie in spoor 1');
  if (vertrekdatum < p.verkregen_op) throw new Invoerfout('Vertrekdatum ligt vóór de verkrijging');
  const jaar = volleJaren(p.verkregen_op, vertrekdatum) + 1;
  const regel = leaverRegel(
    d.regels.filter((r) => r.positie_id === p.id),
    categorie,
    jaar,
  );
  const korting = extra_korting === 'true' ? (d.instelling.leaver_extra_korting_pct ?? 0) : 0;
  const { lening, aflossingen } = leningVoor(d, p);
  // Met een aflosplan (uit de schuiven) volgt de toekomstige schuld dat plan.
  const metPlan = lening && vertrekdatum > vandaag() && ['extra_per_maand', 'eenmalig', 'dividend_totaal', 'beleid'].some((k) => k in plan);
  const schuld = !lening
    ? { totaal: 0 }
    : metPlan
      ? { totaal: simulatie(lening, aflossingen, planUitQuery(plan, d, p).opties).schuld(vertrekdatum), volgens_plan: true }
      : schuldOp(lening, aflossingen, vertrekdatum);
  const waarderingen = actueleWaarderingen(d.waarderingen, p.vennootschap_id, vertrekdatum);
  const noemers = d.noemers.filter((n) => n.vennootschap_id === p.vennootschap_id);
  const matrix = regel
    ? waarderingen.map((w) => ({
        waardering: w,
        cellen: noemers.map((n) => {
          const r = leaverPrijs({
            ondernemingswaarde: w.ondernemingswaarde,
            noemer: n.aantal,
            regel,
            extraKortingPct: korting,
            inlegPerCertificaat: p.inleg / p.aantal,
          });
          const opbrengst = r.prijs * p.aantal;
          return { noemer: n.aantal, ...r, opbrengst, netto: opbrengst - schuld.totaal };
        }),
      }))
    : [];
  return {
    positie: p,
    vertrekdatum,
    jaar,
    categorie,
    regel: regel ?? null,
    extra_korting_pct: korting,
    schuld,
    noemers,
    matrix,
  };
}

// Het aflosplan uit de query (schuiven en jaartabel in de tab Vertrek). Wordt
// gedeeld door de simulatie en de vertrekberekening, zodat beide op hetzelfde
// plan rekenen.
function planUitQuery(query, d, p) {
  const getal = (k, std = 0) => (query[k] === undefined || query[k] === '' ? std : Math.max(0, Number(query[k]) || 0));
  const noemers = d.noemers.filter((n) => n.vennootschap_id === p.vennootschap_id);
  const noemer = noemers.find((n) => n.aantal === Number(query.noemer)) ?? noemers.at(-1);
  const aandeel = noemer ? p.aantal / noemer.aantal : null;
  // Standaard dividend van de vennootschap: afgeleid van het laatst ontvangen
  // dividend, zodat het bruto bedrag voor de houder gelijk blijft.
  const laatste = d.dividenden.filter((x) => x.positie_id === p.id).at(-1);
  const standaardTotaal = laatste && aandeel ? laatste.bruto / aandeel : 0;
  const totaal = getal('dividend_totaal', standaardTotaal);
  const perJaar = {};
  for (const deel of String(query.dividenden ?? '').split(',')) {
    const [j, v] = deel.split(':');
    if (/^\d{4}$/.test(j) && v !== undefined && v !== '') perJaar[j] = Math.max(0, Number(v) || 0);
  }
  const huidigJaar = Number(vandaag().slice(0, 4));
  const ontvangenIn = new Set(d.dividenden.filter((x) => x.positie_id === p.id).map((x) => Number(x.datum.slice(0, 4))));
  // Lopend jaar: alleen een dividend als dat expliciet is opgegeven; jaren met
  // een ontvangen dividend krijgen er geen gepland dividend bij.
  const totaalVoor = (j) =>
    j in perJaar ? perJaar[j] : j <= huidigJaar || ontvangenIn.has(j) ? 0 : totaal;
  return {
    noemer: noemer?.aantal ?? null,
    aandeel,
    standaard_totaal: totaal,
    per_jaar: perJaar,
    totaalVoor,
    opties: {
      vanaf: vandaag(),
      extraPerMaand: getal('extra_per_maand'),
      eenmalig: getal('eenmalig'),
      rendementPct: getal('rendement_pct'),
      belastingPct: getal('belasting_pct', 15),
      beleid: query.beleid === 'netto' ? 'netto' : 'verplicht',
      dividendVoorJaar: (j) => (aandeel ? totaalVoor(j) * aandeel : 0),
    },
  };
}

// Aflossen of aanhouden: jouw keuze tegenover alleen de verplichte aflossing.
export async function simuleer(query) {
  const d = await laad();
  const p = d.posities[0];
  const { lening, aflossingen } = p ? leningVoor(d, p) : {};
  if (!lening) throw new Invoerfout('Geen lening in spoor 1');
  const plan = planUitQuery(query, d, p);
  const vanaf = plan.opties.vanaf;
  const keuze = simulatie(lening, aflossingen, plan.opties);
  const basis = simulatie(lening, aflossingen, { ...plan.opties, extraPerMaand: 0, eenmalig: 0, beleid: 'verplicht' });
  const einde = keuze.einde;
  let vertrek = /^\d{4}-\d{2}-\d{2}$/.test(query.vertrekdatum ?? '') ? query.vertrekdatum : einde;
  if (vertrek < vanaf) vertrek = vanaf;
  if (vertrek > einde) vertrek = einde;
  const opVertrek = (sim) => {
    const s = sim.schuld(vertrek);
    const k = sim.kas(vertrek);
    return { schuld: s, eigen_geld: k, netto: k - s };
  };

  // Jaaroverzicht: werkelijke dividenden tot vandaag, daarna het plan. De
  // waarde volgt per jaar de gekozen reeks waarderingen (factor), of de inleg.
  const eigen = d.waarderingen.filter((w) => w.vennootschap_id === p.vennootschap_id);
  const factoren = [...new Set(eigen.map((w) => w.factor).filter((f) => f != null))].sort((a, b) => a - b);
  const keuzeWaarde = String(query.waarde ?? '');
  const factor = keuzeWaarde === 'inleg' ? null : keuzeWaarde ? Number(keuzeWaarde) : factoren[0] ?? null;
  const groeiPct = Number(query.groei_pct) || 0;
  const waarde = factor == null
    ? () => ({ waarde: p.inleg, bron: 'inleg' })
    : waardeReeks({
        waarderingen: eigen.filter((w) => Number(w.factor) === factor),
        noemer: plan.noemer,
        aantal: p.aantal,
        inleg: p.inleg,
        groeiPct,
      });
  const historischeDividenden = d.dividenden
    .filter((x) => x.positie_id === p.id && x.datum < vanaf)
    .map((x) => ({ datum: x.datum, bruto: x.bruto, netto: x.netto, historie: true }));
  const jaren = jaaroverzicht(lening, {
    aflossingen: keuze.aflossingen,
    dividenden: [...historischeDividenden, ...keuze.dividenden],
    waarde,
    inleg: p.inleg,
    aandeel: plan.aandeel,
    vanJaar: Number(p.verkregen_op.slice(0, 4)),
    totJaar: Number(einde.slice(0, 4)),
  });

  const zonderFuncties = ({ schuld, kas, aflossingen: _a, dividenden: _d, ...rest }) => rest;
  return {
    vanaf,
    einde,
    vertrekdatum: vertrek,
    lening: { omschrijving: lening.omschrijving, rente_pct: lening.rente_pct, aflossing_pct: lening.aflossing_uit_dividend_pct, grondslag: lening.aflossing_grondslag },
    positie: { aantal: p.aantal, inleg: p.inleg },
    noemers: d.noemers.filter((n) => n.vennootschap_id === p.vennootschap_id).map((n) => ({ aantal: n.aantal, label: n.label })),
    factoren,
    plan: { noemer: plan.noemer, aandeel: plan.aandeel, standaard_totaal: plan.standaard_totaal, per_jaar: plan.per_jaar, waarde_basis: factor ?? 'inleg', groei_pct: groeiPct },
    schuld_nu: keuze.reeks[0].schuld,
    keuze: { ...zonderFuncties(keuze), bij_vertrek: opVertrek(keuze) },
    basis: { ...zonderFuncties(basis), bij_vertrek: opVertrek(basis) },
    jaren,
  };
}
