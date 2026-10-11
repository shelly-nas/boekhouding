// Geldstromen vanuit A. Dreves: hoe dividend van Verra A&V binnenkomt (privé
// en via de holding), wat er naar rente, aflossing en belasting gaat, wat de
// holding aan privé uitkeert, en wat het samen waard is voor A. Dreves.
//
// Kernmaat: "waarde voor A. Dreves". Geld dat in de holding blijft, telt mee
// na de box 2-heffing die bij uitkering nog betaald wordt (latent). Uitkeren
// verandert die waarde dus niet; het bepaalt alleen wanneer het geld privé
// beschikbaar is.
import { DIVIDENDTARIEF, plusJaren, schuldverloop } from './rekenen.js';
import { aflossingenPerLening } from './financiering.js';
import { laad, planUitQuery, privepositie, rekenAantal } from './verra.js';

const vandaag = () => new Date().toISOString().slice(0, 10);
const jaarVan = (s) => Number(s.slice(0, 4));
const r2 = (n) => Math.round(n * 100) / 100;

export async function geldstromen(query = {}) {
  const d = await laad();
  const p = privepositie(d);
  const h = d.posities.find((x) => d.code[x.houder_id] === 'holding') ?? null;
  const plan = planUitQuery(query, d, p);
  const noemer = plan.noemer;
  const totaalVoor = plan.totaalVoor; // dividend vennootschap per jaar (werkelijk / plan)
  const huidig = jaarVan(vandaag());
  const box2Vanaf = plan.box2_vanaf;
  const t2 = DIVIDENDTARIEF.box2 / 100;
  const db = Number(d.instelling.dividendbelasting_pct ?? 15) / 100;
  const vpbLaag = Number(d.instelling.vpb_tarief_laag) / 100;
  const vpbHoog = Number(d.instelling.vpb_tarief_hoog) / 100;
  const grens = Number(d.instelling.vpb_schijfgrens);
  const dv = query.dv !== 'nee'; // deelnemingsvrijstelling (V-F19): standaard aangenomen
  const uitkerenPct = Math.min(100, Math.max(0, Number(query.uitkeren_pct ?? 0) || 0)) / 100;

  const lening = (pos) => pos && d.leningen.find((l) => l.positie_id === pos.id);
  const lp = lening(p);
  const lh = lening(h);
  const afl = await aflossingenPerLening([lp, lh].filter(Boolean));

  // Dividend per positie per jaar: werkelijk tot en met het lopende jaar, daarna
  // het plan (zelfde regel als Verra A&V → Vertrek privé).
  const aandeel = (pos) => (pos && noemer ? rekenAantal(pos) / noemer : 0);
  const dividend = (pos, j) => {
    if (!pos || j < jaarVan(pos.verkregen_op)) return { bruto: 0, db: null, werkelijk: true };
    const echt = d.dividenden.filter((x) => x.positie_id === pos.id && jaarVan(x.datum) === j);
    if (echt.length || j <= huidig) {
      return { bruto: echt.reduce((s, x) => s + x.bruto, 0), db: echt.reduce((s, x) => s + x.dividendbelasting, 0), werkelijk: true };
    }
    return { bruto: totaalVoor(j) * aandeel(pos), db: null, werkelijk: false };
  };

  const van = jaarVan(p.verkregen_op);
  const tot = Math.max(...[lp, lh].filter(Boolean).map((l) => jaarVan(plusJaren(l.startdatum, l.looptijd_jaren))), huidig + 3);

  // Geplande verplichte aflossing (25% van het bruto dividend) in toekomstige
  // jaren, zodat de rente in het schuldverloop daarop aansluit.
  const metPlan = (l, pos) => {
    if (!l) return [];
    const bestaand = afl.get(l.id)?.aflossingen ?? [];
    const pct = (l.aflossing_uit_dividend_pct ?? 0) / 100;
    const einde = jaarVan(plusJaren(l.startdatum, l.looptijd_jaren));
    const gepland = [];
    // Tot en met het jaar waarin de lening afloopt; de restschuld is dan opeisbaar.
    for (let j = huidig + 1; j <= Math.min(tot, einde); j++) {
      const b = dividend(pos, j).bruto * pct;
      if (b > 0) gepland.push({ datum: `${j}-12-30`, bedrag: b, gepland: true });
    }
    return [...bestaand, ...gepland];
  };
  const aflP = metPlan(lp, p);
  const aflH = metPlan(lh, h);
  const verloopP = lp ? schuldverloop(lp, aflP, { vandaag: vandaag() }) : [];
  const verloopH = lh ? schuldverloop(lh, aflH, { vandaag: vandaag() }) : [];
  const renteIn = (verloop, j) => verloop.filter((r) => jaarVan(r.eind) === j).reduce((s, r) => s + r.rente, 0);
  const aflIn = (lijst, j) => lijst.filter((a) => jaarVan(a.datum) === j).reduce((s, a) => s + a.bedrag, 0);

  const vpbOver = (w) => Math.min(w, grens) * vpbLaag + Math.max(0, w - grens) * vpbHoog;
  let verliesVv = 0; // voorwaarts verrekenbaar verlies holding (art. 20 Wet VpB 1969)
  let dbTegoed = 0; // niet verrekende dividendbelasting holding (art. 25 Wet VpB 1969)
  let kasHolding = 0; // opgebouwde vrije kas in de holding (vanaf nul, zonder bestaand banksaldo)
  const jaren = [];
  for (let j = van; j <= tot; j++) {
    const boxP = box2Vanaf != null && j >= box2Vanaf ? 2 : 3;

    // Privé
    const dp = dividend(p, j);
    const belastingP = boxP === 2 ? dp.bruto * t2 : 0;
    const renteP = renteIn(verloopP, j);
    const aflossingP = aflIn(aflP, j);

    // Holding
    const dh = dividend(h, j);
    const dbH = dv ? 0 : dh.bruto * db;
    const renteH = renteIn(verloopH, j);
    const aflossingH = aflIn(aflH, j);
    const winst = (dv ? 0 : dh.bruto) - renteH;
    let belastbaar = winst;
    if (belastbaar > 0 && verliesVv > 0) {
      const v = Math.min(verliesVv, belastbaar);
      belastbaar -= v;
      verliesVv -= v;
    } else if (belastbaar < 0) {
      verliesVv += -belastbaar;
      belastbaar = 0;
    }
    const vpb = vpbOver(belastbaar);
    dbTegoed += dbH;
    const verrekend = Math.min(dbTegoed, vpb);
    dbTegoed -= verrekend;
    const vpbBetaald = vpb - verrekend;
    const resultaatH = dh.bruto - renteH - vpb; // economisch resultaat na VpB
    const kasJaar = dh.bruto - dbH - renteH - aflossingH - vpbBetaald;
    kasHolding += kasJaar;
    const uitkering = uitkerenPct > 0 && j > huidig ? Math.max(0, kasHolding) * uitkerenPct : 0;
    kasHolding -= uitkering;
    const box2Uitkering = uitkering * t2;

    jaren.push({
      jaar: j,
      prognose: j > huidig,
      prive: { box: boxP, dividend_bruto: r2(dp.bruto), dividend_werkelijk: dp.werkelijk, belasting: r2(belastingP), netto: r2(dp.bruto - belastingP), rente_bijgeschreven: r2(renteP), aflossing: r2(aflossingP) },
      holding: {
        dividend_bruto: r2(dh.bruto), dividendbelasting: r2(dbH), rente: r2(renteH), aflossing: r2(aflossingH),
        vpb: r2(vpb), vpb_betaald: r2(vpbBetaald), resultaat: r2(resultaatH), kas: r2(kasJaar), uitkering: r2(uitkering),
        kas_eind: r2(kasHolding), verlies_vv: r2(verliesVv), db_tegoed: r2(dbTegoed),
      },
      a_dreves: {
        // Wat privé in handen komt: netto dividend − verplichte aflossing + uitkering na box 2.
        in_handen: r2(dp.bruto - belastingP - aflossingP + uitkering - box2Uitkering),
        box2_uitkering: r2(box2Uitkering),
        // Waarde: privé netto dividend − bijgeschreven rente, plus het resultaat
        // van de holding na latente box 2 (bij uitkering).
        waarde: r2(dp.bruto - belastingP - renteP + resultaatH * (1 - t2)),
        waarde_prive: r2(dp.bruto - belastingP - renteP),
        waarde_holding: r2(resultaatH * (1 - t2)),
      },
    });
  }

  const som = (f) => r2(jaren.filter((x) => x.prognose).reduce((s, x) => s + f(x), 0));
  return {
    uitgangspunten: {
      dividend_totaal: plan.standaard_totaal,
      aandeel_prive: aandeel(p), aandeel_holding: aandeel(h), noemer,
      box2_vanaf: box2Vanaf, box2_tarief: DIVIDENDTARIEF.box2, dividendbelasting: db * 100,
      vpb: { laag: vpbLaag * 100, hoog: vpbHoog * 100, grens },
      deelnemingsvrijstelling: dv, uitkeren_pct: uitkerenPct * 100,
    },
    jaren,
    totalen_prognose: {
      in_handen: som((x) => x.a_dreves.in_handen),
      waarde: som((x) => x.a_dreves.waarde),
      belasting: som((x) => x.prive.belasting + x.holding.vpb + x.a_dreves.box2_uitkering),
      latent_in_holding: r2(Math.max(0, kasHolding) * t2),
      kas_holding_eind: r2(kasHolding),
    },
  };
}
