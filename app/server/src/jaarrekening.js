// Fase B van de holding: concept-jaarrekening en VpB-berekening, beide
// afgeleid uit het journaal. Geen verklaring: een concept voor de
// bestuurder, die de jaarrekening opmaakt en als enig aandeelhouder vaststelt.
import { pool } from './db.js';
import { controles, rapport } from './administratie.js';

const q = (sql, p = []) => pool.query(sql, p).then((r) => r.rows);
const cent = (n) => Math.round(Number(n) * 100);
const euro = (c) => c / 100;
const som = (lijst, k = 'bedrag') => euro(lijst.reduce((s, r) => s + cent(r[k]), 0));

// Indeling naar jaarrekeningposten. De rekening-courant DGA staat aan de
// kant die het saldo aangeeft.
const ACTIVA = [
  ['Financiële vaste activa', ['Financiële vaste activa']],
  ['Vorderingen', ['Vorderingen', 'Vorderingen / schulden DGA']],
  ['Liquide middelen', ['Liquide middelen']],
];
const PASSIVA = [
  ['Eigen vermogen', ['Eigen vermogen']],
  ['Langlopende schulden', ['Langlopende schulden']],
  ['Kortlopende schulden', ['Kortlopende schulden', 'Vorderingen / schulden DGA']],
];
const WV = [
  ['Netto-omzet', ['Omzet'], 1],
  ['Overige bedrijfskosten', ['Algemene kosten'], -1],
  ['Financiële baten', ['Financiële baten'], 1],
  ['Financiële lasten', ['Financiële lasten'], -1],
];

function groepeer(regels, indeling) {
  return indeling
    .map(([post, categorieen]) => {
      const eigen = regels.filter((r) => categorieen.includes(r.categorie));
      return { post, regels: eigen, totaal: som(eigen) };
    })
    .filter((g) => g.regels.length);
}

export async function jaarrekening({ boekjaar_id, alleen_definitief } = {}) {
  const r = await rapport({ boekjaar_id, alleen_definitief });
  const bj = r.boekjaar;
  // Rapport rekent tot de peildatum; de jaarrekening gaat over het hele boekjaar.
  const activa = groepeer(r.activa, ACTIVA);
  const passiva = groepeer(r.passiva, PASSIVA);
  const vpbRegels = r.resultaat.filter((x) => x.categorie === 'Belastingen');
  const wv = WV.map(([post, categorieen, teken]) => {
    const eigen = r.resultaat.filter((x) => categorieen.includes(x.categorie)).map((x) => ({ ...x, bedrag: x.bedrag * teken }));
    return { post, teken, regels: eigen, totaal: som(eigen) };
  }).filter((g) => g.regels.length);
  const voorBelasting = euro(wv.reduce((s, g) => s + g.teken * cent(g.totaal), 0));
  const vpb = -som(vpbRegels);

  const nogTeDoen = (await controles()).meldingen.filter((m) => m.niveau !== 'info');
  const dagen = Math.round((Date.parse(bj.eind) - Date.parse(bj.start)) / 864e5) + 1;
  return {
    boekjaar: bj,
    dagen,
    verlengd: dagen > 366,
    concept: r.concept,
    alleen_definitief: r.alleen_definitief,
    balans: { activa, passiva, totaal_activa: r.totaal_activa, totaal_passiva: r.totaal_passiva },
    wv,
    resultaat_voor_belasting: voorBelasting,
    vpb_geboekt: vpb,
    resultaat_na_belasting: euro(cent(voorBelasting) - cent(vpb)),
    nog_te_doen: nogTeDoen,
  };
}

// VpB-berekening over het boekjaar. De deelnemingsvrijstelling is open
// (V-F19): de berekening laat beide uitkomsten zien.
export async function vpb({ boekjaar_id, alleen_definitief } = {}) {
  const jr = await jaarrekening({ boekjaar_id, alleen_definitief });
  const inst = Object.fromEntries((await q('SELECT sleutel, waarde FROM instelling')).map((i) => [i.sleutel, Number(i.waarde)]));
  const laag = inst.vpb_tarief_laag;
  const hoog = inst.vpb_tarief_hoog;
  const grens = inst.vpb_schijfgrens;
  const ontbreekt = [laag, hoog, grens].some((x) => !Number.isFinite(x));

  // Opbrengsten uit de certificaten (dividend) vallen onder de
  // deelnemingsvrijstelling als die van toepassing is (art. 13 Wet VpB 1969).
  const [{ dividend }] = await q(
    `SELECT coalesce(sum(r.credit - r.debet), 0) AS dividend
     FROM journaalregel r JOIN journaalpost p ON p.id = r.post_id JOIN grootboekrekening g ON g.id = r.rekening_id
     WHERE g.functie = 'dividendbaten' AND p.datum BETWEEN $1 AND $2 AND (NOT $3 OR p.status = 'definitief')`,
    [jr.boekjaar.start, jr.boekjaar.eind, alleen_definitief === 'true'],
  );

  const bereken = (metDv) => {
    const correcties = [];
    if (metDv && Number(dividend)) {
      correcties.push({ omschrijving: 'Deelnemingsvrijstelling: dividend uit de certificaten', bedrag: -Number(dividend), grond: 'art. 13 Wet VpB 1969' });
    }
    const belastbaar = euro(cent(jr.resultaat_voor_belasting) + correcties.reduce((s, c) => s + cent(c.bedrag), 0));
    const winst = Math.max(0, belastbaar);
    const vpbBedrag = ontbreekt ? null : Math.min(winst, grens) * (laag / 100) + Math.max(0, winst - grens) * (hoog / 100);
    return {
      met_deelnemingsvrijstelling: metDv,
      correcties,
      belastbaar_bedrag: belastbaar,
      verlies: belastbaar < 0 ? -belastbaar : 0,
      vpb: vpbBedrag == null ? null : Math.round(vpbBedrag * 100) / 100,
    };
  };

  return {
    boekjaar: jr.boekjaar,
    dagen: jr.dagen,
    verlengd: jr.verlengd,
    concept: jr.concept,
    resultaat_voor_belasting: jr.resultaat_voor_belasting,
    vpb_geboekt: jr.vpb_geboekt,
    tarief: { laag, hoog, grens },
    varianten: [bereken(false), bereken(true)],
    dividend_certificaten: Number(dividend),
    nog_te_doen: jr.nog_te_doen,
  };
}
