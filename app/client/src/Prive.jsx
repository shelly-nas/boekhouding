import { useEffect, useState } from 'react';
import { api } from './api.js';
import { datum, eur, num, vandaag } from './format.js';
import { Bereik, Kpi } from './onderdelen.jsx';
import { BELASTINGDIENST, MetBronnen } from './bronnen.jsx';

// Administratie privé: het vermogen uit dit dossier en de fiscale posities die
// daarbij horen. Geen volledige aangifte IB (V-F28).

const bereik = (waarden) => (waarden?.length ? { min: Math.min(...waarden.map((w) => w.waarde)), max: Math.max(...waarden.map((w) => w.waarde)) } : null);

export default function Prive() {
  const [peildatum, setPeildatum] = useState(vandaag());
  const [box2Vanaf, setBox2Vanaf] = useState('');
  const [data, setData] = useState(null);
  const [fout, setFout] = useState(null);

  useEffect(() => {
    if (!peildatum) return;
    const q = new URLSearchParams({ peildatum, box2_vanaf: box2Vanaf });
    api.get(`/prive/vermogen?${q}`).then((d) => { setData(d); setFout(null); }, (e) => setFout(e.message));
  }, [peildatum, box2Vanaf]);

  if (fout) return <p className="fout">{fout}</p>;
  if (!data) return <p className="uitleg">Laden…</p>;
  const bezit = data.bestanddelen.filter((b) => b.soort === 'bezitting');
  const schulden = data.bestanddelen.filter((b) => b.soort === 'schuld');
  const somBereik = (lijst) => {
    const r = lijst.map((b) => bereik(b.waarden) ?? { min: 0, max: 0 });
    return { min: r.reduce((s, x) => s + x.min, 0), max: r.reduce((s, x) => s + x.max, 0) };
  };
  const jaren = data.jaren.map((j) => j.jaar);

  return (
    <MetBronnen>
    <>
      <div className="balk">
        <label>
          Peildatum <input type="date" value={peildatum} onChange={(e) => setPeildatum(e.target.value)} />
        </label>
      </div>
      <div className="keuzes">
        <label>
          Certificaten en lening in{' '}
          <select value={String(data.box2_vanaf ?? 'nooit')} onChange={(e) => setBox2Vanaf(e.target.value)}>
            <option value="nooit">box 3, alle jaren</option>
            {[...new Set([...jaren, data.box2_vanaf].filter(Boolean))].sort().map((j) => (
              <option key={j} value={String(j)}>box 2 vanaf {j}</option>
            ))}
          </select>{' '}
          <small>V-F47, A13</small>
        </label>
      </div>
      <p className="uitleg">
        Alleen het vermogen dat in dit dossier zit: de certificaten, de lening 2024 en de aandelen in de holding. Andere
        privébezittingen staan hier niet in; of de aangifte IB binnen de opdracht valt, is open (V-F28).
      </p>

      <div className="kpis">
        <Kpi titel="Bezittingen" waarde={<Bereik {...somBereik(bezit)} kleur={false} />} sub="certificaten ×3 tot ×4, holding tegen eigen vermogen" />
        <Kpi titel="Schulden" waarde={eur(-somBereik(schulden).min)} sub="lening 2024 inclusief bijgeschreven rente" />
        <Kpi titel="Netto vermogen" waarde={<Bereik {...data.netto} />} sub={`op ${datum(data.peildatum)}`} />
      </div>

      <section className="kaart">
        <h3>Vermogen op {datum(data.peildatum)}</h3>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Bestanddeel</th>
                <th>Box</th>
                <th className="getal">Waarde</th>
                <th>Grondslag</th>
              </tr>
            </thead>
            <tbody>
              {data.bestanddelen.map((b) => {
                const r = bereik(b.waarden);
                return (
                  <tr key={b.omschrijving}>
                    <td>{b.omschrijving}</td>
                    <td>{b.box}</td>
                    <td className="getal">
                      {r ? <Bereik {...r} /> : '—'}
                      {b.waarden?.length > 1 && <><br /><small>{b.waarden.map((w) => `×${num(w.factor)}`).join(' tot ')}</small></>}
                    </td>
                    <td><small>{b.waarden ? b.toelichting : 'nog niet verkregen op de peildatum'}</small></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <h4>Verkrijgingsprijzen (box 2)</h4>
        <ul>
          {data.verkrijgingsprijzen.map((v) => (
            <li key={v.omschrijving}><strong>{v.omschrijving}</strong>: {eur(v.bedrag)} <small>— {v.toelichting}</small></li>
          ))}
        </ul>
      </section>

      <section className="kaart">
        <h3>Fiscaal per jaar</h3>
        <p className="uitleg">
          Box 3 kijkt naar het vermogen op 1 januari; box 2 naar het inkomen in het jaar (dividend, vervreemding). De heffing in
          box 3 rekent de app niet uit.
        </p>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Jaar</th>
                <th>Box</th>
                <th className="getal">Certificaten 1-1</th>
                <th className="getal">Lening 1-1</th>
                <th className="getal">Holding 1-1</th>
                <th className="getal">Dividend bruto</th>
                <th className="getal">Dividendbelasting</th>
                <th className="getal">Box 2 over dividend</th>
                <th className="getal">Rente lening</th>
                <th className="getal">Afgelost</th>
              </tr>
            </thead>
            <tbody>
              {data.jaren.map((j) => {
                const c = bereik(j.certificaten);
                return (
                  <tr key={j.jaar}>
                    <td>{j.jaar}</td>
                    <td>{j.box}</td>
                    <td className="getal">{c ? <Bereik {...c} kleur={false} /> : <small>nog niet verkregen</small>}</td>
                    <td className="getal">{j.schuld == null ? '—' : eur(j.schuld)}</td>
                    <td className="getal">{j.holding == null ? '—' : <>{eur(j.holding)}<br /><small>box 2, eigen vermogen</small></>}</td>
                    <td className="getal">{eur(j.dividend_bruto)}</td>
                    <td className="getal">{eur(j.dividendbelasting)}</td>
                    <td className="getal">{j.box === 2 ? eur(j.box2_over_dividend) : <small>box 3</small>}</td>
                    <td className="getal">{eur(j.rente)}{j.rente_prognose && <><br /><small>lopend jaar</small></>}</td>
                    <td className="getal">{eur(j.aflossing)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <ul className="uitleg">
          <li>
            <strong>1-1-2025:</strong> de lening liep al (23-12-2024), de certificaten zijn pas op 02-01-2025 geleverd. Waar het geleende
            bedrag op de peildatum stond (vordering, betaalde koopsom), is niet vastgelegd (V-F59).
          </li>
          <li>
            <strong>Dividendbelasting</strong> is voorheffing en wordt verrekend in de aangifte (art. 9.2 lid 1 onderdeel b Wet IB 2001).
            Of de € 472 over 2025 is verrekend, is open (V-F50).
          </li>
          <li>
            <strong>Box 2 over dividend</strong>: {num(data.box2_tarief)}% in de eerste schijf (tot € 68.843 in 2026, <a className="bron" href={BELASTINGDIENST.box2} target="_blank" rel="noreferrer">Belastingdienst: box 2-tarieven</a>).
            Of de rente op de lening in box 2 aftrekbaar is, is open (V-F49).
          </li>
          <li>
            <strong>Aanmerkelijk belang in de holding</strong>: 100% (art. 4.6 Wet IB 2001). Een uitkering van de holding is box 2-inkomen.
          </li>
          <li>Verwerking van de lening in de aangifte IB 2024 en 2025: V-F14. Lucratief belang: V-F09.</li>
        </ul>
      </section>
    </>
    </MetBronnen>
  );
}
