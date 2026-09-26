import { pool } from './db.js';
import { Invoerfout } from './resources.js';
import {
  aflossingenVoor,
  DIVIDENDTARIEF,
  dividendToets,
  leaverPrijs,
  leaverRegel,
  plusJaren,
  schuldOp,
  schuldverloop,
  simulatie,
  jaaroverzicht,
  waarderingPerJaar,
  volleJaren,
} from './rekenen.js';

const SPOOR = 1;
const vandaag = () => new Date().toISOString().slice(0, 10);

async function laad() {
  const q = (sql, p = []) => pool.query(sql, p).then((r) => r.rows);
  const [posities, leningen, dividenden, aflossingen, waarderingen, noemers, regels, instellingen, gebeurtenissen, entiteiten, jaarresultaten] =
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
      q('SELECT * FROM jaarresultaat ORDER BY boekjaar'),
    ]);
  const naam = Object.fromEntries(entiteiten.map((e) => [e.id, e.naam]));
  const instelling = Object.fromEntries(instellingen.map((i) => [i.sleutel, i.waarde]));
  return { posities, leningen, dividenden, aflossingen, waarderingen, noemers, regels, instelling, gebeurtenissen, naam, jaarresultaten };
}

// Rekenbasis: de noemer die als standaard is gemarkeerd (anders alle), en het
// aantal aandelen waarmee de positie meetelt (anders het aantal certificaten).
function noemersVoor(d, p, { alle = false } = {}) {
  const eigen = d.noemers.filter((n) => n.vennootschap_id === p.vennootschap_id);
  if (alle) return eigen;
  const standaard = eigen.filter((n) => n.standaard);
  return standaard.length ? standaard : eigen;
}
const rekenAantal = (p) => Number(p.aantal_rekenbasis ?? p.aantal);

// Factoren (×3, ×4) die in de stamdata voorkomen.
function factorenVoor(d, p) {
  const f = d.waarderingen.filter((w) => w.vennootschap_id === p.vennootschap_id && w.factor != null).map((w) => Number(w.factor));
  return [...new Set(f.length ? f : [3, 4])].sort((a, b) => a - b);
}

// Waardering per jaar voor één factor (null = inleg), volgens B-PRES dia 7.
function waarderingVoor(d, p, factor, { groeiPct = 0, noemer } = {}) {
  const n = noemer ?? noemersVoor(d, p).at(-1)?.aantal;
  const weging = [1, 2, 3].map((i) => Number(d.instelling[`waardering_weging_${i}`] ?? [3, 2, 1][i - 1]));
  return waarderingPerJaar({
    jaarresultaten: d.jaarresultaten.filter((r) => r.vennootschap_id === p.vennootschap_id),
    vastgesteld: d.waarderingen.filter((w) => w.vennootschap_id === p.vennootschap_id && w.geldig_in_jaar != null),
    factor, weging, noemer: n, aantal: rekenAantal(p), inleg: p.inleg, groeiPct,
    vanJaar: Number(p.verkregen_op.slice(0, 4)),
  });
}

// Per factor de waardering die in het jaar van de datum geldt, in de vorm die
// de schermen tonen (een 'waardering' per regel).
function geldendeWaarderingen(d, p, datum) {
  const jaar = Number(datum.slice(0, 4));
  return factorenVoor(d, p).map((f) => {
    const w = waarderingVoor(d, p, f)(jaar);
    return {
      id: `f${f}`,
      factor: f,
      label: w.soort === 'inleg' ? 'instapprijs' : `×${f}`,
      ondernemingswaarde: w.ondernemingswaarde,
      waarde: w.waarde,
      soort: w.soort,
      toelichting: `geldt in ${jaar}: ${w.bron}`,
    };
  });
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
    const waarderingen = geldendeWaarderingen(d, p, peildatum);
    const noemers = noemersVoor(d, p);
    const aantal = rekenAantal(p);
    const matrix = waarderingen.map((w) => ({
      waardering: w,
      cellen: noemers.map((n) => {
        const waarde = w.ondernemingswaarde == null ? p.inleg : (w.ondernemingswaarde / n.aantal) * aantal;
        return { noemer: n.aantal, per_certificaat: waarde / aantal, waarde, netto: waarde - schuld.totaal };
      }),
    }));
    const netto = matrix.flatMap((m) => m.cellen.map((c) => c.netto));
    const ontvangen = d.dividenden.filter((x) => x.positie_id === p.id && x.datum <= peildatum);
    const dividendTotaal = {
      bruto: ontvangen.reduce((s, x) => s + x.bruto, 0),
      netto: ontvangen.reduce((s, x) => s + x.netto, 0),
    };
    return {
      positie: { ...p, vennootschap: d.naam[p.vennootschap_id], aantal_rekenbasis: aantal },
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
      waarderingsverloop: (() => {
        const van = Number(p.verkregen_op.slice(0, 4));
        const tot = lening ? Number(plusJaren(lening.startdatum, lening.looptijd_jaren).slice(0, 4)) : van + 4;
        const res = new Map(d.jaarresultaten.filter((r) => r.vennootschap_id === p.vennootschap_id).map((r) => [Number(r.boekjaar), r]));
        const reeksen = factorenVoor(d, p).map((f) => ({ f, w: waarderingVoor(d, p, f) }));
        const rijen = [];
        for (let j = van; j <= tot; j++) {
          rijen.push({
            jaar: j,
            resultaten: [j - 3, j - 2, j - 1].map((x) => (res.has(x) ? { jaar: x, resultaat: res.get(x).resultaat, status: res.get(x).status } : { jaar: x, resultaat: null })),
            per_factor: reeksen.map(({ f, w }) => ({ factor: f, ...w(j) })),
          });
        }
        return rijen;
      })(),
    };
  });
  return { peildatum, posities, gebeurtenissen: d.gebeurtenissen };
}

export async function leaver({ positie_id, vertrekdatum = vandaag(), categorie = 'good', extra_korting, alle_noemers, ...plan }) {
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
  const waarderingen = geldendeWaarderingen(d, p, vertrekdatum);
  const toonAlle = alle_noemers === 'true';
  const noemers = noemersVoor(d, p, { alle: toonAlle });
  const rekenbasis = noemersVoor(d, p).at(-1)?.aantal ?? null;
  const aantal = rekenAantal(p);
  const matrix = regel
    ? waarderingen.map((w) => ({
        waardering: w,
        cellen: noemers.map((n) => {
          const r = leaverPrijs({
            ondernemingswaarde: w.ondernemingswaarde ?? (p.inleg / aantal) * n.aantal,
            noemer: n.aantal,
            regel,
            extraKortingPct: korting,
            inlegPerCertificaat: p.inleg / aantal,
          });
          const opbrengst = r.prijs * aantal;
          return { noemer: n.aantal, ...r, opbrengst, netto: opbrengst - schuld.totaal };
        }),
      }))
    : [];
  return {
    positie: { ...p, aantal_rekenbasis: aantal },
    vertrekdatum,
    jaar,
    categorie,
    regel: regel ?? null,
    extra_korting_pct: korting,
    schuld,
    noemers,
    rekenbasis,
    alle_noemers: toonAlle,
    matrix,
  };
}

// Het aflosplan uit de query (schuiven en jaartabel in de tab Vertrek). Wordt
// gedeeld door de simulatie en de vertrekberekening, zodat beide op hetzelfde
// plan rekenen.
function planUitQuery(query, d, p) {
  const getal = (k, std = 0) => (query[k] === undefined || query[k] === '' ? std : Math.max(0, Number(query[k]) || 0));
  const noemers = noemersVoor(d, p);
  const noemer = noemers.find((n) => n.aantal === Number(query.noemer)) ?? noemers.at(-1);
  const aandeel = noemer ? rekenAantal(p) / noemer.aantal : null;
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
  // Box 3 tot het aanmerkelijk belang ontstaat, box 2 vanaf dat jaar (A13).
  // 'nooit' = alle jaren box 3; standaard box 2 vanaf 2026.
  const box2Vanaf = query.box2_vanaf === 'nooit' ? null : /^\d{4}$/.test(query.box2_vanaf ?? '') ? Number(query.box2_vanaf) : 2026;
  const boxVoor = (j) => (box2Vanaf != null && j >= box2Vanaf ? 2 : 3);
  return {
    noemer: noemer?.aantal ?? null,
    aandeel,
    standaard_totaal: totaal,
    per_jaar: perJaar,
    box2_vanaf: box2Vanaf,
    totaalVoor,
    opties: {
      vanaf: vandaag(),
      extraPerMaand: getal('extra_per_maand'),
      eenmalig: getal('eenmalig'),
      rendementPct: getal('rendement_pct'),
      beleid: query.beleid === 'netto' ? 'netto' : 'verplicht',
      tariefVoorJaar: (j) => DIVIDENDTARIEF[`box${boxVoor(j)}`],
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
  const factoren = factorenVoor(d, p);
  const keuzeWaarde = String(query.waarde ?? '');
  const factor = keuzeWaarde === 'inleg' ? null : keuzeWaarde ? Number(keuzeWaarde) : factoren[0] ?? null;
  const groeiPct = Number(query.groei_pct) || 0;
  const reeks = waarderingVoor(d, p, factor, { groeiPct, noemer: plan.noemer });
  const waarde = (j) => {
    const w = reeks(j);
    return { waarde: w.waarde, bron: w.bron };
  };
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
    positie: { aantal: p.aantal, aantal_rekenbasis: rekenAantal(p), inleg: p.inleg },
    noemers: noemersVoor(d, p).map((n) => ({ aantal: n.aantal, label: n.label })),
    factoren,
    plan: { noemer: plan.noemer, aandeel: plan.aandeel, standaard_totaal: plan.standaard_totaal, per_jaar: plan.per_jaar, box2_vanaf: plan.box2_vanaf, waarde_basis: factor ?? 'inleg', groei_pct: groeiPct },
    schuld_nu: keuze.reeks[0].schuld,
    keuze: { ...zonderFuncties(keuze), bij_vertrek: opVertrek(keuze) },
    basis: { ...zonderFuncties(basis), bij_vertrek: opVertrek(basis) },
    jaren,
  };
}
