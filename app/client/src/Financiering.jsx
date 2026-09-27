import { useEffect, useState } from 'react';
import { api } from './api.js';
import { datum, eur, eurc, num, pct, vandaag } from './format.js';
import { KORT, Kpi, Netto, Stamdata, useOnderdeel } from './onderdelen.jsx';
import { MetBronnen } from './bronnen.jsx';

// Financiering: alle leningen van privé en holding naast elkaar. Voor een
// lening die in de administratie van de holding wordt geboekt, is het journaal
// leidend; het boeken van rente en het afstemmen staat onder Administratie.

const ONDERDELEN = ['Overzicht', 'Stamdata'];
const STAMDATA = ['lening', 'aflossing', 'overeenkomst'];

export default function Financiering() {
  const [onderdeel, nav] = useOnderdeel(ONDERDELEN);
  return (
    <>
      {nav}
      {onderdeel === 'Overzicht' && <Overzicht />}
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
    api.get(`/financiering/leningen?peildatum=${peildatum}`).then(setData, (e) => setFout(e.message));
  }, [peildatum]);

  if (fout) return <p className="fout">{fout}</p>;
  if (!data) return <p className="uitleg">Laden…</p>;
  const samen = data.totalen.reduce((s, t) => s + t.schuld, 0);

  return (
    <MetBronnen>
    <>
      <div className="balk">
        <label>
          Peildatum <input type="date" value={peildatum} onChange={(e) => setPeildatum(e.target.value)} />
        </label>
      </div>
      <div className="kpis">
        {data.totalen.map((t) => (
          <Kpi key={t.code} titel={`Schuld ${KORT[t.code] ?? t.partij}`} waarde={eur(t.schuld)}
            sub={t.aantal ? `${t.aantal} lening${t.aantal > 1 ? 'en' : ''}, hoofdsom ${eur(t.hoofdsom)}${t.rente ? `, waarvan ${eur(t.rente)} opgelopen rente` : ''}` : 'geen leningen'} />
        ))}
        <Kpi titel="Samen" waarde={eur(samen)} sub={`op ${datum(data.peildatum)}`} />
      </div>
      <section className="kaart">
        <h3>Leningen</h3>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Lening</th>
                <th>Geldgever → schuldenaar</th>
                <th className="getal">Hoofdsom</th>
                <th className="getal">Rente</th>
                <th>Looptijd tot</th>
                <th className="getal">Afgelost</th>
                <th className="getal">Schuld</th>
                <th>Financiert</th>
              </tr>
            </thead>
            <tbody>
              {data.leningen.map((l) => (
                <tr key={l.id}>
                  <td>{l.omschrijving}<br /><small>{l.bron}</small></td>
                  <td>{l.geldgever} → {l.schuldenaar}</td>
                  <td className="getal">{eurc(l.hoofdsom)}</td>
                  <td className="getal">{pct(l.rente_pct)}<br /><small>{l.rente_bijschrijven ? 'bijgeschreven' : 'betaald'}</small></td>
                  <td>{datum(l.einddatum)}</td>
                  <td className="getal">{eurc(l.afgelost)}<br /><small>volgens {l.aflossingen_bron}</small></td>
                  <td className="getal"><strong>{eurc(l.schuld.totaal)}</strong></td>
                  <td>{l.positie_id ? `${num(l.positie_aandelen)} aandelen ${l.positie_houder}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {data.leningen.map((l) => (
        <Lening key={l.id} l={l} />
      ))}
    </>
    </MetBronnen>
  );
}

function Lening({ l }) {
  return (
    <MetBronnen>
    <section className="kaart">
      <h3>{l.omschrijving}</h3>
      <p className="uitleg">
        {eur(l.hoofdsom)} van {l.geldgever} aan {l.schuldenaar} · {pct(l.rente_pct)} rente,{' '}
        {l.rente_bijschrijven ? 'bijgeschreven (rente over rente)' : 'betaald'}{' '}
        {l.rente_periode === 'kalenderjaar' ? 'op 31-12 van elk jaar' : 'op de jaardag van de lening'} · looptijd tot{' '}
        {datum(l.einddatum)} · {l.bron}
        {l.aflossingen_bron === 'journaal' && ' · aflossingen uit het journaal van de holding (Administratie)'}
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
            {l.verloop.map((r) => (
              <tr key={r.start} className={r.prognose ? 'prognose' : ''}>
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
      <p className="uitleg">
        Prognose rekent alleen met al vastgelegde aflossingen.
        {l.schuldenaar_code === 'prive' && ' Aflossen of aanhouden, en wat er bij vertrek overblijft: Verra A&V → Vertrek privé.'}
      </p>
      {l.dividend_toets && <DividendToets t={l.dividend_toets} bron={l.bron} />}
    </section>
    </MetBronnen>
  );
}

function DividendToets({ t, bron }) {
  // Onderdeel 4.1(c) is alleen voor B-GL-2024 nagelezen.
  const opeisbaar = bron === 'B-GL-2024' ? 'art. 4.1(c)' : 'art. 4.1';
  return (
    <MetBronnen>
    <>
      <h4>Aflossingsverplichting uit dividend</h4>
      <p className="uitleg">
        {pct(t.pct)} van het jaarlijks toekomende dividend gaat als aflossing naar de geldgever, hier gerekend over het{' '}
        <strong>{t.grondslag}</strong> dividend ({bron} art. 3.2). Geen dividend is geen verplichting (art. 3.1). Niet
        nakomen maakt de lening na ingebrekestelling direct opeisbaar ({opeisbaar}).
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
    </>
    </MetBronnen>
  );
}
