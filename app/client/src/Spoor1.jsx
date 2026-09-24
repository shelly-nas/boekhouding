import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import CrudTabel from './CrudTabel.jsx';
import Grafiek from './Grafiek.jsx';
import { datum, eur, eurc, pct, vandaag } from './format.js';

const ONDERDELEN = ['Overzicht', 'Vertrek', 'Stamdata'];

export default function Spoor1() {
  const [onderdeel, setOnderdeel] = useState(() => {
    const deel = new URLSearchParams(location.search).get('deel');
    return ONDERDELEN.includes(deel) ? deel : 'Overzicht';
  });
  return (
    <>
      <nav className="subtabs">
        {ONDERDELEN.map((o) => (
          <button key={o} className={o === onderdeel ? 'actief' : ''} onClick={() => setOnderdeel(o)}>
            {o}
          </button>
        ))}
      </nav>
      {onderdeel === 'Overzicht' && <Overzicht />}
      {onderdeel === 'Vertrek' && <Vertrek />}
      {onderdeel === 'Stamdata' && <Stamdata />}
    </>
  );
}

const Netto = ({ n }) => <span className={n < 0 ? 'neg' : 'pos'}>{eur(n)}</span>;
const Bereik = ({ min, max, kleur = true }) => {
  const B = kleur ? Netto : ({ n }) => eur(n);
  return Math.round(min) === Math.round(max) ? <B n={min} /> : <><B n={min} /> tot <B n={max} /></>;
};

function Overzicht() {
  const [peildatum, setPeildatum] = useState(vandaag());
  const [data, setData] = useState(null);
  const [fout, setFout] = useState(null);

  useEffect(() => {
    if (!peildatum) return;
    api.get(`/spoor1/overzicht?peildatum=${peildatum}`).then(setData, (e) => setFout(e.message));
  }, [peildatum]);

  if (fout) return <p className="fout">{fout}</p>;
  if (!data) return <p className="uitleg">Laden…</p>;

  return (
    <>
      <div className="balk">
        <label>
          Peildatum <input type="date" value={peildatum} onChange={(e) => setPeildatum(e.target.value)} />
        </label>
      </div>
      {data.posities.map((p) => <Positie key={p.positie.id} p={p} />)}
      {!data.posities.length && <p className="uitleg">Nog geen certificaatpositie in spoor 1 — voeg er een toe onder Stamdata.</p>}
      <Tijdlijn items={data.gebeurtenissen} />
      <Aandachtspunten />
    </>
  );
}

function Positie({ p }) {
  const waarden = p.matrix.flatMap((m) => m.cellen.map((c) => c.waarde));
  return (
    <>
      <h2>
        {p.positie.aantal} certificaten {p.positie.vennootschap} <small>· {p.positie.houder}</small>
      </h2>
      <div className="kpis">
        <Kpi titel="Inleg" waarde={eur(p.positie.inleg)} sub={`verkregen ${datum(p.positie.verkregen_op)}`} />
        <Kpi
          titel="Schuld op peildatum"
          waarde={eur(p.schuld.totaal)}
          sub={p.schuld.opgelopen_rente ? `waarvan ${eur(p.schuld.opgelopen_rente)} opgelopen rente` : 'geen lening'}
        />
        <Kpi
          titel="Waarde certificaten"
          waarde={waarden.length ? <Bereik min={Math.min(...waarden)} max={Math.max(...waarden)} kleur={false} /> : '—'}
          sub="afhankelijk van noemer en waardering"
        />
        <Kpi
          titel="Netto positie"
          waarde={p.netto_bandbreedte ? <Bereik {...p.netto_bandbreedte} /> : '—'}
          sub="waarde − schuld"
        />
        <Kpi
          titel="Dividend ontvangen (netto)"
          waarde={eur(p.dividend_totaal.netto)}
          sub={`bruto ${eur(p.dividend_totaal.bruto)}, tot peildatum`}
        />
      </div>

      <section className="kaart">
        <h3>Waarde en netto positie</h3>
        <p className="uitleg">
          Ondernemingswaarde ÷ noemer × {p.positie.aantal} certificaten, min de schuld op de peildatum. Welke noemer
          geldt is open (V-O01).
        </p>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Waardering</th>
                {p.noemers.map((n) => <th key={n.id} className="getal">÷ {n.aantal}<br /><small>{n.label}</small></th>)}
              </tr>
            </thead>
            <tbody>
              {p.matrix.map((m) => (
                <tr key={m.waardering.id}>
                  <td>
                    {eur(m.waardering.ondernemingswaarde)} <small>{m.waardering.label}</small>
                    <br /><small>{datum(m.waardering.peildatum)} · {m.waardering.bron}</small>
                  </td>
                  {m.cellen.map((c) => (
                    <td key={c.noemer} className="getal">
                      {eur(c.waarde)} <small>({eur(c.per_certificaat)}/st)</small>
                      <br />netto <Netto n={c.netto} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {p.lening && <Schuldverloop p={p} />}
      {p.dividend_toets && <DividendToets t={p.dividend_toets} />}

      <section className="kaart">
        <h3>Wanneer levert het op?</h3>
        <p className="uitleg">
          De certificaten zijn niet vrij verkoopbaar (art. 5.1). Opbrengst komt alleen uit dividend of bij vertrek
          (tab Vertrek). Hieronder: hoeveel dividend de vennootschap in totaal moet uitkeren, bij een jaarrente van{' '}
          {eur(p.jaarrente)}.
        </p>
        <table>
          <thead>
            <tr>
              <th>Noemer</th>
              <th className="getal">Belang</th>
              <th>Box (indicatief)</th>
              <th className="getal">Totaal dividend om rente te dekken</th>
              <th className="getal">Totaal dividend waarbij schuld niet groeit</th>
            </tr>
          </thead>
          <tbody>
            {p.box.map((b, i) => {
              const be = p.break_even[i];
              return (
                <tr key={b.noemer}>
                  <td>{b.noemer} <small>{b.label}</small></td>
                  <td className="getal">{pct(b.pct)}</td>
                  <td>box {b.box} <small>{b.grond}</small></td>
                  <td className="getal">{eur(be?.dividend_rente_dekken)}</td>
                  <td className="getal">{eur(be?.dividend_schuld_stilstand)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="uitleg">
          "Niet groeit": de verplichte aflossing ({pct(p.lening?.aflossing_uit_dividend_pct)} van het ontvangen
          dividend) is gelijk aan de rente. Een lucratief belang (box 1, art. 3.92b Wet IB 2001) is niet uitgesloten —
          V-F09.
        </p>
      </section>
    </>
  );
}

function Kpi({ titel, waarde, sub }) {
  return (
    <div className="kpi">
      <div className="kpi-titel">{titel}</div>
      <div className="kpi-waarde">{waarde}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

function Schuldverloop({ p }) {
  const l = p.lening;
  return (
    <section className="kaart">
      <h3>Schuldverloop — {l.omschrijving}</h3>
      <p className="uitleg">
        {eur(l.hoofdsom)} van {l.geldgever} · {pct(l.rente_pct)} rente,{' '}
        {l.rente_bijschrijven ? 'bijgeschreven (rente over rente)' : 'betaald'}{' '}
        {l.rente_periode === 'kalenderjaar' ? 'op 31-12 van elk jaar' : 'op de jaardag van de lening'} · looptijd
        tot {datum(l.einddatum)} · vrijwillig aflossen mag altijd. Opeisbaar bij einde participatie.
      </p>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Periode</th>
              <th className="getal">Begin</th>
              <th className="getal">Rente</th>
              <th className="getal">Afgelost</th>
              <th className="getal">Eind</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {p.verloop.map((r) => (
              <tr key={r.jaar} className={r.prognose ? 'prognose' : ''}>
                <td>{datum(r.start)} – {datum(r.eind)}</td>
                <td className="getal">{eur(r.beginsaldo)}</td>
                <td className="getal">{eur(r.rente)}{r.rente_betaald ? ' (betaald)' : ''}</td>
                <td className="getal">{eur(r.afgelost)}</td>
                <td className="getal"><strong>{eur(r.eindsaldo)}</strong></td>
                <td><small>{r.prognose ? 'prognose' : ''}</small></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="uitleg">Prognose rekent alleen met al ingevoerde dividenden en aflossingen.</p>
    </section>
  );
}

function DividendToets({ t }) {
  return (
    <section className="kaart">
      <h3>Aflossingsverplichting uit dividend</h3>
      <p className="uitleg">
        B-GL-2024 art. 3.2: {pct(t.pct)} van het jaarlijks toekomende dividend gaat als aflossing naar de geldgever,
        hier gerekend over het <strong>{t.grondslag}</strong> dividend. Geen dividend is geen verplichting (art. 3.1).
        Niet nakomen maakt de lening na ingebrekestelling direct opeisbaar (art. 4.1(c)).
      </p>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Jaar</th>
              <th className="getal">Dividend bruto</th>
              <th className="getal">Netto</th>
              <th className="getal">Verplicht</th>
              <th className="getal">Afgelost</th>
              <th className="getal">Verschil</th>
              <th className="getal">Cumulatief</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {t.rijen.map((r) => (
              <tr key={r.jaar}>
                <td>{r.jaar}</td>
                <td className="getal">{eur(r.dividend_bruto)}</td>
                <td className="getal">{eur(r.dividend_netto)}</td>
                <td className="getal">{eurc(r.verplicht)}</td>
                <td className="getal">{eurc(r.afgelost)}</td>
                <td className="getal"><Netto n={r.verschil} /></td>
                <td className="getal"><Netto n={r.cum_verschil} /></td>
                <td className={r.status === 'tekort' ? 'neg' : ''}>{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="uitleg">
        Het contract noemt geen betaaltermijn. Per jaar tellen alle aflossingen in hetzelfde kalenderjaar mee;
        "Cumulatief" laat zien of je over de hele looptijd voorloopt of achterloopt.
      </p>
    </section>
  );
}

function Tijdlijn({ items }) {
  const nu = vandaag();
  return (
    <section className="kaart">
      <h3>Tijdlijn</h3>
      <ul className="tijdlijn">
        {items.map((g) => (
          <li key={g.id} className={g.datum < nu ? 'verleden' : ''}>
            <strong>{datum(g.datum)}</strong> {g.omschrijving} <small>{g.bron}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Aandachtspunten() {
  return (
    <section className="kaart">
      <h3>Open punten die de cijfers raken</h3>
      <ul>
        <li><strong>V-O01</strong> Noemer 100, 200 of 300: bepaalt waarde, leaverprijs én box 2 of 3.</li>
        <li><strong>V-F08</strong> Bijlage 3 (Marktwaarde per 31-12-2024) ontbreekt: basis onder de inleg van € 1.900/st.</li>
        <li><strong>V-F09</strong> Zakelijkheid 5% rente op onbezekerde lening; lucratief belang.</li>
        <li><strong>V-F14</strong> Verwerking lening in aangifte IB 2024 en 2025.</li>
        <li><strong>V-F28</strong> Valt de privépositie binnen de opdracht?</li>
      </ul>
      <p className="uitleg">Zie openstaande-vragen/REGISTER.md.</p>
    </section>
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
    api.get(`/spoor1/leaver?${q}`).then(
      (d) => { setData(d); setFout(null); },
      (e) => setFout(e.message),
    );
  }, [invoer, plan]);

  const zet = (k, v) => setInvoer((i) => ({ ...i, [k]: v }));

  return (
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
                    {data.noemers.map((n) => <th key={n.id} className="getal">÷ {n.aantal}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.matrix.map((m) => (
                    <tr key={m.waardering.id}>
                      <td>{eur(m.waardering.ondernemingswaarde)} <small>{m.waardering.label}</small></td>
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
            <li>Rekent met de meest recente waardering vóór de vertrekdatum; bij vertrek stelt de STAK de Marktwaarde vast (art. 6.6.2).</li>
            <li>De STAK is niet verplicht de certificaten af te nemen (art. 6.4(i)) — de schuld wordt wel opeisbaar.</li>
            <li>Extra korting toegepast op de Marktwaarde vóór het leaverpercentage: een lezing van art. 6.5, niet vastgesteld.</li>
          </ul>
        </section>
      )}
    </>
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
  const [dividend, setDividend] = useState(null);
  const [rendement, setRendement] = useState(2);
  const setVertrek = onVertrek;
  const [data, setData] = useState(null);
  const [fout, setFout] = useState(null);
  const timer = useRef(null);

  // Startwaarde dividend: het laatst ontvangen bruto dividend.
  useEffect(() => {
    api.get('/data/dividend?spoor=1').then(
      (d) => setDividend(d.at(-1)?.bruto ?? 0),
      () => setDividend(0),
    );
  }, []);

  useEffect(() => {
    if (dividend === null) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const q = new URLSearchParams({
        extra_per_maand: extra, eenmalig, dividend_per_jaar: dividend, rendement_pct: rendement, vertrekdatum: vertrek,
      });
      api.get(`/spoor1/simulatie?${q}`).then(
        (d) => {
          setData(d);
          setFout(null);
          if (!vertrek) setVertrek(d.einde);
          onPlan({ extra_per_maand: extra, eenmalig, dividend_per_jaar: dividend });
        },
        (e) => setFout(e.message),
      );
    }, 120);
    return () => clearTimeout(timer.current);
  }, [extra, eenmalig, dividend, rendement, vertrek]);

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
        <Schuif label="Verwacht dividend per jaar (bruto)" waarde={dividend} min={0} max={10000} stap={50} onChange={setDividend} toon={eur}
          uitleg="Aanname; uitkering elk jaar rond 8 mei zoals in 2025" />
        <Schuif label="Rendement op geld dat je niet aflost" waarde={rendement} min={0} max={10} stap={0.25} onChange={setRendement} toon={pct}
          uitleg={`Netto, bijv. spaarrente. Onder ${pct(rente)} levert aflossen meer op.`} />
        <Schuif label="Vertrekdatum" waarde={vertrekIndex} min={0} max={maanden} stap={1}
          onChange={(n) => setVertrek(n >= maanden ? data.einde : n === 0 ? data.vanaf : plusMaanden(data.vanaf, n))}
          toon={() => datum(data.vertrekdatum)} uitleg="Geldt ook voor de berekening hieronder" />
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
          Vóór inkomstenbelasting. In box 3 verlagen de schuld en het spaargeld allebei je grondslag, wat het verschil
          ongeveer neutraal houdt. In box 2 is de rente mogelijk aftrekbaar, wat aflossen minder aantrekkelijk maakt. Welke
          box geldt, is open (V-O01, V-F14).
        </li>
      </ul>
    </section>
  );
}

const STAMDATA = ['certificaatpositie', 'lening', 'dividend', 'aflossing', 'waardering', 'noemer', 'leaver_regel', 'entiteit', 'gebeurtenis', 'instelling'];

function Stamdata() {
  const [meta, setMeta] = useState(null);
  useEffect(() => {
    api.get('/meta').then(setMeta);
  }, []);
  if (!meta) return <p className="uitleg">Laden…</p>;
  return STAMDATA.map((n) => <CrudTabel key={n} naam={n} meta={meta} spoor={1} />);
}
