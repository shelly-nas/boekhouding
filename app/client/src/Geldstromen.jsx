import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { eur, pct } from './format.js';
import { MetBronnen } from './bronnen.jsx';
import { Kpi, Netto } from './onderdelen.jsx';

// Geldstromen vanuit A. Dreves: dividend van Verra A&V, privé en via de
// holding; rente, aflossing en belasting; uitkering van de holding aan privé.
// "Waarde voor A. Dreves" telt geld in de holding mee na de box 2-heffing die
// bij uitkering nog komt — uitkeren verandert die waarde niet, alleen wanneer
// het geld privé beschikbaar is.

export default function Geldstromen() {
  const [invoer, setInvoer] = useState({ dividend_totaal: '', uitkeren_pct: 0, dv: 'ja', box2_vanaf: '' });
  const [jaar, setJaar] = useState(null);
  const [data, setData] = useState(null);
  const [fout, setFout] = useState(null);
  const timer = useRef(null);
  const zet = (k, v) => setInvoer((i) => ({ ...i, [k]: v }));

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const q = new URLSearchParams(Object.entries(invoer).filter(([, v]) => v !== ''));
      api.get(`/geldstromen?${q}`).then((d) => {
        setData(d);
        setFout(null);
        setJaar((j) => j ?? d.jaren.find((x) => x.prognose && x.holding.dividend_bruto > 0)?.jaar ?? d.jaren.at(-1).jaar);
      }, (e) => setFout(e.message));
    }, 150);
    return () => clearTimeout(timer.current);
  }, [invoer]);

  if (fout) return <p className="fout">{fout}</p>;
  if (!data) return <section className="kaart"><p className="uitleg">Laden…</p></section>;
  const u = data.uitgangspunten;
  const t = data.totalen_prognose;
  const rij = data.jaren.find((x) => x.jaar === jaar) ?? data.jaren.at(-1);
  const eerste = data.jaren.find((x) => x.prognose)?.jaar;
  const laatste = data.jaren.at(-1).jaar;

  return (
    <MetBronnen>
      <section className="kaart">
        <h3>Geldstromen vanuit A. Dreves</h3>
        <p className="uitleg">
          Hoe het dividend van Verra A&V bij A. Dreves komt: rechtstreeks (privé, {pct(u.aandeel_prive * 100)}) en via Dreves Holding
          ({pct(u.aandeel_holding * 100)}). Geld in de holding is voor A. Dreves minder waard dan geld privé: bij uitkering komt er nog
          {' '}{pct(u.box2_tarief)} box 2 overheen. De waarde voor A. Dreves rekent daarom met het holdinggeld ná die latente heffing.
        </p>
        <div className="keuzes">
          <label>
            Dividend Verra A&V per jaar{' '}
            <input type="number" step="5000" min="0" className="cel" placeholder={String(Math.round(u.dividend_totaal))}
              value={invoer.dividend_totaal} onChange={(e) => zet('dividend_totaal', e.target.value)} />
          </label>
          <label>
            Holding keert uit{' '}
            <input type="range" min="0" max="100" step="10" value={invoer.uitkeren_pct} onChange={(e) => zet('uitkeren_pct', Number(e.target.value))} />{' '}
            <strong>{invoer.uitkeren_pct}%</strong> <small>van de vrije kas</small>
          </label>
          <label>
            Deelnemingsvrijstelling{' '}
            <select value={invoer.dv} onChange={(e) => zet('dv', e.target.value)}>
              <option value="ja">ja (aangenomen)</option>
              <option value="nee">nee</option>
            </select>{' '}
            <small>V-F19</small>
          </label>
          <label>
            Privé{' '}
            <select value={String(u.box2_vanaf ?? 'nooit')} onChange={(e) => zet('box2_vanaf', e.target.value)}>
              <option value="nooit">box 3</option>
              {data.jaren.map((x) => <option key={x.jaar} value={String(x.jaar)}>box 2 vanaf {x.jaar}</option>)}
            </select>{' '}
            <small>V-F47</small>
          </label>
        </div>

        <div className="kpis">
          <Kpi titel={`Waarde voor A. Dreves ${eerste}–${laatste}`} waarde={<Netto n={t.waarde} />} sub="privé netto − rente + holdingresultaat na latente box 2" />
          <Kpi titel="Privé in handen" waarde={<Netto n={t.in_handen} />} sub="netto dividend − aflossing + uitkering na box 2" />
          <Kpi titel="Belasting" waarde={eur(t.belasting)} sub="box 2 privé, VpB, box 2 over uitkeringen" />
          <Kpi titel={`Kas in de holding eind ${laatste}`} waarde={<Netto n={t.kas_holding_eind} />} sub={`latente box 2 bij uitkering: ${eur(t.latent_in_holding)}`} />
        </div>

        <div className="balk">
          <label>
            Stroomschema voor{' '}
            <select value={rij.jaar} onChange={(e) => setJaar(Number(e.target.value))}>
              {data.jaren.map((x) => <option key={x.jaar} value={x.jaar}>{x.jaar}{x.prognose ? ' (plan)' : ''}</option>)}
            </select>
          </label>
        </div>
        <Stroomschema rij={rij} />

        <h4>Per jaar</h4>
        <div className="scroll">
          <table className="jaren">
            <thead>
              <tr>
                <th rowSpan={2}>Jaar</th>
                <th colSpan={4} className="groepkop">Privé</th>
                <th colSpan={5} className="groepkop">Dreves Holding</th>
                <th colSpan={3} className="groepkop">A. Dreves</th>
              </tr>
              <tr>
                <th className="getal">Dividend</th>
                <th className="getal">Belasting</th>
                <th className="getal">Aflossing</th>
                <th className="getal">Rente (bij&shy;geschreven)</th>
                <th className="getal">Dividend</th>
                <th className="getal">Rente + aflossing</th>
                <th className="getal">VpB</th>
                <th className="getal">Uitkering</th>
                <th className="getal">Kas eind</th>
                <th className="getal">In handen</th>
                <th className="getal">Waarde in holding</th>
                <th className="getal">Waarde totaal</th>
              </tr>
            </thead>
            <tbody>
              {data.jaren.map((x) => (
                <tr key={x.jaar} className={x.prognose ? 'prognose' : ''} onClick={() => setJaar(x.jaar)}>
                  <td>{x.jaar}<br /><small>{x.prognose ? 'plan' : 'werkelijk'} · box {x.prive.box}</small></td>
                  <td className="getal">{eur(x.prive.dividend_bruto)}</td>
                  <td className="getal">{eur(x.prive.belasting)}</td>
                  <td className="getal">{eur(x.prive.aflossing)}</td>
                  <td className="getal">{eur(x.prive.rente_bijgeschreven)}</td>
                  <td className="getal">{eur(x.holding.dividend_bruto)}</td>
                  <td className="getal">{eur(x.holding.rente + x.holding.aflossing)}</td>
                  <td className="getal">{eur(x.holding.vpb)}</td>
                  <td className="getal">{eur(x.holding.uitkering)}</td>
                  <td className="getal"><Netto n={x.holding.kas_eind} /></td>
                  <td className="getal"><Netto n={x.a_dreves.in_handen} /></td>
                  <td className="getal"><Netto n={x.a_dreves.waarde_holding} /></td>
                  <td className="getal"><strong><Netto n={x.a_dreves.waarde} /></strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="uitleg">
          <li>
            <strong>Dividend aan de holding:</strong> vrijgesteld als de deelnemingsvrijstelling geldt (art. 13 Wet VpB 1969); dan houdt
            Verra A&V ook geen dividendbelasting in (art. 4 Wet DB 1965). Zonder vrijstelling: VpB over het dividend min de rente, en
            {' '}{pct(u.dividendbelasting)} dividendbelasting die met de VpB wordt verrekend, zonder teruggave (art. 25 Wet VpB 1969).
          </li>
          <li>
            <strong>Rente in de holding</strong> is aftrekbaar; met vrijstelling ontstaat zo een verlies dat later verrekenbaar is
            (art. 20 Wet VpB 1969), bijvoorbeeld met een managementvergoeding (V-F39).
          </li>
          <li>
            <strong>Uitkering holding → privé:</strong> {pct(u.dividendbelasting)} dividendbelasting ingehouden als voorheffing, verrekend in box 2
            (art. 9.2 Wet IB 2001); per saldo {pct(u.box2_tarief)} tot € 68.843 (art. 2.12 Wet IB 2001). Het aanmerkelijk belang in de holding
            staat vast (100%, art. 4.6 Wet IB 2001).
          </li>
          <li>
            <strong>Aflossing</strong> is 25% van het bruto dividend (B-GL-2024 en B-GL-2025 art. 3.2), in dit plan precies het verplichte
            deel. Aflossen verlaagt de schuld en telt daarom niet als verlies van waarde; de rente wel. De privérente wordt bijgeschreven
            (geen kasstroom), de holding betaalt haar rente jaarlijks.
          </li>
          <li>
            <strong>Einde lening 2024 (23-12-2029):</strong> de restschuld wordt dan opeisbaar; die aflossing staat niet in deze stromen
            (zie Financiering en Verra A&V → Vertrek privé).
          </li>
          <li>
            Niet in deze stromen: de waardeverandering van de certificaten, het loon van A. Dreves (V-F28), de box 3-heffing en kosten van
            de holding. Kas in de holding begint op nul (bank nog niet geboekt).
          </li>
        </ul>
      </section>
    </MetBronnen>
  );
}

// Stroomschema voor één jaar; de dikte van een lijn volgt het bedrag.
function Stroomschema({ rij }) {
  const p = rij.prive;
  const h = rij.holding;
  const a = rij.a_dreves;
  const W = 1000;
  const HH = 410;
  const K = {
    vav: { x: 20, y: 40, naam: 'Verra Aan- en Verkoop', sub: 'dividend' },
    geldgever: { x: 20, y: 300, naam: 'Verra Aan- en Verkoop', sub: 'geldgever: rente en aflossing' },
    holding: { x: 400, y: 170, naam: 'Dreves Holding B.V.', sub: `blijft: ${eur(h.kas)} kas · resultaat ${eur(h.resultaat)}` },
    prive: { x: 780, y: 40, naam: 'A. Dreves (privé)', sub: `in handen ${eur(a.in_handen)}` },
    fiscus: { x: 780, y: 300, naam: 'Belastingdienst', sub: 'box 2, VpB, dividendbelasting' },
  };
  const BW = 200;
  const BH = 56;
  const stromen = [
    { van: 'vav', naar: 'prive', bedrag: p.dividend_bruto, label: 'dividend', kleur: '--reeks-1' },
    { van: 'vav', naar: 'holding', bedrag: h.dividend_bruto, label: 'dividend', kleur: '--reeks-1' },
    { van: 'holding', naar: 'prive', bedrag: h.uitkering, label: 'uitkering', kleur: '--primary' },
    { van: 'prive', naar: 'fiscus', bedrag: p.belasting + a.box2_uitkering, label: 'box 2', kleur: '--error' },
    { van: 'holding', naar: 'fiscus', bedrag: h.vpb_betaald + h.dividendbelasting, label: 'VpB / dividendbelasting', kleur: '--error' },
    { van: 'holding', naar: 'geldgever', bedrag: h.rente + h.aflossing, label: 'rente + aflossing', kleur: '--reeks-2' },
    { van: 'prive', naar: 'geldgever', bedrag: p.aflossing, label: 'aflossing', kleur: '--reeks-2' },
    { van: 'prive', naar: 'geldgever', bedrag: p.rente_bijgeschreven, label: 'rente (bijgeschreven)', kleur: '--reeks-2', geenKas: true },
  ].filter((s) => s.bedrag > 0.005);
  const max = Math.max(1, ...stromen.map((s) => s.bedrag));
  const dikte = (b) => Math.max(2, (b / max) * 28);
  const punt = (k, naar) => {
    const n = K[k];
    const m = K[naar];
    const rechts = m.x > n.x;
    const x = n.x === m.x ? n.x + BW / 2 : rechts ? n.x + BW : n.x;
    const y = n.x === m.x ? (m.y > n.y ? n.y + BH : n.y) : n.y + BH / 2;
    return { x, y };
  };

  return (
    <svg className="stromen" viewBox={`0 0 ${W} ${HH}`} width="100%" style={{ maxWidth: W }}>
      {stromen.map((s, i) => {
        const a1 = punt(s.van, s.naar);
        const b1 = punt(s.naar, s.van);
        const zelfdeKolom = K[s.van].x === K[s.naar].x;
        // Privé → geldgever loopt onderlangs, om de holding heen.
        const onderlangs = s.van === 'prive' && s.naar === 'geldgever';
        const off = s.geenKas ? 10 : -10;
        const pv = K.prive;
        const gg = K.geldgever;
        const d = onderlangs
          ? `M${pv.x + 40},${pv.y + BH} C${pv.x + 40},${HH - 10} ${gg.x + BW + 220},${HH + 5 + off} ${gg.x + BW},${gg.y + BH / 2 + off}`
          : zelfdeKolom
          ? `M${a1.x + (i % 2 ? 30 : -30)},${a1.y} L${b1.x + (i % 2 ? 30 : -30)},${b1.y}`
          : `M${a1.x},${a1.y} C${(a1.x + b1.x) / 2},${a1.y} ${(a1.x + b1.x) / 2},${b1.y} ${b1.x},${b1.y}`;
        const mx = onderlangs ? 560 : (a1.x + b1.x) / 2;
        const my = onderlangs ? (s.geenKas ? 392 : 362) : (a1.y + b1.y) / 2;
        return (
          <g key={i}>
            <path d={d} fill="none" stroke={`var(${s.kleur})`} strokeOpacity={s.geenKas ? 0.45 : 0.75} strokeWidth={dikte(s.bedrag)}
              strokeDasharray={s.geenKas ? '6 5' : undefined} strokeLinecap="round" />
            <text x={mx} y={my - 6} textAnchor="middle" className="stroomlabel">{s.label}: {eur(s.bedrag)}</text>
          </g>
        );
      })}
      {Object.entries(K).map(([k, n]) => (
        <g key={k} className="stroomknoop">
          <rect x={n.x} y={n.y} width={BW} height={BH} rx="8" />
          <text x={n.x + 10} y={n.y + 22} className="naam">{n.naam}</text>
          <text x={n.x + 10} y={n.y + 41} className="sub">{n.sub}</text>
        </g>
      ))}
    </svg>
  );
}
