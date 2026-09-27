// Administratie privé A. Dreves: alleen het vermogen dat in dit dossier zit en
// de fiscale posities die daarbij horen. Geen volledige aangifte IB: of die
// binnen de opdracht valt, is open (V-F28). Andere privébezittingen (woning,
// spaargeld) staan hier niet in.
import { rapport } from './administratie.js';
import { DIVIDENDTARIEF, schuldOp, schuldverloop } from './rekenen.js';
import { factorenVoor, laad, leningVoor, planUitQuery, privepositie, rekenAantal, waarderingVoor } from './verra.js';

const vandaag = () => new Date().toISOString().slice(0, 10);
const jaarVan = (s) => Number(s.slice(0, 4));

// Eigen vermogen van de holding volgens haar administratie: een indicatie van
// de waarde van de aandelen, niet de waarde in het economisch verkeer (de
// certificaten staan daarin tegen kostprijs).
async function eigenVermogenHolding(peildatum) {
  try {
    const r = await rapport({ peildatum });
    if (peildatum < r.boekjaar.start) return null;
    const ev = r.passiva.filter((x) => x.categorie === 'Eigen vermogen').reduce((s, x) => s + x.bedrag, 0);
    return { bedrag: ev, concept: r.concept, peildatum: r.peildatum };
  } catch {
    return null;
  }
}

export async function vermogen(query = {}) {
  const peildatum = /^\d{4}-\d{2}-\d{2}$/.test(query.peildatum ?? '') ? query.peildatum : vandaag();
  const d = await laad();
  const p = privepositie(d);
  const { lening, aflossingen } = leningVoor(d, p);
  const aantal = rekenAantal(p);
  const factoren = factorenVoor(d, p);
  const reeks = factoren.map((f) => ({ f, w: waarderingVoor(d, p, f) }));
  const plan = planUitQuery(query, d, p);
  const box2Vanaf = plan.box2_vanaf;
  const boxIn = (j) => (box2Vanaf != null && j >= box2Vanaf ? 2 : 3);
  const holdingEntiteit = Object.entries(d.code).find(([, c]) => c === 'holding')?.[0];

  // Waarde van de certificaten op een datum: de prijs die in dat jaar geldt
  // (A12); vóór de verkrijging hoort de positie nog niet tot het vermogen.
  const certificaten = (datum) =>
    datum < p.verkregen_op ? null : reeks.map(({ f, w }) => ({ factor: f, waarde: w(jaarVan(datum)).waarde }));

  // Vermogen op de peildatum.
  const cert = certificaten(peildatum);
  const schuld = lening ? schuldOp(lening, aflossingen, peildatum) : null;
  const ev = await eigenVermogenHolding(peildatum);
  const box = boxIn(jaarVan(peildatum));
  const bestanddelen = [
    {
      omschrijving: `Certificaten Verra Aan- en Verkoop Den Haag B.V. (${String(aantal).replace('.', ',')} aandelen)`,
      soort: 'bezitting',
      box,
      waarden: cert,
      toelichting: `inleg € 17.100 (F12); waarde volgens de waardering die in ${jaarVan(peildatum)} geldt`,
    },
    lening && {
      omschrijving: lening.omschrijving,
      soort: 'schuld',
      box,
      waarden: [{ factor: null, waarde: -schuld.totaal }],
      toelichting: `hoofdsom € 17.100 na aflossingen, plus bijgeschreven rente (${lening.bron}); volgt de box van de certificaten`,
    },
    holdingEntiteit && ev && {
      omschrijving: 'Aandelen Dreves Holding B.V. (100%)',
      soort: 'bezitting',
      box: 2,
      waarden: [{ factor: null, waarde: ev.bedrag }],
      toelichting: `aanmerkelijk belang (art. 4.6 Wet IB 2001); indicatie = eigen vermogen volgens de administratie per ${ev.peildatum}${ev.concept ? ', inclusief conceptboekingen' : ''}; verkrijgingsprijs € 100 (geplaatst kapitaal)`,
    },
  ].filter(Boolean);
  const som = (sel) => bestanddelen.reduce((s, b) => s + sel(b), 0);
  const netto = {
    min: som((b) => Math.min(...(b.waarden ?? [{ waarde: 0 }]).map((w) => w.waarde))),
    max: som((b) => Math.max(...(b.waarden ?? [{ waarde: 0 }]).map((w) => w.waarde))),
  };

  // Fiscaal per kalenderjaar: box, stand op de peildatum 1 januari (box 3),
  // dividend en dividendbelasting (voorheffing), rente op de lening.
  const verloop = lening ? schuldverloop(lening, aflossingen, { vandaag: vandaag() }) : [];
  const eerste = jaarVan(lening?.startdatum ?? p.verkregen_op) + 1;
  const jaren = [];
  for (let j = eerste; j <= jaarVan(vandaag()); j++) {
    const eenJan = `${j}-01-01`;
    const div = d.dividenden.filter((x) => x.positie_id === p.id && jaarVan(x.datum) === j);
    const holding1jan = holdingEntiteit ? await eigenVermogenHolding(eenJan) : null;
    const b = boxIn(j);
    jaren.push({
      jaar: j,
      box: b,
      peildatum: eenJan,
      certificaten: certificaten(eenJan),
      schuld: lening && eenJan >= lening.startdatum ? schuldOp(lening, aflossingen, eenJan).totaal : null,
      holding: holding1jan?.bedrag ?? null,
      dividend_bruto: div.reduce((s, x) => s + x.bruto, 0),
      dividendbelasting: div.reduce((s, x) => s + x.dividendbelasting, 0),
      box2_over_dividend: b === 2 ? div.reduce((s, x) => s + x.bruto, 0) * (DIVIDENDTARIEF.box2 / 100) : 0,
      rente: verloop.filter((r) => jaarVan(r.eind) === j).reduce((s, r) => s + r.rente, 0),
      rente_prognose: verloop.some((r) => jaarVan(r.eind) === j && r.prognose),
      aflossing: aflossingen.filter((a) => jaarVan(a.datum) === j).reduce((s, a) => s + a.bedrag, 0),
    });
  }

  return {
    peildatum,
    box2_vanaf: box2Vanaf,
    bestanddelen,
    netto,
    jaren,
    box2_tarief: DIVIDENDTARIEF.box2,
    verkrijgingsprijzen: [
      { omschrijving: 'Certificaten Verra A&V', bedrag: p.inleg, toelichting: 'inleg (F12); in box 2 mogelijk de waarde bij ontstaan van het aanmerkelijk belang (V-F49)' },
      holdingEntiteit && { omschrijving: 'Aandelen Dreves Holding B.V.', bedrag: 100, toelichting: 'geplaatst kapitaal bij oprichting 23-12-2025' },
    ].filter(Boolean),
  };
}
