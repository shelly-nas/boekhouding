// Berekeningen zonder database-afhankelijkheid, zodat ze los te testen zijn.
// Datums zijn overal 'YYYY-MM-DD'-strings en worden als UTC behandeld.

const DAG = 86_400_000;

const naarDatum = (s) => new Date(`${s}T00:00:00Z`);
const naarString = (d) => d.toISOString().slice(0, 10);
const dagenTussen = (a, b) => Math.round((naarDatum(b) - naarDatum(a)) / DAG);

export function plusJaren(s, n) {
  const d = naarDatum(s);
  d.setUTCFullYear(d.getUTCFullYear() + n);
  return naarString(d);
}

// Aantal volle jaren tussen twee datums.
export function volleJaren(van, tot) {
  const a = naarDatum(van);
  const b = naarDatum(tot);
  let j = b.getUTCFullYear() - a.getUTCFullYear();
  const nogNietJarig =
    b.getUTCMonth() < a.getUTCMonth() ||
    (b.getUTCMonth() === a.getUTCMonth() && b.getUTCDate() < a.getUTCDate());
  return nogNietJarig ? j - 1 : j;
}

const dagenInJaar = (s) => {
  const j = naarDatum(s).getUTCFullYear();
  return dagenTussen(`${j}-01-01`, `${j + 1}-01-01`);
};
const minEenDag = (s) => naarString(new Date(naarDatum(s) - DAG));

// Losse aflossingen op een lening, op datum.
export function aflossingenVoor(lening, aflossingen) {
  return aflossingen
    .filter((a) => a.lening_id === lening.id)
    .map((a) => ({ datum: a.datum, bedrag: a.bedrag }))
    .sort((a, b) => a.datum.localeCompare(b.datum));
}

// Grenzen van de renteperiodes: [start, ..., einde]. Bij 'kalenderjaar' wordt
// de rente op 31-12 bijgeschreven, bij 'contractjaar' op de jaardag van de
// startdatum. Ligt totDatum na het einde van de looptijd, dan lopen de
// periodes door.
function periodegrenzen(lening, totDatum) {
  const einde = plusJaren(lening.startdatum, lening.looptijd_jaren);
  const laatste = totDatum && totDatum > einde ? totDatum : einde;
  const grenzen = [lening.startdatum];
  for (let k = 1; ; k++) {
    const g =
      lening.rente_periode === 'kalenderjaar'
        ? `${naarDatum(lening.startdatum).getUTCFullYear() + k}-01-01`
        : plusJaren(lening.startdatum, k);
    if (g >= laatste) break;
    grenzen.push(g);
  }
  grenzen.push(laatste);
  return grenzen;
}

// Rente over [start, tot), naar rato van de dagen (actual/actual): bij
// kalenderjaren gedeeld door de dagen van dat kalenderjaar, bij contractjaren
// door de lengte van het contractjaar. Aflossingen verlagen het saldo vanaf
// hun datum.
function renteperiode(lening, saldo, start, tot, aflossingen, totDatum = tot) {
  const r = lening.rente_pct / 100;
  const noemer =
    lening.rente_periode === 'kalenderjaar'
      ? dagenInJaar(start)
      : dagenTussen(start, plusJaren(start, 1));
  let rente = 0;
  let afgelost = 0;
  let cursor = start;
  for (const a of aflossingen) {
    if (a.datum < start || a.datum >= tot || a.datum > totDatum) continue;
    rente += (saldo * r * dagenTussen(cursor, a.datum)) / noemer;
    // Een aflossing boven de hoofdsom voldoet ook de opgelopen, nog niet
    // bijgeschreven rente: zo is volledig aflossen ook echt nul.
    const max = saldo + (lening.rente_bijschrijven ? rente : 0);
    const bedrag = Math.min(a.bedrag, max);
    const opSaldo = Math.min(bedrag, saldo);
    saldo -= opSaldo;
    rente -= bedrag - opSaldo;
    afgelost += bedrag;
    cursor = a.datum;
  }
  rente += (saldo * r * dagenTussen(cursor, totDatum)) / noemer;
  return { saldo, rente, afgelost };
}

// Verloop per renteperiode tot en met het einde van de looptijd. Periodes die
// na 'vandaag' eindigen zijn prognose: alleen al ingevoerde aflossingen tellen.
export function schuldverloop(lening, aflossingen, { vandaag, totDatum } = {}) {
  const grenzen = periodegrenzen(lening, totDatum);
  const rijen = [];
  let saldo = lening.hoofdsom;
  for (let k = 0; k < grenzen.length - 1; k++) {
    const [start, tot] = [grenzen[k], grenzen[k + 1]];
    const begin = saldo;
    const p = renteperiode(lening, saldo, start, tot, aflossingen);
    saldo = p.saldo + (lening.rente_bijschrijven ? p.rente : 0);
    rijen.push({
      jaar: k + 1,
      start,
      eind: minEenDag(tot),
      beginsaldo: begin,
      rente: p.rente,
      rente_betaald: lening.rente_bijschrijven ? 0 : p.rente,
      afgelost: p.afgelost,
      eindsaldo: saldo,
      prognose: vandaag ? tot > vandaag : false,
    });
  }
  return rijen;
}

// Schuld op een willekeurige datum: saldo na de laatste bijschrijving, plus de
// sindsdien opgelopen (nog niet bijgeschreven) rente.
export function schuldOp(lening, aflossingen, peildatum) {
  if (peildatum < lening.startdatum) return { saldo: 0, opgelopen_rente: 0, totaal: 0 };
  const grenzen = periodegrenzen(lening, peildatum);
  let saldo = lening.hoofdsom;
  for (let k = 0; k < grenzen.length - 1; k++) {
    const [start, tot] = [grenzen[k], grenzen[k + 1]];
    if (peildatum < tot || k === grenzen.length - 2) {
      const deel = renteperiode(lening, saldo, start, tot, aflossingen, peildatum);
      const opgelopen = lening.rente_bijschrijven ? deel.rente : 0;
      return { saldo: deel.saldo, opgelopen_rente: opgelopen, totaal: deel.saldo + opgelopen };
    }
    const p = renteperiode(lening, saldo, start, tot, aflossingen);
    saldo = p.saldo + (lening.rente_bijschrijven ? p.rente : 0);
  }
  return { saldo, opgelopen_rente: 0, totaal: saldo };
}

// Toets van de aflossingsverplichting uit dividend (B-GL-2024 art. 3.2), per
// kalenderjaar van uitkering. Geen dividend = geen verplichting (art. 3.1).
// Het contract noemt geen termijn; daarom telt elke aflossing in hetzelfde
// kalenderjaar mee, en daarnaast wordt cumulatief getoetst.
export function dividendToets(lening, dividenden, aflossingen, totJaar) {
  const pct = (lening.aflossing_uit_dividend_pct ?? 0) / 100;
  const grondslag = lening.aflossing_grondslag === 'netto' ? 'netto' : 'bruto';
  const eigen = dividenden.filter((d) => d.positie_id === lening.positie_id);
  const afl = aflossingen.filter((a) => a.lening_id === lening.id);
  const jaar = (s) => naarDatum(s).getUTCFullYear();
  const eerste = jaar(lening.startdatum);
  const rijen = [];
  let cumVerplicht = 0;
  let cumAfgelost = 0;
  for (let j = eerste; j <= totJaar; j++) {
    const div = eigen.filter((d) => jaar(d.datum) === j);
    const bruto = div.reduce((s, d) => s + d.bruto, 0);
    const netto = div.reduce((s, d) => s + d.netto, 0);
    const verplicht = pct * (grondslag === 'netto' ? netto : bruto);
    const afgelost = afl.filter((a) => jaar(a.datum) === j).reduce((s, a) => s + a.bedrag, 0);
    cumVerplicht += verplicht;
    cumAfgelost += afgelost;
    rijen.push({
      jaar: j,
      dividend_bruto: bruto,
      dividend_netto: netto,
      verplicht,
      afgelost,
      verschil: afgelost - verplicht,
      cum_verschil: cumAfgelost - cumVerplicht,
      status: verplicht === 0 ? 'geen dividend' : afgelost + 0.005 >= verplicht ? 'voldaan' : 'tekort',
    });
  }
  return { grondslag, pct: pct * 100, rijen };
}

// Simulatie "aflossen of aanhouden" vanaf een datum: wat doet extra aflossen
// met de schuld, met je eigen geld en met het saldo van die twee? Het eigen geld
// is de som van alle kasstromen vanaf 'vanaf' (dividend in, aflossing uit),
// jaarlijks samengesteld met het alternatieve rendement. Alles vóór
// inkomstenbelasting. De verplichte aflossing uit dividend wordt steeds
// nagekomen; extra aflossen stopt zodra de schuld nul is.
export function simulatie(lening, historie, opties) {
  const {
    vanaf, extraPerMaand = 0, eenmalig = 0, dividendPerJaar = 0, dividendVoorJaar, dividendDag = '05-08',
    rendementPct = 0, belastingPct = 0, beleid = 'verplicht', dividendbelastingPct = 15,
  } = opties;
  const einde = plusJaren(lening.startdatum, lening.looptijd_jaren);
  const pct = (lening.aflossing_uit_dividend_pct ?? 0) / 100;
  const grondslag = lening.aflossing_grondslag === 'netto' ? 1 - dividendbelastingPct / 100 : 1;
  // Bruto dividend van de houder per jaar; null = geen gepland dividend.
  const brutoVoor = dividendVoorJaar ?? (() => dividendPerJaar);

  // Geplande gebeurtenissen, op datum.
  const plan = [];
  if (eenmalig > 0) plan.push({ datum: vanaf, soort: 'eenmalig', bedrag: eenmalig });
  const [vj, vm] = vanaf.split('-').map(Number);
  for (let k = 1; ; k++) {
    const m = vm - 1 + k;
    const d = `${vj + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}-01`;
    if (d >= einde) break;
    if (extraPerMaand > 0) plan.push({ datum: d, soort: 'extra', bedrag: extraPerMaand });
  }
  const dividenden = [];
  for (let j = vj; `${j}-01-01` < einde; j++) {
    const bruto = brutoVoor(j);
    if (!bruto) continue;
    // Staat de gebruikelijke uitkeringsdatum al achter ons, dan valt een
    // opgegeven dividend voor dit jaar op de dag na 'vanaf'.
    let d = `${j}-${dividendDag}`;
    if (d <= vanaf) d = plusDagen(vanaf, 1);
    if (d >= einde || naarDatum(d).getUTCFullYear() !== j) continue;
    const netto = bruto * (1 - belastingPct / 100);
    dividenden.push({ datum: d, bruto, netto });
    plan.push({ datum: d, soort: 'dividend', bedrag: netto });
    const verplicht = bruto * grondslag * pct;
    plan.push({ datum: d, soort: 'verplicht', bedrag: beleid === 'netto' ? Math.max(verplicht, netto) : verplicht });
  }
  plan.sort((a, b) => a.datum.localeCompare(b.datum));

  const aflossingen = historie.filter((a) => a.datum < vanaf).map((a) => ({ datum: a.datum, bedrag: a.bedrag, soort: 'historie' }));
  const kasstromen = [];
  let eigenGeld = 0;
  for (const g of plan) {
    if (g.soort === 'dividend') {
      kasstromen.push({ datum: g.datum, bedrag: g.bedrag });
      continue;
    }
    const open = schuldOp(lening, aflossingen, g.datum).totaal;
    const bedrag = Math.min(g.bedrag, open);
    if (bedrag < 0.005) continue;
    aflossingen.push({ datum: g.datum, bedrag, soort: g.soort });
    aflossingen.sort((a, b) => a.datum.localeCompare(b.datum));
    kasstromen.push({ datum: g.datum, bedrag: -bedrag });
    if (g.soort === 'extra' || g.soort === 'eenmalig') eigenGeld += bedrag;
  }

  const r = rendementPct / 100;
  const kas = (t) =>
    kasstromen
      .filter((c) => c.datum <= t)
      .reduce((s, c) => s + c.bedrag * (1 + r) ** (dagenTussen(c.datum, t) / 365), 0);
  const schuld = (t) => schuldOp(lening, aflossingen, t).totaal;

  const punten = [];
  for (let k = 0; ; k++) {
    const m = vm - 1 + k;
    let d = `${vj + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}-01`;
    if (k === 0) d = vanaf;
    if (d > einde) break;
    punten.push(d);
  }
  if (punten.at(-1) !== einde) punten.push(einde);

  const reeks = punten.map((d) => {
    const s = schuld(d);
    const k = kas(d);
    return { datum: d, schuld: s, eigen_geld: k, netto: k - s };
  });
  const schuldvrij = reeks.find((p) => p.schuld < 0.005)?.datum ?? null;
  const betaald = aflossingen.filter((a) => a.datum >= vanaf).reduce((s, a) => s + a.bedrag, 0);
  const renteTotaal = reeks.at(-1).schuld - reeks[0].schuld + betaald;
  return {
    reeks, schuldvrij_op: schuldvrij, eigen_geld_ingezet: eigenGeld, rente: renteTotaal, einde,
    schuld, kas, aflossingen, dividenden,
  };
}

// Jaaroverzicht in de vorm van het eigen ROI-model (B-ROI): per kalenderjaar
// schuld, rente, dividend, aflossing, waarde en resultaat. Het netto resultaat
// is (waarde certificaten − schuld) + cumulatief kasoverschot (netto dividend −
// aflossingen); de ROI is dat resultaat gedeeld door de inleg.
// Waardering per jaar volgens de methode van de verkopers (B-PRES dia 5, 7, 8).
// In en vóór het jaar van verkrijging geldt de betaalde instapprijs.
// de prijs in jaar J is de waardering per eind J-1. Volgorde:
//  1. een vastgestelde waardering die in jaar J als prijs geldt (STAK, afgerond);
//  2. anders factor × gewogen gemiddelde (3-2-1) van de resultaten J-1, J-2, J-3;
//  3. anders de waarde van het jaar ervoor, met de ingestelde groei;
//  4. anders (vóór de eerste waardering) de inleg: de instapprijs.
// Geeft per jaar de ondernemingswaarde en de waarde van de positie.
export function waarderingPerJaar({
  jaarresultaten = [], vastgesteld = [], factor, weging = [3, 2, 1], noemer, aantal, inleg, groeiPct = 0, vanJaar,
}) {
  const res = new Map(jaarresultaten.map((r) => [Number(r.boekjaar), Number(r.resultaat)]));
  const cache = new Map();
  const somW = weging.reduce((a, b) => a + b, 0);
  const bereken = (j) => {
    if (cache.has(j)) return cache.get(j);
    let uit;
    if (factor == null || !noemer || j <= vanJaar) {
      uit = { soort: 'inleg', ondernemingswaarde: null, waarde: inleg, bron: 'instapprijs (inleg)' };
    } else {
      const vast = vastgesteld.find(
        (w) => Number(w.geldig_in_jaar) === j && (w.factor == null || Number(w.factor) === factor),
      );
      const jaren = [j - 1, j - 2, j - 3];
      const vorige = j > vanJaar ? bereken(j - 1) : null;
      let ow = null;
      let soort;
      let bron;
      let gewogen = null;
      if (vast) {
        ow = vast.ondernemingswaarde;
        soort = 'vastgesteld';
        bron = `${vast.label} (vastgesteld, ${vast.bron ?? 'stamdata'})`;
      } else if (jaren.every((x) => res.has(x))) {
        gewogen = jaren.reduce((sum, x, i) => sum + weging[i] * res.get(x), 0) / somW;
        ow = Math.max(0, factor * gewogen);
        soort = 'berekend';
        bron = `×${factor} gewogen resultaat ${j - 3}–${j - 1}`;
      } else if (vorige && vorige.soort !== 'inleg') {
        ow = vorige.ondernemingswaarde * (1 + groeiPct / 100);
        soort = 'doorgetrokken';
        bron = groeiPct ? `${j - 1} + ${groeiPct}% groei` : `gelijk aan ${j - 1}`;
      }
      uit = ow == null
        ? { soort: 'inleg', ondernemingswaarde: null, waarde: inleg, bron: 'instapprijs (inleg)' }
        : { soort, ondernemingswaarde: ow, waarde: (ow / noemer) * aantal, bron, gewogen };
    }
    cache.set(j, uit);
    return uit;
  };
  return bereken;
}

export function jaaroverzicht(lening, { aflossingen, dividenden, waarde, inleg, aandeel, vanJaar, totJaar }) {
  const waardeVoor = typeof waarde === 'function' ? waarde : () => ({ waarde, bron: null });
  const verloop = schuldverloop(lening, aflossingen, { totDatum: `${totJaar + 1}-01-01` });
  const jaar = (s) => naarDatum(s).getUTCFullYear();
  const rijen = [];
  let cumKas = 0;
  for (let j = vanJaar; j <= totJaar; j++) {
    const begin = schuldOp(lening, aflossingen, `${j}-01-01`).totaal;
    const eind = schuldOp(lening, aflossingen, `${j + 1}-01-01`).totaal;
    const rente = verloop.filter((r) => jaar(r.start) === j).reduce((s, r) => s + r.rente, 0);
    const div = dividenden.filter((d) => jaar(d.datum) === j);
    const bruto = div.reduce((s, d) => s + d.bruto, 0);
    const netto = div.reduce((s, d) => s + d.netto, 0);
    const afgelost = aflossingen.filter((a) => jaar(a.datum) === j).reduce((s, a) => s + a.bedrag, 0);
    cumKas += netto - afgelost;
    const { waarde: w, bron: waardeBron } = waardeVoor(j);
    const vermogen = w - eind;
    rijen.push({
      jaar: j,
      begin_schuld: begin,
      rente,
      dividend_totaal: aandeel ? bruto / aandeel : null,
      dividend_bruto: bruto,
      dividend_netto: netto,
      afgelost,
      eind_schuld: eind,
      waarde: w,
      waarde_bron: waardeBron,
      vermogen,
      cum_kas: cumKas,
      resultaat: vermogen + cumKas,
      // werkelijk ontvangen dividend (niet aan te passen) en/of werkelijke aflossingen
      dividend_werkelijk: div.some((d) => d.historie),
      historie: div.some((d) => d.historie) || aflossingen.some((a) => jaar(a.datum) === j && a.soort === 'historie'),
    });
  }
  const laatste = rijen.at(-1);
  return { rijen, rest_schuld: laatste?.eind_schuld ?? 0, roi_pct: inleg && laatste ? (laatste.resultaat / inleg) * 100 : null };
}

function plusDagen(s, n) {
  const d = naarDatum(s);
  d.setUTCDate(d.getUTCDate() + n);
  return naarString(d);
}

// Box-indicatie op basis van het belang. Indicatief: de lucratiefbelangtoets
// (art. 3.92b Wet IB 2001) staat hier los van en is een open vraag.
export function boxIndicatie(aantal, noemer) {
  const pct = (aantal / noemer) * 100;
  return pct >= 5
    ? { pct, box: 2, grond: 'aanmerkelijk belang ≥ 5% (art. 4.6 Wet IB 2001)' }
    : { pct, box: 3, grond: 'geen aanmerkelijk belang (< 5%, art. 4.6 Wet IB 2001)' };
}

// Hoeveel dividend moet de vennootschap in totaal uitkeren om de rente te
// dragen? 'dekken' = rente volledig uit het eigen deel van het dividend;
// 'stilstand' = de verplichte aflossing uit dividend is gelijk aan de rente,
// zodat de schuld niet verder groeit.
export function breakEven(jaarrente, aantal, noemer, aflossingPct) {
  const aandeel = aantal / noemer;
  return {
    noemer,
    aandeel,
    dividend_rente_dekken: jaarrente / aandeel,
    dividend_schuld_stilstand: aflossingPct > 0 ? jaarrente / (aandeel * (aflossingPct / 100)) : null,
  };
}

export function leaverRegel(regels, categorie, jaar) {
  return regels.find(
    (r) =>
      r.categorie === categorie &&
      (r.vanaf_jaar == null || jaar >= r.vanaf_jaar) &&
      (r.tot_en_met_jaar == null || jaar <= r.tot_en_met_jaar),
  );
}

// Prijs per certificaat bij vertrek. De extra korting van art. 6.5 wordt op de
// Marktwaarde toegepast, vóór het leaverpercentage — dat is een lezing, geen
// vaststaand gegeven.
export function leaverPrijs({ ondernemingswaarde, noemer, regel, extraKortingPct, inlegPerCertificaat }) {
  const marktwaarde = ondernemingswaarde / noemer;
  const naKorting = marktwaarde * (1 - (extraKortingPct ?? 0) / 100);
  let prijs = (naKorting * regel.pct_marktwaarde) / 100;
  let begrensd = false;
  if (regel.max_inleg && inlegPerCertificaat < prijs) {
    prijs = inlegPerCertificaat;
    begrensd = true;
  }
  return { marktwaarde, prijs, begrensd };
}
