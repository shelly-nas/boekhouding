import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import Grafiek from './Grafiek.jsx';
import { datum, eur, num, pct, vandaag } from './format.js';
import { Bereik, KORT, Kpi, Netto, Stamdata, Tijdlijn, useOnderdeel } from './onderdelen.jsx';
import { MetBronnen } from './bronnen.jsx';

// Verra A&V: de deelneming in Verra Aan- en Verkoop Den Haag B.V. Eén set
// stamdata (waardering, jaarresultaten, noemer) voor alle houders; de
// leaverregeling geldt alleen voor de privépositie.

const ONDERDELEN = ['Overzicht', 'Vertrek privé', 'Stamdata'];
const STAMDATA = ['certificaatpositie', 'dividend', 'jaarresultaat', 'waardering', 'noemer', 'leaver_regel', 'entiteit', 'instelling'];

export default function Verra() {
  const [onderdeel, nav] = useOnderdeel(ONDERDELEN);
  return (
    <>
      {nav}
      {onderdeel === 'Overzicht' && <Overzicht />}
      {onderdeel === 'Vertrek privé' && <Vertrek />}
      {onderdeel === 'Stamdata' && <Stamdata tabellen={STAMDATA} />}
    </>
  );
}

function Overzicht() {
  const [peildatum, setPeildatum] = useState(vandaag());
  const [data, setData] = useState(null);
  const [fout, setFout] = useState(null);

  useEffect(() => {
    if (!peildatum) return;
    api.get(`/verra/overzicht?peildatum=${peildatum}`).then(setData, (e) => setFout(e.message));
  }, [peildatum]);

  if (fout) return <p className="fout">{fout}</p>;
  if (!data) return <p className="uitleg">Laden…</p>;
  const s = data.samen;

  return (
    <MetBronnen>
    <>
      <div className="balk">
        <label>
          Peildatum <input type="date" value={peildatum} onChange={(e) => setPeildatum(e.target.value)} />
        </label>
      </div>
      {!s ? (
        <p className="uitleg">Nog geen certificaatpositie — voeg er een toe onder Stamdata.</p>
      ) : (
        <>
          <h2>
            {s.vennootschap}{' '}
            <small>· certificaten via de STAK, zonder vergaderrecht</small>
          </h2>
          <div className="kpis">
            <Kpi titel="Belang samen" waarde={`${num(s.aandelen)} van ${s.noemer} = ${pct(s.pct)}`}
              sub={data.posities.map((p) => `${KORT[p.positie.houder_code] ?? p.positie.houder} ${pct((p.positie.aantal_rekenbasis / s.noemer) * 100)}`).join(' · ')} />
            <Kpi titel="Inleg samen" waarde={eur(s.inleg)} sub="volledig geleend" />
            <Kpi titel="Schuld op peildatum" waarde={eur(s.schuld)} sub="details onder Financiering" />
            <Kpi titel="Waarde samen" waarde={<Bereik min={Math.min(...s.per_factor.map((f) => f.waarde))} max={Math.max(...s.per_factor.map((f) => f.waarde))} kleur={false} />}
              sub={s.per_factor.map((f) => `×${num(f.factor)}`).join(' tot ')} />
            <Kpi titel="Netto samen" waarde={<Bereik min={Math.min(...s.per_factor.map((f) => f.netto))} max={Math.max(...s.per_factor.map((f) => f.netto))} />}
              sub="waarde − schuld" />
          </div>
          <Posities data={data} />
          <Waarderingsverloop rijen={data.waarderingsverloop} posities={data.posities} />
        </>
      )}
      <Tijdlijn items={data.gebeurtenissen} />
      <Aandachtspunten />
    </>
    </MetBronnen>
  );
}

function Posities({ data }) {
  const s = data.samen;
  return (
    <MetBronnen>
    <section className="kaart">
      <h3>Posities</h3>
      <p className="uitleg">
        Waarde = ondernemingswaarde ÷ {s.noemer} × aantal aandelen, volgens de waardering die op de peildatum als prijs
        geldt. Het belang wordt gemeten aan het geplaatste kapitaal van {s.noemer} aandelen (A14).
      </p>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Houder</th>
              <th className="getal">Aandelen</th>
              <th>Verkregen</th>
              <th className="getal">Inleg</th>
              {s.per_factor.map((f) => <th key={f.factor} className="getal">Waarde ×{num(f.factor)}</th>)}
              <th className="getal">Schuld</th>
              <th className="getal">Netto</th>
              <th className="getal">Dividend netto</th>
            </tr>
          </thead>
          <tbody>
            {data.posities.map((p) => {
              const cellen = p.matrix.map((m) => ({ w: m.waardering, c: m.cellen.at(-1) }));
              return (
                <tr key={p.positie.id}>
                  <td>
                    {p.positie.houder}
                    {p.positie.houder_code === 'prive' && <><br /><small>leaverregeling van toepassing</small></>}
                  </td>
                  <td className="getal">{num(p.positie.aantal_rekenbasis)}<br /><small>{pct((p.positie.aantal_rekenbasis / s.noemer) * 100)}</small></td>
                  <td>{datum(p.positie.verkregen_op)}</td>
                  <td className="getal">{eur(p.positie.inleg)}<br /><small>{eur(p.positie.inleg / p.positie.aantal_rekenbasis)}/aandeel</small></td>
                  {cellen.map(({ w, c }) => (
                    <td key={w.id} className="getal">{eur(c?.waarde)}{w.soort === 'inleg' && <><br /><small>instapprijs</small></>}</td>
                  ))}
                  <td className="getal">{eur(p.schuld.totaal)}</td>
                  <td className="getal">{p.netto_bandbreedte ? <Bereik {...p.netto_bandbreedte} /> : '—'}</td>
                  <td className="getal">{eur(p.dividend_totaal.netto)}</td>
                </tr>
              );
            })}
            <tr className="totaal">
              <td><strong>Samen</strong></td>
              <td className="getal"><strong>{num(s.aandelen)}</strong><br /><small>{pct(s.pct)}</small></td>
              <td />
              <td className="getal"><strong>{eur(s.inleg)}</strong></td>
              {s.per_factor.map((f) => <td key={f.factor} className="getal"><strong>{eur(f.waarde)}</strong></td>)}
              <td className="getal"><strong>{eur(s.schuld)}</strong></td>
              <td className="getal"><strong><Bereik min={Math.min(...s.per_factor.map((f) => f.netto))} max={Math.max(...s.per_factor.map((f) => f.netto))} /></strong></td>
              <td className="getal"><strong>{eur(s.dividend_netto)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    </MetBronnen>
  );
}

function Waarderingsverloop({ rijen, posities }) {
  if (!rijen?.length) return null;
  const naam = Object.fromEntries(posities.map((p) => [p.positie.id, KORT[p.positie.houder_code] ?? p.positie.houder]));
  const soortTekst = { vastgesteld: 'vastgesteld', berekend: 'berekend', doorgetrokken: 'doorgetrokken', inleg: 'instapprijs' };
  return (
    <MetBronnen>
    <section className="kaart">
      <h3>Waardering per jaar</h3>
      <p className="uitleg">
        Methode van de verkopers (B-PRES dia 7, B-WRD-2025): resultaat vóór belastingen van de drie voorgaande boekjaren,
        gewogen 1-2-3 (meest recent het zwaarst), × factor. De waardering per eind van een jaar is de prijs in het jaar
        erna (dia 5). Een vastgestelde waardering gaat voor; ontbreekt een jaarresultaat, dan loopt de waarde door. In het
        jaar van verkrijging telt de instapprijs. Eén waardering voor alle houders; jaarresultaten en prognoses voeg je
        toe onder Stamdata.
      </p>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Geldt in</th>
              <th>Resultaten (gewicht 1 · 2 · 3)</th>
              {rijen[0].per_factor.map((x) => <th key={x.factor} className="getal">×{num(x.factor)}: ondernemingswaarde · per aandeel · per houder</th>)}
            </tr>
          </thead>
          <tbody>
            {rijen.map((r) => (
              <tr key={r.jaar}>
                <td>{r.jaar}</td>
                <td>
                  {r.resultaten.map((x) => (
                    <span key={x.jaar} className="resultaat">
                      {x.jaar}: {x.resultaat == null ? '—' : eur(x.resultaat)}
                      {x.status && x.status !== 'werkelijk' && <small> ({x.status})</small>}
                    </span>
                  ))}
                </td>
                {r.per_factor.map((x) => (
                  <td key={x.factor} className="getal">
                    {x.ondernemingswaarde == null ? '—' : <>{eur(x.ondernemingswaarde)} · {eur(x.per_aandeel)}</>}
                    {x.soort !== 'inleg' && <><br /><small>{soortTekst[x.soort]}{x.soort === 'vastgesteld' || x.soort === 'doorgetrokken' ? `: ${x.bron}` : ''}</small></>}
                    <br />
                    {x.posities.map((p) => (
                      <small key={p.positie_id} className="resultaat">
                        {naam[p.positie_id]} {p.waarde == null ? '—' : <strong>{eur(p.waarde)}</strong>}
                        {p.soort === 'inleg' && ' (instapprijs)'}
                      </small>
                    ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
    </MetBronnen>
  );
}

function Aandachtspunten() {
  return (
    <MetBronnen>
    <section className="kaart">
      <h3>Open punten die de cijfers raken</h3>
      <ul>
        <li><strong>V-F40 / V-F54</strong> De rectificatie (13,5 aandelen privé) ligt als concept; nog niet gepasseerd. De akte van 2024 zegt nog 9 certificaten.</li>
        <li><strong>V-F44</strong> Factor ×3 of ×4 voor de Marktwaarde bij verkoop.</li>
        <li><strong>V-F47 / V-F48</strong> Tellen privé (4,5%) en holding (5,5%) samen tot een aanmerkelijk belang (10%), en tellen certificaten daarvoor als aandelen? Bepaalt box 2 of box 3 privé.</li>
        <li><strong>V-F19</strong> Deelnemingsvrijstelling bij de holding (art. 13 Wet VpB 1969).</li>
        <li><strong>V-F08</strong> Bijlage 3 (Marktwaarde per 31-12-2024) ontbreekt: basis onder de inleg van € 1.900/certificaat.</li>
      </ul>
      <p className="uitleg">Zie openstaande-vragen/REGISTER.md.</p>
    </section>
    </MetBronnen>
  );
}

function Vertrek() {
  // Eén vertrekdatum voor het aflosplan en de vertrekberekening; leeg = einde
  // looptijd (vult het aflosplan in zodra dat geladen is).
  const [invoer, setInvoer] = useState({ vertrekdatum: '', categorie: 'good', extra_korting: false });
  const [plan, setPlan] = useState(null);
  const [data, setData] = useState(null);
  const [fout, setFout] = useState(null);

  useEffect(() => {
    if (!invoer.vertrekdatum || !plan) return;
    const q = new URLSearchParams({ ...invoer, ...plan, extra_korting: String(invoer.extra_korting) });
    api.get(`/verra/leaver?${q}`).then(
      (d) => { setData(d); setFout(null); },
      (e) => setFout(e.message),
    );
  }, [invoer, plan]);

  const zet = (k, v) => setInvoer((i) => ({ ...i, [k]: v }));

  return (
    <MetBronnen>
    <>
      <Aflossen vertrek={invoer.vertrekdatum} onVertrek={(d) => zet('vertrekdatum', d)} onPlan={setPlan} />
      <section className="kaart">
        <h3>Wat houd je over bij vertrek?</h3>
        <p className="uitleg">
          Bij einde van de participatie moeten de certificaten worden aangeboden (art. 6) en wordt de lening
          terstond opeisbaar (F16); de geldgever mag verrekenen met de koopprijs (art. 4.2).
        </p>
        <div className="formulier">
          <label>
            <span>Vertrekdatum</span>
            <input type="date" value={invoer.vertrekdatum} onChange={(e) => e.target.value && zet('vertrekdatum', e.target.value)} />
          </label>
          <label>
            <span>Categorie</span>
            <select value={invoer.categorie} onChange={(e) => zet('categorie', e.target.value)}>
              <option value="good">Good leaver (art. 6.3)</option>
              <option value="early">Early leaver (art. 6.2)</option>
              <option value="bad">Bad leaver (art. 6.1)</option>
            </select>
          </label>
          <label className="vink">
            <input type="checkbox" checked={invoer.extra_korting} onChange={(e) => zet('extra_korting', e.target.checked)} />
            <span>Extra korting art. 6.5 (onbetaald verlof of gemiddeld &lt; 40 uur/week)</span>
          </label>
        </div>
      </section>

      {fout && <p className="fout">{fout}</p>}
      {data && !fout && (
        <section className="kaart">
          <h3>
            Jaar {data.jaar} na verkrijging · schuld op {datum(data.vertrekdatum)}: {eur(data.schuld.totaal)}
          </h3>
          {data.schuld.volgens_plan && <p className="uitleg">Schuld volgens het aflosplan hierboven.</p>}
          {data.regel ? (
            <p className="uitleg">
              Regel: {pct(data.regel.pct_marktwaarde)} van de Marktwaarde
              {data.regel.max_inleg && ', maximaal de inleg'}
              {data.extra_korting_pct > 0 && `, na ${pct(data.extra_korting_pct)} extra korting op de Marktwaarde`} ·{' '}
              {data.regel.bron}
            </p>
          ) : (
            <p className="fout">
              Geen leaverregel voor deze categorie in jaar {data.jaar}. Early leaver geldt alleen binnen de eerste 3
              jaar; wat daarna geldt bij vertrek op eigen initiatief moet uit de overeenkomst blijken.
            </p>
          )}
          {data.regel && (
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Waardering</th>
                    {data.noemers.map((n) => (
                      <th key={n.id} className="getal">
                        ÷ {n.aantal}
                        {n.aantal === data.rekenbasis && <><br /><small>rekenbasis</small></>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.matrix.map((m) => (
                    <tr key={m.waardering.id}>
                      <td>
                        {m.waardering.ondernemingswaarde == null ? 'Instapprijs' : eur(m.waardering.ondernemingswaarde)}{' '}
                        <small>{m.waardering.label}</small>
                        <br /><small>{m.waardering.toelichting}</small>
                      </td>
                      {m.cellen.map((c) => (
                        <td key={c.noemer} className="getal">
                          {eur(c.prijs)}/st{c.begrensd && <small> (= inleg)</small>}
                          <br />opbrengst {eur(c.opbrengst)}
                          <br />netto <strong><Netto n={c.netto} /></strong>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <ul className="uitleg">
            <li>
              <strong>De factor bepaalt deze bedragen.</strong> De <em>factor</em> (×3 of ×4) is een keuze binnen
              een bandbreedte die de verkopers zelf noemen — B-PRES dia 8: "je mag tussen de factor 3 en 4 waarderen".
              Beide rijen zijn daarom reëel. De <em>noemer</em> is 300 aandelen, zoals de verkopers rekenen (B-MAIL-2025-12,
              A11); de rectificatie die dat notarieel vastlegt, ligt als concept en is nog niet gepasseerd (V-F40, V-F54).
            </li>
            <li>Rekent met de waardering die in het vertrekjaar als prijs geldt (waardering per eind vorig jaar); bij vertrek stelt de STAK de Marktwaarde vast (art. 6.6.2). Bij de <em>koop</em> is de factor grotendeels herleid: de holdingtranche is tegen ×3 verworven (F56). Welke factor bij <em>verkoop</em> geldt, is open (V-F44).</li>
            <li>De STAK is niet verplicht de certificaten af te nemen (art. 6.4(i)) — de schuld wordt wel opeisbaar.</li>
            <li>Extra korting toegepast op de Marktwaarde vóór het leaverpercentage: een lezing van art. 6.5, niet vastgesteld.</li>
          </ul>
        </section>
      )}
    </>
    </MetBronnen>
  );
}

// ---------------------------------------------------------------------------
// Aflossen of aanhouden: liquiditeit tegenover schuld.

const plusMaanden = (d, n) => {
  const [j, m] = d.split('-').map(Number);
  const t = m - 1 + n;
  return `${j + Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-01`;
};
const maandenTussen = (a, b) => {
  const [ja, ma] = a.split('-').map(Number);
  const [jb, mb] = b.split('-').map(Number);
  return (jb - ja) * 12 + (mb - ma);
};
const jarenTussen = (van, tot) => {
  const lijst = [];
  for (let j = van; j <= tot; j++) lijst.push(j);
  return lijst;
};

function Schuif({ label, waarde, min, max, stap, onChange, toon, uitleg }) {
  return (
    <label className="schuif">
      <span className="schuif-kop"><span>{label}</span><strong>{toon(waarde)}</strong></span>
      <input type="range" min={min} max={max} step={stap} value={waarde} onChange={(e) => onChange(Number(e.target.value))} />
      {uitleg && <small>{uitleg}</small>}
    </label>
  );
}

function Aflossen({ vertrek, onVertrek, onPlan }) {
  const [extra, setExtra] = useState(0);
  const [eenmalig, setEenmalig] = useState(0);
  const [dividend, setDividend] = useState(null); // totaal vennootschap; null = server kiest
  const [perJaar, setPerJaar] = useState({}); // jaar -> totaal vennootschap
  const [waardeBasis, setWaardeBasis] = useState(''); // '' = eerste factor uit de stamdata
  const [groei, setGroei] = useState(0);
  const [beleid, setBeleid] = useState('verplicht');
  const [box2Vanaf, setBox2Vanaf] = useState(''); // '' = server kiest (2026), 'nooit' = alle jaren box 3
  const [rendement, setRendement] = useState(2);
  const setVertrek = onVertrek;
  const [data, setData] = useState(null);
  const [fout, setFout] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const plan = {
        extra_per_maand: extra,
        eenmalig,
        beleid,
        box2_vanaf: box2Vanaf,
        dividenden: Object.entries(perJaar).map(([j, v]) => `${j}:${v}`).join(','),
        ...(dividend === null ? {} : { dividend_totaal: dividend }),
      };
      const q = new URLSearchParams({ ...plan, rendement_pct: rendement, waarde: waardeBasis, groei_pct: groei, vertrekdatum: vertrek });
      api.get(`/verra/simulatie?${q}`).then(
        (d) => {
          setData(d);
          setFout(null);
          if (!vertrek) setVertrek(d.einde);
          if (dividend === null) setDividend(Math.round(d.plan.standaard_totaal));
          onPlan({ ...plan, dividend_totaal: d.plan.standaard_totaal });
        },
        (e) => setFout(e.message),
      );
    }, 150);
    return () => clearTimeout(timer.current);
  }, [extra, eenmalig, dividend, perJaar, waardeBasis, groei, beleid, box2Vanaf, rendement, vertrek]);

  if (fout) return <p className="fout">{fout}</p>;
  if (!data) return <section className="kaart"><p className="uitleg">Laden…</p></section>;

  const k = data.keuze;
  const bs = data.basis;
  const effect = k.bij_vertrek.netto - bs.bij_vertrek.netto;
  const maanden = maandenTussen(data.vanaf, data.einde);
  const vertrekIndex = Math.min(maanden, Math.max(0, maandenTussen(data.vanaf, data.vertrekdatum)));
  const schuldMax = Math.ceil(data.schuld_nu / 100) * 100;
  const rente = Number(data.lening.rente_pct);
  const reeks = (sim, veld) => sim.reeks.map((p) => ({ datum: p.datum, waarde: p[veld] }));
  const verschilReeks = k.reeks.map((p, i) => ({ datum: p.datum, waarde: p.netto - bs.reeks[i].netto }));

  return (
    <MetBronnen>
    <section className="kaart">
      <h3>Aflossen of aanhouden</h3>
      <p className="uitleg">
        Wat doet extra aflossen met je schuld, met je eigen geld en met je vermogen? Vergeleken met alleen de
        verplichte aflossing ({pct(data.lening.aflossing_pct)} van het {data.lening.grondslag} dividend). Aflossen mag
        altijd boetevrij (art. 3.3). Bij vertrek wordt de resterende schuld direct opeisbaar (F16).
      </p>
      <div className="schuiven">
        <Schuif label="Extra aflossen per maand" waarde={extra} min={0} max={1000} stap={25} onChange={setExtra} toon={eur} />
        <Schuif label="Eenmalig nu aflossen" waarde={Math.min(eenmalig, schuldMax)} min={0} max={schuldMax} stap={100} onChange={setEenmalig} toon={eur} />
        <div className="schuif-groep">
          <Schuif label="Dividend vennootschap per jaar (totaal)" waarde={dividend ?? 0} min={0} max={250000} stap={1000} onChange={setDividend} toon={eur}
            uitleg={`Jouw deel: ${pct((data.plan.aandeel ?? 0) * 100)} = ${eur((dividend ?? 0) * (data.plan.aandeel ?? 0))} bruto. Per jaar aan te passen in de tabel.`} />
          <label className="schuif-keuze">
            <span>Dividend gebruiken voor</span>
            <select value={beleid} onChange={(e) => setBeleid(e.target.value)}>
              <option value="verplicht">alleen de verplichte {pct(data.lening.aflossing_pct)} aflossen</option>
              <option value="netto">alles aflossen (netto, zoals het ROI-model)</option>
            </select>
          </label>
        </div>
        <Schuif label="Rendement op geld dat je niet aflost" waarde={rendement} min={0} max={10} stap={0.25} onChange={setRendement} toon={pct}
          uitleg={`Netto, bijv. spaarrente. Onder ${pct(rente)} levert aflossen meer op.`} />
        <Schuif label="Vertrekdatum" waarde={vertrekIndex} min={0} max={maanden} stap={1}
          onChange={(n) => setVertrek(n >= maanden ? data.einde : n === 0 ? data.vanaf : plusMaanden(data.vanaf, n))}
          toon={() => datum(data.vertrekdatum)} uitleg="Geldt ook voor de berekening hieronder" />
        <Schuif label="Waardegroei na laatste waardering" waarde={groei} min={-10} max={15} stap={0.5} onChange={setGroei} toon={pct}
          uitleg="Alleen voor jaren zonder waardering of jaarresultaten; die gaan altijd voor" />
      </div>
      <div className="keuzes">
        <span>
          Rekenbasis <strong>{num(data.positie.aantal_rekenbasis)} van {data.plan.noemer} aandelen = {pct((data.plan.aandeel ?? 0) * 100)}</strong>
        </span>
        <label>
          Waarde certificaten{' '}
          <select value={String(data.plan.waarde_basis)} onChange={(e) => setWaardeBasis(e.target.value)}>
            {data.factoren.map((f) => <option key={f} value={String(f)}>waardering ×{num(f)} (jaarresultaten, stamdata)</option>)}
            <option value="inleg">inleg (zoals het oude ROI-model)</option>
          </select>
        </label>
        <label>
          Belasting op dividend{' '}
          <select value={String(data.plan.box2_vanaf ?? 'nooit')} onChange={(e) => setBox2Vanaf(e.target.value)}>
            <option value="nooit">box 3, alle jaren (15% dividendbelasting verrekend)</option>
            {jarenTussen(Math.min(Number(data.vanaf.slice(0, 4)), data.plan.box2_vanaf ?? 9999), Number(data.einde.slice(0, 4))).map((j) => (
              <option key={j} value={String(j)}>box 3, box 2 (24,5%) vanaf {j}</option>
            ))}
          </select>{' '}
          <small>V-F47, A13</small>
        </label>
      </div>

      <div className="kpis">
        <Kpi titel="Schuldvrij op" waarde={k.schuldvrij_op ? datum(k.schuldvrij_op) : 'niet binnen looptijd'}
          sub={bs.schuldvrij_op ? `alleen verplicht: ${datum(bs.schuldvrij_op)}` : `alleen verplicht: niet (${eur(bs.reeks.at(-1).schuld)} bij einde)`} />
        <Kpi titel={`Schuld bij vertrek (${datum(data.vertrekdatum)})`} waarde={eur(k.bij_vertrek.schuld)}
          sub={`alleen verplicht: ${eur(bs.bij_vertrek.schuld)}`} />
        <Kpi titel="Eigen geld in aflossing" waarde={eur(k.eigen_geld_ingezet)} sub="extra + eenmalig, tot einde looptijd" />
        <Kpi titel="Rente tot einde looptijd" waarde={eur(k.rente)} sub={`${eur(bs.rente - k.rente)} minder dan alleen verplicht`} />
        <Kpi titel="Vermogenseffect bij vertrek" waarde={<Netto n={effect} />}
          sub={effect >= 0 ? 'rijker door extra aflossen' : 'armer door extra aflossen'} />
      </div>

      <div className="twee">
        <Grafiek
          titel="Schuld inclusief opgelopen rente"
          reeksen={[
            { naam: 'Met extra aflossen', kortNaam: 'met extra', kleur: '--reeks-1', punten: reeks(k, 'schuld') },
            { naam: 'Alleen verplichte aflossing', kortNaam: 'alleen verplicht', kleur: '--reeks-2', punten: reeks(bs, 'schuld') },
          ]}
          markering={{ datum: data.vertrekdatum, label: 'vertrek' }}
        />
        <Grafiek
          titel="Vermogenseffect van extra aflossen (eigen geld − schuld, t.o.v. alleen verplicht)"
          reeksen={[{ naam: 'Vermogenseffect', kortNaam: 'effect', kleur: '--reeks-3', punten: verschilReeks }]}
          markering={{ datum: data.vertrekdatum, label: 'vertrek' }}
          nulLijn
        />
      </div>
      <Jaaroverzicht
        jaren={data.jaren}
        inleg={data.positie.inleg}
        waardeLabel={data.plan.waarde_basis === 'inleg' ? 'inleg' : `waarderingen ×${num(data.plan.waarde_basis)} ÷ ${data.plan.noemer} × ${num(data.positie.aantal_rekenbasis)}`}
        perJaar={perJaar}
        standaard={dividend ?? 0}
        huidigJaar={Number(data.vanaf.slice(0, 4))}
        onDividend={(j, v) => setPerJaar((p) => {
          const n = { ...p };
          if (v === '') delete n[j];
          else n[j] = Number(v);
          return n;
        })}
      />
      <ul className="uitleg">
        <li>
          Liquiditeit tegenover vermogen: elke euro die je aflost, verdient {pct(rente)} (de rente die je niet meer
          betaalt), maar is niet meer vrij beschikbaar. Haal je elders meer dan {pct(rente)} netto, dan levert aanhouden
          meer op.
        </li>
        <li>
          Bij vertrek wordt de schuld opeisbaar en mag de geldgever verrekenen met de koopprijs (art. 4.2). Een lagere
          schuld verkleint het risico bij een bad-leaverprijs (tab hieronder).
        </li>
        <li>
          Dividend na belasting volgens de gekozen box; de box 3-heffing over het vermogen zit er niet in. In box 3
          verlagen de schuld en het spaargeld allebei je grondslag, wat het verschil ongeveer neutraal houdt. In box 2 is
          de rente mogelijk aftrekbaar, wat aflossen minder aantrekkelijk maakt. Of en vanaf wanneer box 2 geldt, is open
          (V-F47, V-F49).
        </li>
      </ul>
    </section>
    </MetBronnen>
  );
}

function Jaaroverzicht({ jaren, inleg, waardeLabel, perJaar, standaard, huidigJaar, onDividend }) {
  const laatste = jaren.rijen.at(-1);
  return (
    <MetBronnen>
    <div className="jaaroverzicht">
      <h4>Jaaroverzicht</h4>
      <p className="uitleg">
        Zelfde opbouw als het eigen ROI-model: vermogen = waarde certificaten ({waardeLabel}) − schuld; netto resultaat
        = vermogen + cumulatief kasoverschot (netto dividend − aflossingen). Jaren tot vandaag zijn werkelijk; daarna het
        plan. Het dividend van toekomstige jaren kun je hier per jaar invullen.
      </p>
      <div className="kpis">
        <div className="kpi"><div className="kpi-titel">Resterende lening {laatste?.jaar}</div><div className="kpi-waarde">{eur(jaren.rest_schuld)}</div>
          <div className="kpi-sub">op 1 januari {laatste ? laatste.jaar + 1 : ''}</div></div>
        <div className="kpi"><div className="kpi-titel">Netto resultaat</div><div className="kpi-waarde"><Netto n={laatste?.resultaat ?? 0} /></div>
          <div className="kpi-sub">vermogen + kasoverschot</div></div>
        <div className="kpi"><div className="kpi-titel">Totaal ROI</div><div className="kpi-waarde">{jaren.roi_pct == null ? '—' : pct(Math.round(jaren.roi_pct * 10) / 10)}</div>
          <div className="kpi-sub">netto resultaat ÷ inleg {eur(inleg)}</div></div>
      </div>
      <div className="scroll">
        <table className="jaren">
          <thead>
            <tr>
              <th>Jaar</th>
              <th className="getal">Lening 1-1</th>
              <th className="getal">Rente</th>
              <th className="getal">Dividend vennootschap</th>
              <th className="getal">Netto dividend</th>
              <th className="getal">Aflossing</th>
              <th className="getal">Lening 31-12</th>
              <th className="getal">Waarde certificaten</th>
              <th className="getal">Vermogen</th>
              <th className="getal">Cum. kasoverschot</th>
              <th className="getal">Netto resultaat</th>
            </tr>
          </thead>
          <tbody>
            {jaren.rijen.map((r) => {
              const bewerkbaar = r.jaar >= huidigJaar && !r.dividend_werkelijk;
              return (
                <tr key={r.jaar}>
                  <td>{r.jaar}{r.historie && <small> {r.jaar < huidigJaar ? 'werkelijk' : 'deels werkelijk'}</small>}</td>
                  <td className="getal">{eur(r.begin_schuld)}</td>
                  <td className="getal">{eur(r.rente)}</td>
                  <td className="getal">
                    {bewerkbaar ? (
                      <input
                        type="number"
                        step="1000"
                        min="0"
                        className="cel"
                        placeholder={r.jaar === huidigJaar ? '0' : String(standaard)}
                        value={perJaar[r.jaar] ?? ''}
                        onChange={(e) => onDividend(r.jaar, e.target.value)}
                        aria-label={`Dividend vennootschap ${r.jaar}`}
                      />
                    ) : eur(r.dividend_totaal)}
                  </td>
                  <td className="getal">{eur(r.dividend_netto)}</td>
                  <td className="getal">{eur(r.afgelost)}</td>
                  <td className="getal">{eur(r.eind_schuld)}</td>
                  <td className="getal">{eur(r.waarde)}{r.waarde_bron && <><br /><small>{r.waarde_bron}</small></>}</td>
                  <td className="getal"><Netto n={r.vermogen} /></td>
                  <td className="getal"><Netto n={r.cum_kas} /></td>
                  <td className="getal"><strong><Netto n={r.resultaat} /></strong></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="uitleg">
        Leeg dividendveld = de schuif (lopend jaar: geen dividend, tenzij ingevuld). De inleg is volledig geleend; de ROI
        is dus een rendement op een geleend bedrag, niet op eigen geld.
      </p>
    </div>
    </MetBronnen>
  );
}
