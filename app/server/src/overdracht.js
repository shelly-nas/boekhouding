// Overdracht privé → holding: wat gebeurt er als A. Dreves de privécertificaten
// tegen marktwaarde aan Dreves Holding B.V. verkoopt, per jaar van overdracht?
// Alleen verkoop tegen marktwaarde; ×3 en ×4 geven de bandbreedte van minst
// tot meest gunstig. Rekent met dezelfde waardering, lening en boxkeuze als
// Verra A&V, zodat de bedragen daarmee aansluiten.
import { DIVIDENDTARIEF, plusJaren, schuldOp } from './rekenen.js';
import { factorenVoor, laad, leningVoor, noemersVoor, planUitQuery, privepositie, rekenAantal, waarderingVoor } from './verra.js';

const vandaag = () => new Date().toISOString().slice(0, 10);

export async function overdracht(query = {}) {
  const d = await laad();
  const p = privepositie(d);
  const holding = d.posities.find((x) => d.code[x.houder_id] === 'holding') ?? null;
  const { lening, aflossingen } = leningVoor(d, p);
  const noemer = noemersVoor(d, p).at(-1)?.aantal ?? null;
  const aantal = rekenAantal(p);
  const factoren = factorenVoor(d, p);
  const reeks = Object.fromEntries(factoren.map((f) => [f, waarderingVoor(d, p, f)]));

  // Box per jaar, zoals in Vertrek privé (A13): standaard box 2 vanaf 2026.
  const plan = planUitQuery(query, d, p);
  const box2Vanaf = plan.box2_vanaf;
  const boxIn = (j) => (box2Vanaf != null && j >= box2Vanaf ? 2 : 3);
  const tarief = DIVIDENDTARIEF.box2;

  // Verkrijgingsprijs in box 2 (V-F49): de inleg, of de waarde in het jaar
  // waarin het aanmerkelijk belang ontstaat.
  const vpKeuze = query.verkrijgingsprijs === 'waarde_ontstaan' && box2Vanaf != null ? 'waarde_ontstaan' : 'inleg';
  const verkrijgingsprijs = (f) => (vpKeuze === 'inleg' ? p.inleg : reeks[f](box2Vanaf).waarde);

  const huidig = Number(vandaag().slice(0, 4));
  const einde = lening ? plusJaren(lening.startdatum, lening.looptijd_jaren) : `${huidig + 4}-12-31`;
  const totJaar = Number(einde.slice(0, 4));
  const rijen = [];
  for (let j = Math.max(huidig, Number(p.verkregen_op.slice(0, 4)) + 1); j <= totJaar; j++) {
    // Overdracht op 31-12 (of het einde van de looptijd): de prijs is die van
    // jaar j (waardering per eind j−1, A12); de schuld is die op die datum.
    const datum = `${j}-12-31` < einde ? `${j}-12-31` : einde;
    const schuld = lening ? schuldOp(lening, aflossingen, datum).totaal : 0;
    const box = boxIn(j);
    rijen.push({
      jaar: j,
      datum,
      box,
      schuld,
      per_factor: factoren.map((f) => {
        const w = reeks[f](j);
        const vp = verkrijgingsprijs(f);
        const resultaat = w.waarde - vp;
        const heffing = box === 2 ? resultaat * (tarief / 100) : 0;
        return {
          factor: f,
          prijs: w.waarde,
          per_aandeel: w.waarde / aantal,
          waarde_bron: w.bron,
          verkrijgingsprijs: vp,
          resultaat,
          // Positief: te betalen box 2; negatief: verlies uit aanmerkelijk belang.
          heffing,
          kas_na_schuld: w.waarde - schuld - Math.max(0, heffing),
        };
      }),
    });
  }

  // Dividend over de 13,5 aandelen: wie betaalt welke belasting erover?
  const vpb = Number(d.instelling.vpb_tarief_laag ?? NaN);
  const bruto = plan.aandeel ? plan.standaard_totaal * plan.aandeel : 0;
  const dividend = {
    totaal_vennootschap: plan.standaard_totaal,
    bruto,
    prive_box2: bruto * (tarief / 100),
    prive_box3: 0,
    holding_met_dv: 0,
    holding_zonder_dv: Number.isFinite(vpb) ? bruto * (vpb / 100) : null,
    vpb_tarief: Number.isFinite(vpb) ? vpb : null,
    box2_tarief: tarief,
  };

  return {
    prive: { aandelen: aantal, inleg: p.inleg, verkregen_op: p.verkregen_op },
    holding: holding && { aandelen: rekenAantal(holding), inleg: holding.inleg },
    noemer,
    na_overdracht: holding && noemer ? { aandelen: aantal + rekenAantal(holding), pct: ((aantal + rekenAantal(holding)) / noemer) * 100 } : null,
    lening: lening && { omschrijving: lening.omschrijving, einddatum: einde, bron: lening.bron },
    factoren,
    box2_vanaf: box2Vanaf,
    verkrijgingsprijs: vpKeuze,
    rijen,
    dividend,
  };
}
