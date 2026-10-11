import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import CrudTabel from './CrudTabel.jsx';
import { conceptOvereenkomst } from './overeenkomst.js';
import Prive from './Prive.jsx';
import { Jaarrekening, Vpb } from './Jaarrekening.jsx';
import { datum, eurc, pct, vandaag } from './format.js';
import { MetBronnen } from './bronnen.jsx';

const ONDERDELEN = ['Overzicht', 'Journaal', 'Grootboek', 'Leningen', 'Jaarrekening', 'VpB', 'Stamdata'];

// Administratie per eigen partij. Dreves Holding B.V. voert een volledige
// boekhouding (art. 2:10 BW, art. 52 AWR); privé gaat het om het vermogen en
// de fiscale posities die daarbij horen.
export default function Administratie() {
  const [partij, setPartij] = useState(() => (new URLSearchParams(location.search).get('partij') === 'prive' ? 'prive' : 'holding'));
  const kies = (p) => {
    setPartij(p);
    const q = new URLSearchParams(location.search);
    q.set('partij', p);
    q.delete('deel');
    history.replaceState(null, '', `?${q}`);
  };
  return (
    <>
      <nav className="partijkeuze">
        <button className={partij === 'holding' ? 'actief' : ''} onClick={() => kies('holding')}>Dreves Holding B.V. <small>VpB · volledige boekhouding</small></button>
        <button className={partij === 'prive' ? 'actief' : ''} onClick={() => kies('prive')}>Privé A. Dreves <small>IB · vermogen</small></button>
      </nav>
      {partij === 'holding' ? <Holding /> : <Prive />}
    </>
  );
}

function Holding() {
  const [onderdeel, setOnderdeel] = useState(() => {
    const deel = new URLSearchParams(location.search).get('deel');
    return ONDERDELEN.includes(deel) ? deel : 'Overzicht';
  });
  const [boekjaren, setBoekjaren] = useState([]);
  const [boekjaarId, setBoekjaarId] = useState(null);
  const [rekeningen, setRekeningen] = useState([]);
  const [versie, setVersie] = useState(0);
  const ververs = () => setVersie((v) => v + 1);

  useEffect(() => {
    api.get('/data/boekjaar?partij=holding').then((bj) => {
      setBoekjaren(bj);
      setBoekjaarId((id) => id ?? bj.find((b) => b.start <= vandaag() && vandaag() <= b.eind)?.id ?? bj.at(-1)?.id);
    });
    api.get('/data/grootboekrekening').then(setRekeningen);
  }, [versie]);

  const boekjaar = boekjaren.find((b) => b.id === boekjaarId);

  return (
    <>
      <nav className="subtabs">
        {ONDERDELEN.map((o) => (
          <button key={o} className={o === onderdeel ? 'actief' : ''} onClick={() => setOnderdeel(o)}>{o}</button>
        ))}
        <span className="ruimte" />
        {boekjaren.length > 0 && (
          <label className="boekjaarkeuze">
            Boekjaar{' '}
            <select value={boekjaarId ?? ''} onChange={(e) => setBoekjaarId(Number(e.target.value))}>
              {boekjaren.map((b) => (
                <option key={b.id} value={b.id}>{b.label}{b.status === 'afgesloten' ? ' (afgesloten)' : ''}</option>
              ))}
            </select>
          </label>
        )}
      </nav>
      {!boekjaar && onderdeel !== 'Stamdata' ? (
        <p className="uitleg">Maak eerst een boekjaar aan onder Stamdata.</p>
      ) : (
        <>
          {onderdeel === 'Overzicht' && <Overzicht boekjaar={boekjaar} versie={versie} ververs={ververs} />}
          {onderdeel === 'Journaal' && <Journaal boekjaar={boekjaar} rekeningen={rekeningen} ververs={ververs} />}
          {onderdeel === 'Grootboek' && <Grootboek boekjaar={boekjaar} rekeningen={rekeningen} />}
          {onderdeel === 'Leningen' && <Leningen ververs={ververs} />}
          {onderdeel === 'Jaarrekening' && <Jaarrekening boekjaar={boekjaar} />}
          {onderdeel === 'VpB' && <Vpb boekjaar={boekjaar} />}
          {onderdeel === 'Stamdata' && <Stamdata ververs={ververs} />}
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

function Overzicht({ boekjaar, versie, ververs }) {
  const [peildatum, setPeildatum] = useState(vandaag());
  const [definitief, setDefinitief] = useState(false);
  const [rapport, setRapport] = useState(null);
  const [controles, setControles] = useState(null);
  const [fout, setFout] = useState(null);

  useEffect(() => {
    const q = new URLSearchParams({ boekjaar_id: boekjaar.id, peildatum, alleen_definitief: definitief });
    api.get(`/administratie/rapport?${q}`).then(setRapport, (e) => setFout(e.message));
    api.get('/administratie/controles').then(setControles, (e) => setFout(e.message));
  }, [boekjaar.id, peildatum, definitief, versie]);

  const afsluiten = async () => {
    if (!confirm(`Boekjaar ${boekjaar.label} afsluiten? Daarna kan er niets meer in worden geboekt of gewijzigd.`)) return;
    try {
      await api.post(`/administratie/boekjaar/${boekjaar.id}/afsluiten`);
      ververs();
    } catch (e) {
      setFout(e.message);
    }
  };

  return (
    <MetBronnen>
    <>
      <div className="balk">
        <label>Peildatum <input type="date" value={peildatum} onChange={(e) => setPeildatum(e.target.value)} /></label>
        <label><input type="checkbox" checked={definitief} onChange={(e) => setDefinitief(e.target.checked)} /> alleen definitieve boekingen</label>
        <span className="ruimte" />
        {boekjaar.status === 'open' && <button onClick={afsluiten}>Boekjaar afsluiten</button>}
      </div>
      {fout && <p className="fout">{fout}</p>}
      {rapport && (
        <>
          {rapport.concept > 0 && !definitief && (
            <p className="uitleg">Inclusief {rapport.concept} conceptboeking(en).</p>
          )}
          <div className="twee">
            <section className="kaart">
              <h3>Balans per {datum(rapport.peildatum)}</h3>
              <Balanszijde titel="Activa" regels={rapport.activa} totaal={rapport.totaal_activa} />
              <Balanszijde titel="Passiva" regels={rapport.passiva} totaal={rapport.totaal_passiva} />
              {Math.abs(rapport.totaal_activa - rapport.totaal_passiva) >= 0.01 && (
                <p className="fout">Balans sluit niet: verschil {eurc(rapport.totaal_activa - rapport.totaal_passiva)}</p>
              )}
            </section>
            <section className="kaart">
              <h3>Winst-en-verliesrekening {datum(rapport.boekjaar.start)} – {datum(rapport.peildatum)}</h3>
              <table>
                <tbody>
                  {rapport.resultaat.map((r) => (
                    <tr key={r.id}>
                      <td>{r.nummer} {r.naam} <small>{r.categorie}</small></td>
                      <td className="getal">{eurc(r.bedrag)}</td>
                    </tr>
                  ))}
                  {!rapport.resultaat.length && <tr><td className="uitleg">Nog geen resultaatboekingen.</td></tr>}
                  <tr className="totaal">
                    <td>Resultaat vóór belasting en correcties</td>
                    <td className="getal">{eurc(rapport.resultaat_totaal)}</td>
                  </tr>
                </tbody>
              </table>
              <p className="uitleg">Fiscale correcties en de VpB-berekening volgen in fase B.</p>
            </section>
          </div>
        </>
      )}
      {controles && (
        <div className="twee">
          <section className="kaart">
            <h3>Controles</h3>
            <ul className="meldingen">
              {controles.meldingen.map((m, i) => (
                <li key={i} className={m.niveau}>
                  <strong>{m.titel}</strong>
                  <div>{m.detail}</div>
                  <small>{m.grond}</small>
                </li>
              ))}
            </ul>
          </section>
          <section className="kaart">
            <h3>Komende termijnen</h3>
            <ul className="tijdlijn">
              {controles.termijnen.map((t) => (
                <li key={t.id}><strong>{datum(t.datum)}</strong> {t.omschrijving} <small>{t.bron}</small></li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </>
    </MetBronnen>
  );
}

function Balanszijde({ titel, regels, totaal }) {
  return (
    <table className="balanszijde">
      <thead><tr><th>{titel}</th><th /></tr></thead>
      <tbody>
        {regels.map((r, i) => (
          <tr key={r.id ?? `x${i}`}>
            <td>{r.nummer} {r.naam} <small>{r.categorie}</small></td>
            <td className="getal">{eurc(r.bedrag)}</td>
          </tr>
        ))}
        <tr className="totaal"><td>Totaal</td><td className="getal">{eurc(totaal)}</td></tr>
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------

function Journaal({ boekjaar, rekeningen, ververs }) {
  const [posts, setPosts] = useState([]);
  const [open, setOpen] = useState(null); // post-id, of 'nieuw'
  const [fout, setFout] = useState(null);

  const laad = () => api.get(`/administratie/journaal?boekjaar_id=${boekjaar.id}`).then(setPosts, (e) => setFout(e.message));
  useEffect(() => { laad(); }, [boekjaar.id]);

  const klaar = (nieuwId) => {
    laad();
    ververs();
    setOpen(nieuwId ?? null);
  };

  if (open) {
    return <PostEditor key={open} id={open} boekjaar={boekjaar} rekeningen={rekeningen} onKlaar={klaar} />;
  }
  return (
    <section className="kaart">
      <div className="kaart-kop">
        <div>
          <h3>Journaal</h3>
          <p className="uitleg">Elke boeking is in balans. Een definitieve boeking wijzigt niet meer: corrigeer met een tegenboeking.</p>
        </div>
        {boekjaar.status === 'open' && <button className="primair" onClick={() => setOpen('nieuw')}>+ Nieuwe boeking</button>}
      </div>
      {fout && <p className="fout">{fout}</p>}
      <div className="scroll">
        <table className="klikbaar">
          <thead>
            <tr><th>#</th><th>Datum</th><th>Dagboek</th><th>Omschrijving</th><th className="getal">Bedrag</th><th>Bijlagen</th><th>Status</th></tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id} onClick={() => setOpen(p.id)}>
                <td>{p.id}</td>
                <td>{datum(p.datum)}</td>
                <td>{p.dagboek}</td>
                <td>{p.omschrijving}{p.referentie && <small> · {p.referentie}</small>}</td>
                <td className="getal">{eurc(p.bedrag)}</td>
                <td>{p.bijlagen || <span className="uitleg">—</span>}</td>
                <td><span className={`label ${p.status}`}>{p.status}</span></td>
              </tr>
            ))}
            {!posts.length && <tr><td colSpan={7} className="uitleg">Nog geen boekingen in dit boekjaar.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const legeRegel = () => ({ rekening_id: '', debet: '', credit: '', omschrijving: '' });

function PostEditor({ id, boekjaar, rekeningen, onKlaar }) {
  const nieuw = id === 'nieuw';
  const [post, setPost] = useState(
    nieuw ? { datum: vandaag(), dagboek: 'memoriaal', omschrijving: '', status: 'concept', regels: [legeRegel(), legeRegel()] } : null,
  );
  const [fout, setFout] = useState(null);

  const laad = () =>
    api.get(`/administratie/journaal/${id}`).then(
      (p) => setPost({ ...p, regels: p.regels.map((r) => ({ ...r, debet: r.debet || '', credit: r.credit || '' })) }),
      (e) => setFout(e.message),
    );
  useEffect(() => { if (!nieuw) laad(); }, [id]);

  const totalen = useMemo(() => {
    const som = (k) => (post?.regels ?? []).reduce((s, r) => s + Math.round(Number(r[k] || 0) * 100), 0) / 100;
    return { debet: som('debet'), credit: som('credit') };
  }, [post]);

  if (!post) return fout ? <p className="fout">{fout}</p> : <p className="uitleg">Laden…</p>;
  const vast = post.status === 'definitief' && !nieuw ? true : boekjaar.status !== 'open';
  const zet = (k, v) => setPost((p) => ({ ...p, [k]: v }));
  const zetRegel = (i, k, v) => setPost((p) => ({ ...p, regels: p.regels.map((r, j) => (j === i ? { ...r, [k]: v } : r)) }));

  const bewaar = async (status) => {
    setFout(null);
    try {
      const body = { ...post, status, boekjaar_id: boekjaar.id };
      const uit = nieuw ? await api.post('/administratie/journaal', body) : await api.put(`/administratie/journaal/${id}`, body);
      onKlaar(nieuw ? uit.id : null);
    } catch (e) {
      setFout(e.message);
    }
  };
  const verwijder = async () => {
    if (!confirm('Deze conceptboeking verwijderen?')) return;
    try {
      await api.del(`/administratie/journaal/${id}`);
      onKlaar(null);
    } catch (e) {
      setFout(e.message);
    }
  };
  const tegenboeken = async () => {
    const d = prompt('Datum van de tegenboeking (JJJJ-MM-DD)', vandaag());
    if (!d) return;
    try {
      const uit = await api.post(`/administratie/journaal/${id}/tegenboeking`, { datum: d });
      onKlaar(uit.id);
    } catch (e) {
      setFout(e.message);
    }
  };

  const verschil = Math.round((totalen.debet - totalen.credit) * 100) / 100;

  return (
    <section className="kaart">
      <div className="kaart-kop">
        <h3>{nieuw ? 'Nieuwe boeking' : `Boeking ${id}`} {!nieuw && <span className={`label ${post.status}`}>{post.status}</span>}</h3>
        <button onClick={() => onKlaar(null)}>← Terug naar journaal</button>
      </div>
      {fout && <p className="fout">{fout}</p>}
      <fieldset disabled={vast} className="formulier">
        <label><span>Datum *</span><input type="date" value={post.datum} onChange={(e) => zet('datum', e.target.value)} /></label>
        <label>
          <span>Dagboek *</span>
          <select value={post.dagboek} onChange={(e) => zet('dagboek', e.target.value)}>
            {['memoriaal', 'bank', 'inkoop', 'verkoop'].map((d) => <option key={d}>{d}</option>)}
          </select>
        </label>
        <label className="breed"><span>Omschrijving *</span><input value={post.omschrijving} onChange={(e) => zet('omschrijving', e.target.value)} /></label>
        <label><span>Bron</span><input value={post.bron ?? ''} onChange={(e) => zet('bron', e.target.value)} /></label>
        <label><span>Referentie</span><input value={post.referentie ?? ''} onChange={(e) => zet('referentie', e.target.value)} /></label>
        <label className="breed"><span>Notitie</span><textarea rows={2} value={post.notitie ?? ''} onChange={(e) => zet('notitie', e.target.value)} /></label>
      </fieldset>

      <div className="scroll">
        <table className="regels">
          <thead><tr><th>Rekening</th><th className="getal">Debet</th><th className="getal">Credit</th><th>Omschrijving</th><th /></tr></thead>
          <tbody>
            {post.regels.map((r, i) => (
              <tr key={i}>
                <td>
                  <select disabled={vast} value={r.rekening_id} onChange={(e) => zetRegel(i, 'rekening_id', Number(e.target.value))}>
                    <option value="">—</option>
                    {rekeningen.filter((g) => g.actief || g.id === r.rekening_id).map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                  </select>
                </td>
                <td><input disabled={vast} type="number" step="0.01" min="0" value={r.debet} onChange={(e) => zetRegel(i, 'debet', e.target.value)} /></td>
                <td><input disabled={vast} type="number" step="0.01" min="0" value={r.credit} onChange={(e) => zetRegel(i, 'credit', e.target.value)} /></td>
                <td><input disabled={vast} value={r.omschrijving ?? ''} onChange={(e) => zetRegel(i, 'omschrijving', e.target.value)} /></td>
                <td>{!vast && post.regels.length > 2 && (
                  <button className="gevaar" onClick={() => setPost((p) => ({ ...p, regels: p.regels.filter((_, j) => j !== i) }))}>×</button>
                )}</td>
              </tr>
            ))}
            <tr className="totaal">
              <td>{!vast && <button onClick={() => setPost((p) => ({ ...p, regels: [...p.regels, legeRegel()] }))}>+ Regel</button>}</td>
              <td className="getal">{eurc(totalen.debet)}</td>
              <td className="getal">{eurc(totalen.credit)}</td>
              <td className={verschil ? 'neg' : 'pos'}>{verschil ? `Verschil ${eurc(verschil)}` : 'In balans'}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="knoppen">
        {!vast && <button onClick={() => bewaar('concept')}>Opslaan als concept</button>}
        {!vast && <button className="primair" onClick={() => bewaar('definitief')}>Definitief boeken</button>}
        {!vast && !nieuw && <button className="gevaar" onClick={verwijder}>Verwijderen</button>}
        {!nieuw && post.status === 'definitief' && <button onClick={tegenboeken}>Tegenboeking maken</button>}
      </div>

      {!nieuw && (
        <Bijlagen
          bijlagen={post.bijlagen ?? []}
          koppeling={{ post_id: id }}
          magVerwijderen={post.status !== 'definitief'}
          onWijziging={laad}
        />
      )}
      {nieuw && <p className="uitleg">Bijlagen voeg je toe na het opslaan.</p>}
    </section>
  );
}

function Bijlagen({ bijlagen, koppeling, magVerwijderen, onWijziging }) {
  const [fout, setFout] = useState(null);
  const [bezig, setBezig] = useState(false);

  const upload = async (bestanden) => {
    setFout(null);
    setBezig(true);
    try {
      for (const f of bestanden) {
        const q = new URLSearchParams({ ...koppeling, naam: f.name });
        const res = await fetch(`/api/bijlagen?${q}`, {
          method: 'POST',
          headers: { 'Content-Type': f.type || 'application/octet-stream' },
          body: f,
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).fout ?? `Fout ${res.status}`);
      }
      onWijziging();
    } catch (e) {
      setFout(e.message);
    } finally {
      setBezig(false);
    }
  };
  const verwijder = async (b) => {
    if (!confirm(`${b.bestandsnaam} verwijderen?`)) return;
    try {
      await api.del(`/bijlagen/${b.id}`);
      onWijziging();
    } catch (e) {
      setFout(e.message);
    }
  };

  return (
    <div className="bijlagen">
      <h4>Bijlagen</h4>
      {fout && <p className="fout">{fout}</p>}
      <ul>
        {bijlagen.map((b) => (
          <li key={b.id}>
            <a href={`/api/bijlagen/${b.id}`} target="_blank" rel="noreferrer">{b.bestandsnaam}</a>{' '}
            <small>{Math.ceil(b.grootte / 1024)} kB{b.sha256 && ` · sha256 ${b.sha256.slice(0, 12)}…`}</small>
            {magVerwijderen && <button className="gevaar klein" onClick={() => verwijder(b)}>×</button>}
          </li>
        ))}
        {!bijlagen.length && <li className="uitleg">Geen bijlagen.</li>}
      </ul>
      <label className="upload">
        {bezig ? 'Bezig met uploaden…' : '+ Bestand toevoegen'}
        <input type="file" multiple hidden disabled={bezig} onChange={(e) => upload([...e.target.files])} />
      </label>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Grootboek({ boekjaar, rekeningen }) {
  const [rekeningId, setRekeningId] = useState('');
  const [kaart, setKaart] = useState(null);

  useEffect(() => {
    if (!rekeningId) return setKaart(null);
    api.get(`/administratie/grootboek/${rekeningId}?boekjaar_id=${boekjaar.id}`).then(setKaart);
  }, [rekeningId, boekjaar.id]);

  return (
    <section className="kaart">
      <div className="balk">
        <label>
          Rekening{' '}
          <select value={rekeningId} onChange={(e) => setRekeningId(e.target.value)}>
            <option value="">— kies —</option>
            {rekeningen.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
          </select>
        </label>
      </div>
      {kaart && (
        <div className="scroll">
          <table>
            <thead><tr><th>Datum</th><th>Omschrijving</th><th>Dagboek</th><th className="getal">Debet</th><th className="getal">Credit</th><th className="getal">Saldo</th></tr></thead>
            <tbody>
              <tr className="prognose"><td colSpan={5}>Beginsaldo</td><td className="getal">{eurc(kaart.beginsaldo)}</td></tr>
              {kaart.regels.map((r) => (
                <tr key={r.id}>
                  <td>{datum(r.datum)}</td>
                  <td>{r.post_omschrijving}{r.omschrijving && <small> · {r.omschrijving}</small>} {r.status === 'concept' && <span className="label concept">concept</span>}</td>
                  <td>{r.dagboek}</td>
                  <td className="getal">{r.debet ? eurc(r.debet) : ''}</td>
                  <td className="getal">{r.credit ? eurc(r.credit) : ''}</td>
                  <td className="getal">{eurc(r.saldo)}</td>
                </tr>
              ))}
              <tr className="totaal"><td colSpan={5}>Eindsaldo (debet +, credit −)</td><td className="getal">{eurc(kaart.eindsaldo)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

function Leningen({ ververs }) {
  const [lijst, setLijst] = useState(null);
  const [fout, setFout] = useState(null);
  const laad = () => api.get(`/administratie/leningen?peildatum=${vandaag()}`).then(setLijst, (e) => setFout(e.message));
  useEffect(() => { laad(); }, []);

  const boekRente = async (l, eind) => {
    try {
      await api.post(`/administratie/leningen/${l.id}/rente`, { eind });
      laad();
      ververs();
    } catch (e) {
      setFout(e.message);
    }
  };

  if (!lijst) return fout ? <p className="fout">{fout}</p> : <p className="uitleg">Laden…</p>;
  return (
    <MetBronnen>
    <>
      {fout && <p className="fout">{fout}</p>}
      {lijst.map((l) => (
        <section className="kaart" key={l.id}>
          <div className="kaart-kop">
            <div>
              <h3>{l.omschrijving}</h3>
              <p className="uitleg">
                {l.richting === 'ontvangen' ? `Schuld aan ${l.geldgever}` : `Vordering op ${l.schuldenaar}`} · {eurc(l.hoofdsom)} ·{' '}
                {pct(l.rente_pct)} rente, {l.rente_bijschrijven ? 'bijgeschreven' : 'betaald'}{' '}
                {l.rente_periode === 'kalenderjaar' ? 'per kalenderjaar' : 'per contractjaar'} · looptijd tot {datum(l.einddatum)} ·{' '}
                grootboek {l.rekening_nummer ? `${l.rekening_nummer} ${l.rekening_naam}` : 'niet gekoppeld'} · {l.bron}
              </p>
            </div>
            <button onClick={() => conceptOvereenkomst(l)}>Concept-overeenkomst</button>
          </div>
          <div className="kpis">
            <div className="kpi"><div className="kpi-titel">Saldo volgens berekening</div><div className="kpi-waarde">{eurc(l.schuld.saldo)}</div>
              <div className="kpi-sub">{l.schuld.opgelopen_rente ? `+ ${eurc(l.schuld.opgelopen_rente)} opgelopen rente` : 'hoofdsom na aflossingen'}</div></div>
            <div className="kpi"><div className="kpi-titel">Saldo in grootboek</div><div className="kpi-waarde">{eurc(l.grootboek_saldo)}</div>
              <div className={`kpi-sub ${l.verschil ? 'neg' : ''}`}>{l.verschil ? `verschil ${eurc(l.verschil)}` : 'sluit aan'}</div></div>
          </div>
          <div className="scroll">
            <table>
              <thead><tr><th>Periode</th><th className="getal">Begin</th><th className="getal">Rente</th><th className="getal">Afgelost</th><th className="getal">Eind</th><th>Renteboeking</th></tr></thead>
              <tbody>
                {l.verloop.map((r) => (
                  <tr key={r.start} className={r.prognose ? 'prognose' : ''}>
                    <td>{datum(r.start)} – {datum(r.eind)}</td>
                    <td className="getal">{eurc(r.beginsaldo)}</td>
                    <td className="getal">{eurc(r.rente)}</td>
                    <td className="getal">{eurc(r.afgelost)}</td>
                    <td className="getal">{eurc(r.eindsaldo)}</td>
                    <td>
                      {r.geboekt ? <span className="label definitief">geboekt</span>
                        : r.prognose ? <small>nog niet verstreken</small>
                        : l.rekening_id ? <button className="klein" onClick={() => boekRente(l, r.eind)}>Boek rente (concept)</button>
                        : <small>koppel een grootboekrekening</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h4>Overeenkomsten</h4>
          {l.overeenkomsten.map((o) => (
            <div key={o.id} className="overeenkomst">
              <strong>{o.titel}</strong> {o.datum && `· ${datum(o.datum)}`} ·{' '}
              {o.ondertekend ? <span className="label definitief">ondertekend</span> : <span className="label concept">niet ondertekend</span>}
              <Bijlagen bijlagen={o.bijlagen} koppeling={{ overeenkomst_id: o.id }} magVerwijderen onWijziging={laad} />
            </div>
          ))}
          {!l.overeenkomsten.length && <p className="fout">Geen overeenkomst vastgelegd. Voeg er een toe onder Stamdata → Overeenkomsten.</p>}
        </section>
      ))}
      {!lijst.length && <p className="uitleg">Nog geen leningen van de holding. Voeg ze toe onder Financiering → Stamdata.</p>}
    </>
    </MetBronnen>
  );
}

// ---------------------------------------------------------------------------

const STAMDATA = ['grootboekrekening', 'boekjaar', 'overeenkomst', 'gebeurtenis'];

function Stamdata({ ververs }) {
  const [meta, setMeta] = useState(null);
  useEffect(() => { api.get('/meta').then(setMeta); }, []);
  if (!meta) return <p className="uitleg">Laden…</p>;
  return STAMDATA.map((n) => (
    <CrudTabel key={n} naam={n} meta={meta} partij={n === 'grootboekrekening' ? null : 'holding'} onWijziging={ververs} />
  ));
}
