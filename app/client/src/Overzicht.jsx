import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { datum, eur, num, pct } from './format.js';
import { MetBronnen } from './bronnen.jsx';
import { Bereik, Kpi, Stamdata, useOnderdeel } from './onderdelen.jsx';
import Geldstromen from './Geldstromen.jsx';

// Startscherm: de structuur van alle partijen met hun relaties, de
// kerncijfers en een korte balans. Een blok aanklikken opent het detail met
// alle afhankelijkheden; eroverheen bewegen licht de verbanden op.

const ONDERDELEN = ['Structuur', 'Stamdata'];

export default function Overzicht({ naarModule }) {
  const [onderdeel, nav] = useOnderdeel(ONDERDELEN);
  return (
    <>
      {nav}
      {onderdeel === 'Structuur' && <Structuur naarModule={naarModule} />}
      {onderdeel === 'Stamdata' && <Stamdata tabellen={['entiteit', 'relatie']} />}
    </>
  );
}

// Waar elke groep staat en hoeveel blokken er naast elkaar passen.
const B = 196; // blokbreedte
const H = 58; // blokhoogte
const GX = 16; // ruimte tussen blokken
const LAYOUT = {
  verkopers: { x: 60, y: 92, cols: 2 },
  participatie: { x: 544, y: 92, cols: 1 },
  'verra-groep': { x: 60, y: 222, cols: 3 },
  kopersgroep: { x: 860, y: 470, cols: 1 },
  overig: { x: 860, y: 700, cols: 1 },
};
// De eigen partijen staan los, zoals in de schets: A. Dreves links, de holding
// rechtsonder, met het belang ertussen.
const EIGEN = { prive: { x: 60, y: 470 }, holding: { x: 470, y: 560 } };
const VERRA = ['verkopers', 'participatie', 'verra-groep'];
const GROEPTITEL = {
  verkopers: 'Eigenaren en bestuur',
  participatie: 'Certificering',
  'verra-groep': 'Zes vennootschappen (VERRA-groep)',
};
const KLEUR = {
  aandeelhouder: '--reeks-1',
  certificaathouder: '--reeks-1',
  bestuurder: '--text-muted',
  werkgever: '--reeks-3',
  geldgever: '--reeks-2',
  koper: '--primary',
  adviseur: '--text-muted',
  overig: '--text-muted',
};
const MODULE_VOOR = {
  prive: ['administratie', 'Administratie → Privé'],
  holding: ['administratie', 'Administratie → Dreves Holding'],
};

function plaats(partijen, relaties, metOvername) {
  // Alleen partijen die in een relatie voorkomen (de KvK als crediteur niet).
  const betrokken = new Set(relaties.flatMap((r) => [r.van_id, r.naar_id]).filter(Boolean));
  const perGroep = {};
  const blok = {};
  for (const p of partijen) {
    if (p.code && EIGEN[p.code]) {
      blok[p.id] = { ...EIGEN[p.code], p };
      continue;
    }
    if (!p.groep || !LAYOUT[p.groep] || !betrokken.has(p.id)) continue;
    if (!metOvername && ['kopersgroep', 'overig'].includes(p.groep)) continue;
    (perGroep[p.groep] ??= []).push(p);
  }
  // In de VERRA-groep de vennootschap met de certificaten eerst.
  // Onderste rij van de VERRA-groep, recht boven de eigen partijen: de
  // werkgever en de vennootschap met de certificaten.
  const onder = { '55389074': 1, '76691705': 2 };
  const vg = perGroep['verra-groep'];
  if (vg) {
    const rest = vg.filter((p) => !onder[p.kvk]).sort((a, b) => a.naam.localeCompare(b.naam));
    const beneden = vg.filter((p) => onder[p.kvk]).sort((a, b) => onder[a.kvk] - onder[b.kvk]);
    const cols = LAYOUT['verra-groep'].cols;
    const boven = rest.slice(0, cols);
    perGroep['verra-groep'] = [...boven, ...beneden, ...rest.slice(cols)];
  }
  const groep = {};
  for (const [g, lijst] of Object.entries(perGroep)) {
    const { x, y, cols } = LAYOUT[g];
    const dy = H + 14;
    lijst.forEach((p, i) => {
      blok[p.id] = { x: x + (i % cols) * (B + GX), y: y + Math.floor(i / cols) * dy, p };
    });
    const rijen = Math.ceil(lijst.length / cols);
    groep[g] = {
      x: x - 10, y: y - 24,
      w: Math.min(cols, lijst.length) * (B + GX) - GX + 20,
      h: (rijen - 1) * dy + H + 34,
    };
  }
  // Het VERRA-kader om eigenaren, STAK en de zes vennootschappen heen.
  const binnen = VERRA.map((g) => groep[g]).filter(Boolean);
  const verra = binnen.length && {
    x: Math.min(...binnen.map((r) => r.x)) - 20,
    y: Math.min(...binnen.map((r) => r.y)) - 44,
    w: Math.max(...binnen.map((r) => r.x + r.w)) - Math.min(...binnen.map((r) => r.x)) + 40,
    h: Math.max(...binnen.map((r) => r.y + r.h)) - Math.min(...binnen.map((r) => r.y)) + 64,
  };
  return { blok, groep, verra };
}

// Korte tekst op de lijn, voor de verbanden met de eigen partijen.
function lijnLabel(l, partij) {
  const eigen = partij[l.van_id]?.code || partij[l.naar_id]?.code;
  if (!eigen) return null;
  if (l.label) return l.label;
  if (l.soort === 'aandeelhouder' && partij[l.van_id]?.code === 'prive') return 'belang en eigenaar · 100%';
  if (l.soort === 'geldgever') return 'lening';
  if (l.soort === 'werkgever') return 'werkgever';
  if (l.soort === 'koper') return 'beoogd koper 40%';
  return null;
}

// Voegt relaties samen: dezelfde soort van één partij naar alle leden van een
// groep wordt één lijn naar de groep; en alle leden van een groep met dezelfde
// relatie naar dezelfde groep worden één lijn vanuit die groep.
function lijnen(relaties, partijen, blok) {
  const leden = {};
  for (const p of partijen) if (blok[p.id]) (leden[p.groep] ??= []).push(p.id);
  const groepVan = Object.fromEntries(partijen.map((p) => [p.id, p.groep]));
  const uit = [];
  const gebruikt = new Set();
  // 1. Eén partij → alle leden van een groep.
  const perVanSoort = {};
  for (const r of relaties) if (r.naar_id) (perVanSoort[`${r.van_id}|${r.soort}`] ??= []).push(r);
  for (const lijst of Object.values(perVanSoort)) {
    for (const [g, ids] of Object.entries(leden)) {
      const naar = lijst.filter((r) => groepVan[r.naar_id] === g);
      if (ids.length > 2 && ids.every((id) => naar.some((r) => r.naar_id === id))) {
        naar.forEach((r) => gebruikt.add(r.id));
        uit.push({ ...naar[0], id: `g-${naar[0].id}`, naar_id: null, naar_groep: g, aantal: naar.length, onderliggend: naar });
      }
    }
  }
  for (const r of relaties) if (!gebruikt.has(r.id)) uit.push(r);
  // 2. Alle leden van een groep met dezelfde relatie naar hetzelfde doel
  // (partij of groep) → één lijn vanuit de groep.
  const perGroepDoel = {};
  for (const r of uit) {
    const g = groepVan[r.van_id];
    // De eigen partijen staan los (geen kader) en worden nooit samengevoegd.
    if (!g || !r.van_id || g === 'eigen') continue;
    (perGroepDoel[`${g}|${r.naar_id ?? r.naar_groep}|${r.soort}`] ??= []).push(r);
  }
  const weg = new Set();
  const erbij = [];
  for (const [sleutel, lijst] of Object.entries(perGroepDoel)) {
    const [g] = sleutel.split('|');
    if (leden[g]?.length > 1 && leden[g].every((id) => lijst.some((r) => r.van_id === id))) {
      lijst.forEach((r) => weg.add(r.id));
      erbij.push({ ...lijst[0], id: `gg-${sleutel}`, van_id: null, van_groep: g, onderliggend: lijst.flatMap((r) => r.onderliggend ?? [r]) });
    }
  }
  return [...uit.filter((r) => !weg.has(r.id)), ...erbij];
}

function anker(rect, naar) {
  // Middelpunt van de boven- of onderzijde, afhankelijk van waar het doel ligt.
  const cx = rect.x + rect.w / 2;
  if (naar.y > rect.y + rect.h) return { x: cx, y: rect.y + rect.h };
  if (naar.y + (naar.h ?? H) < rect.y) return { x: cx, y: rect.y };
  return naar.x > rect.x ? { x: rect.x + rect.w, y: rect.y + rect.h / 2 } : { x: rect.x, y: rect.y + rect.h / 2 };
}

function Structuur({ naarModule }) {
  const [data, setData] = useState(null);
  const [fout, setFout] = useState(null);
  const [hover, setHover] = useState(null); // { soort: 'blok'|'lijn', id, x, y }
  const [gekozen, setGekozen] = useState(() => Number(new URLSearchParams(location.search).get('partij')) || null);
  const [metOvername, setMetOvername] = useState(false);

  useEffect(() => {
    api.get('/overzicht').then(setData, (e) => setFout(e.message));
  }, []);

  const layout = useMemo(() => (data ? plaats(data.partijen, data.relaties, metOvername) : null), [data, metOvername]);
  const getekend = useMemo(() => {
    if (!data || !layout) return [];
    const zichtbaar = data.relaties.filter((r) => (metOvername || !['koper', 'adviseur'].includes(r.soort)) &&
      (!r.van_id || layout.blok[r.van_id]) && (!r.naar_id || layout.blok[r.naar_id]));
    return lijnen(zichtbaar, data.partijen, layout.blok);
  }, [data, layout, metOvername]);

  if (fout) return <p className="fout">{fout}</p>;
  if (!data) return <p className="uitleg">Laden…</p>;
  const { blok, groep, verra } = layout;
  const partij = Object.fromEntries(data.partijen.map((p) => [p.id, p]));
  const rect = (id) => ({ x: blok[id].x, y: blok[id].y, w: B, h: H });

  // Wat hangt samen met het blok onder de muis (of het gekozen blok)?
  const actief = hover?.soort === 'blok' ? hover.id : gekozen;
  const verbonden = new Set();
  const actieveLijnen = new Set();
  if (actief) {
    for (const l of getekend) {
      const betrokken = l.van_id === actief || l.naar_id === actief ||
        (l.naar_groep && partij[actief]?.groep === l.naar_groep) || (l.van_groep && partij[actief]?.groep === l.van_groep);
      if (betrokken) {
        actieveLijnen.add(l.id);
        if (l.van_id) verbonden.add(l.van_id);
        if (l.naar_id) verbonden.add(l.naar_id);
      }
    }
  }

  const k = data.kpis;
  const schuld = k.schuld.reduce((s, t) => s + t.schuld, 0);
  const waarden = k.belang?.waarde.map((w) => w.waarde) ?? [];
  const breedte = 1180;
  const hoogte = Math.max(...Object.values(groep).map((g) => g.y + g.h), ...Object.values(blok).map((b) => b.y + H)) + 30;

  return (
    <MetBronnen>
      <div className="kpis">
        {k.doorgerekend.length > 0 && (
          <Kpi titel="Vermogen A. Dreves, doorgerekend"
            waarde={<Bereik min={Math.min(...k.doorgerekend.map((f) => f.totaal))} max={Math.max(...k.doorgerekend.map((f) => f.totaal))} />}
            sub={`privé netto + holding tegen marktwaarde na ${pct(k.box2_tarief)} latente box 2 (×${k.doorgerekend.map((f) => f.factor).join('–×')})`} />
        )}
        <Kpi titel="Netto vermogen privé" waarde={<Bereik {...k.prive_netto} />} sub="certificaten ×3–×4, lening, holding tegen boekwaarde" />
        <Kpi titel="Eigen vermogen holding" waarde={k.holding_ev == null ? '—' : eur(k.holding_ev)} sub="volgens de administratie (concept)" />
        {k.belang && (
          <Kpi titel="Belang Verra A&V" waarde={`${num(k.belang.aandelen)} van ${k.belang.noemer} = ${pct(k.belang.pct)}`}
            sub={<>waarde <Bereik min={Math.min(...waarden)} max={Math.max(...waarden)} kleur={false} /></>} />
        )}
        <Kpi titel="Schuld samen" waarde={eur(schuld)} sub={k.schuld.map((t) => `${t.code === 'prive' ? 'privé' : 'holding'} ${eur(t.schuld)}`).join(' · ')} />
        <Kpi titel="Openstaande controles" waarde={String(k.controles)} sub="administratie holding" />
      </div>

      <div className="twee">
        <section className="kaart">
          <h3>Balans holding in het kort <small>per {datum(data.balans.holding?.peildatum)}</small></h3>
          {data.balans.holding ? (
            <table>
              <tbody>
                <tr><td>Activa</td><td className="getal">{eur(data.balans.holding.activa)}</td></tr>
                <tr><td>Eigen vermogen</td><td className="getal">{eur(data.balans.holding.eigen_vermogen)}</td></tr>
                <tr><td>Schulden</td><td className="getal">{eur(data.balans.holding.schulden)}</td></tr>
              </tbody>
            </table>
          ) : <p className="uitleg">Geen boekjaar.</p>}
          {data.balans.holding?.concept > 0 && <p className="uitleg">Inclusief {data.balans.holding.concept} conceptboeking(en).</p>}
        </section>
        <section className="kaart">
          <h3>Vermogen privé in het kort</h3>
          <table>
            <tbody>
              {data.balans.prive.bezittingen.map((b) => (
                <tr key={b.omschrijving}><td>{b.omschrijving}</td><td className="getal"><Bereik min={b.min} max={b.max} kleur={false} /></td></tr>
              ))}
              {data.balans.prive.schulden.map((b) => (
                <tr key={b.omschrijving}><td>{b.omschrijving}</td><td className="getal">−{eur(b.bedrag)}</td></tr>
              ))}
              <tr className="totaal"><td>Netto</td><td className="getal"><Bereik {...data.balans.prive.netto} /></td></tr>
            </tbody>
          </table>
        </section>
      </div>

      <section className="kaart">
        <h3>Structuur</h3>
        <p className="uitleg">
          Beweeg over een blok om de verbanden te zien; klik voor het detail. Doorgetrokken = vastgesteld, gestippeld = beoogd.
          Namen en KvK-nummers van de VERRA-vennootschappen komen uit het Handelsregister (F68–F72); de aandelenverhoudingen binnen de
          groep zijn niet openbaar.
        </p>
        <label className="vink">
          <input type="checkbox" checked={metOvername} onChange={(e) => setMetOvername(e.target.checked)} /> toon de partijen van de overname (kopersgroep, adviseur)
        </label>
        <div className="schema-legenda">
          {[['aandeelhouder / certificaten', '--reeks-1'], ['lening', '--reeks-2'], ['werkgever', '--reeks-3'], ['koper (beoogd)', '--primary'], ['bestuurder / adviseur', '--text-muted']].map(([t, c]) => (
            <span key={t}><i style={{ background: `var(${c})` }} />{t}</span>
          ))}
        </div>
        <div className="scroll schema-houder">
          <svg className="schema" viewBox={`0 0 ${breedte} ${hoogte}`} width={breedte} height={hoogte} onMouseLeave={() => setHover(null)}>
            <defs>
              {Object.entries(KLEUR).map(([s, c]) => (
                <marker key={s} id={`pijl-${s}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill={`var(${c})`} />
                </marker>
              ))}
            </defs>
            {verra && (
              <g className="groep verra">
                <rect x={verra.x} y={verra.y} width={verra.w} height={verra.h} rx="14" />
                <text x={verra.x + 16} y={verra.y + 28} className="titel">VERRA</text>
              </g>
            )}
            {Object.entries(groep).map(([g, r]) => (
              <g key={g} className={`groep ${g}`}>
                <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="12" />
                <text x={r.x + 10} y={r.y + 16}>{GROEPTITEL[g] ?? data.groepen[g] ?? g}</text>
              </g>
            ))}
            {getekend.map((l, _i, alle) => {
              const paar = (x) => [x.van_id ?? x.van_groep, x.naar_id ?? x.naar_groep].map(String).sort().join('|');
              const zelfde = alle.filter((x) => paar(x) === paar(l));
              const nr = zelfde.indexOf(l);
              const schuif = (nr - (zelfde.length - 1) / 2) * 26;
              const van = l.van_id ? rect(l.van_id) : groep[l.van_groep] && { x: groep[l.van_groep].x, y: groep[l.van_groep].y, w: groep[l.van_groep].w, h: groep[l.van_groep].h };
              const naar = l.naar_id ? blok[l.naar_id] && rect(l.naar_id) : groep[l.naar_groep] && { x: groep[l.naar_groep].x, y: groep[l.naar_groep].y, w: groep[l.naar_groep].w, h: groep[l.naar_groep].h };
              if (!van || !naar) return null;
              const a0 = anker(van, naar);
              const b0 = anker(naar, van);
              const a = { x: a0.x + schuif, y: a0.y };
              const b = { x: b0.x + schuif, y: b0.y };
              const my = (a.y + b.y) / 2;
              const pad = `M${a.x},${a.y} C${a.x},${my} ${b.x},${my} ${b.x},${b.y}`;
              const aan = actieveLijnen.has(l.id);
              const gedimd = actief && !aan;
              return (
                <g key={l.id} className={`lijn ${aan ? 'aan' : ''} ${gedimd ? 'gedimd' : ''}`}
                  onMouseEnter={(e) => setHover({ soort: 'lijn', id: l.id, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHover(null)}>
                  <path d={pad} className="raak" />
                  <path d={pad} stroke={`var(${KLEUR[l.soort] ?? '--text-muted'})`} strokeDasharray={l.status === 'beoogd' ? '6 5' : undefined}
                    markerEnd={`url(#pijl-${l.soort})`} />
                  {lijnLabel(l, partij) && (
                    <text x={(a.x + b.x) / 2 + 8} y={my - 4 + nr * 15} className="lijnlabel">{lijnLabel(l, partij)}</text>
                  )}
                </g>
              );
            })}
            {Object.values(blok).map(({ x, y, p }) => {
              const aan = actief === p.id;
              const gedimd = actief && !aan && !verbonden.has(p.id);
              return (
                <g key={p.id} className={`blok ${p.groep} ${aan ? 'aan' : ''} ${gedimd ? 'gedimd' : ''} ${gekozen === p.id ? 'gekozen' : ''}`}
                  onMouseEnter={(e) => setHover({ soort: 'blok', id: p.id, x: e.clientX, y: e.clientY })}
                  onMouseMove={(e) => setHover({ soort: 'blok', id: p.id, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setGekozen(p.id === gekozen ? null : p.id)}
                  role="button" tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setGekozen(p.id)}>
                  <rect x={x} y={y} width={B} height={H} rx="8" />
                  <text x={x + 10} y={y + 22} className="naam">{kort(p.naam, 30)}</text>
                  <text x={x + 10} y={y + 42} className="sub">{p.kvk ? `KvK ${p.kvk}` : p.soort ?? ''}{p.code ? ' · eigen' : ''}</text>
                </g>
              );
            })}
          </svg>
          {hover && <Tip hover={hover} partij={partij} lijnen={getekend} groepen={data.groepen} />}
        </div>
      </section>

      <Geldstromen />

      {gekozen && partij[gekozen] && (
        <Detail id={gekozen} onKies={setGekozen} onSluit={() => setGekozen(null)} naarModule={naarModule} />
      )}

      {data.termijnen.length > 0 && (
        <section className="kaart">
          <h3>Komende termijnen</h3>
          <ul className="tijdlijn">
            {data.termijnen.map((t) => (
              <li key={t.id}><strong>{datum(t.datum)}</strong> {t.omschrijving} <small>{t.partij ? `${t.partij} · ` : ''}{t.bron}</small></li>
            ))}
          </ul>
        </section>
      )}
    </MetBronnen>
  );
}

const kort = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function Tip({ hover, partij, lijnen, groepen }) {
  const stijl = { left: hover.x + 14, top: hover.y + 14 };
  if (hover.soort === 'blok') {
    const p = partij[hover.id];
    const aantal = lijnen.filter((l) => l.van_id === p.id || l.naar_id === p.id || l.naar_groep === p.groep || l.van_groep === p.groep).length;
    return (
      <div className="tip" style={stijl}>
        <strong>{p.naam}</strong>
        {p.voorheen && <div><small>voorheen: {p.voorheen}</small></div>}
        <div>{[p.kvk && `KvK ${p.kvk}`, p.regime].filter(Boolean).join(' · ')}</div>
        {p.rol && <div>{p.rol}</div>}
        {p.kern && <div><strong>{p.kern}</strong></div>}
        <div><small>{aantal} verband(en) · klik voor detail</small></div>
      </div>
    );
  }
  const l = lijnen.find((x) => x.id === hover.id);
  if (!l) return null;
  const van = l.van_id ? partij[l.van_id]?.naam : groepen[l.van_groep];
  const naar = l.naar_id ? partij[l.naar_id]?.naam : groepen[l.naar_groep];
  return (
    <div className="tip" style={stijl}>
      <strong>{l.soort}{l.status === 'beoogd' ? ' (beoogd)' : ''}</strong>
      <div>{van} → {naar}</div>
      {l.omschrijving && <div>{l.omschrijving}</div>}
      {l.onderliggend && <div><small>{l.onderliggend.length} relaties samengevoegd</small></div>}
      {l.bron && <div><small>{l.bron}</small></div>}
    </div>
  );
}

function Detail({ id, onKies, onSluit, naarModule }) {
  const [d, setD] = useState(null);
  useEffect(() => {
    setD(null);
    api.get(`/overzicht/partij/${id}`).then(setD);
    const q = new URLSearchParams(location.search);
    q.set('partij', id);
    history.replaceState(null, '', `?${q}`);
  }, [id]);
  if (!d) return <section className="kaart"><p className="uitleg">Laden…</p></section>;
  const p = d.partij;
  const module = MODULE_VOOR[p.code] ?? (p.kvk === '76691705' ? ['verra', 'Verra A&V'] : null);
  const uit = d.relaties.filter((r) => r.richting === 'uit');
  const in_ = d.relaties.filter((r) => r.richting === 'in');
  const Rij = ({ r, tegen, tegenId }) => (
    <tr>
      <td>{r.soort}{r.status === 'beoogd' ? ' (beoogd)' : ''}</td>
      <td>{tegenId ? <button className="link" onClick={() => onKies(tegenId)}>{tegen}</button> : tegen}</td>
      <td>{r.omschrijving}</td>
      <td><small>{r.bron}</small></td>
    </tr>
  );
  return (
    <MetBronnen>
      <section className="kaart detail">
        <div className="kaart-kop">
          <div>
            <h3>{p.naam}</h3>
            <p className="uitleg">
              {[p.kvk && `KvK ${p.kvk}`, p.soort, p.groep_naam, p.regime].filter(Boolean).join(' · ')}
              {p.voorheen && <><br />Voorheen: {p.voorheen}</>}
            </p>
          </div>
          <div className="knoppen">
            {module && <button onClick={() => naarModule(module[0], p.code)}>Naar {module[1]}</button>}
            <button onClick={onSluit}>Sluiten</button>
          </div>
        </div>
        {p.rol && <p>{p.rol}</p>}
        {p.bron && <p className="uitleg">Bron: {p.bron}</p>}
        <h4>Afhankelijkheden</h4>
        <div className="scroll">
          <table>
            <thead><tr><th>Soort</th><th>Met</th><th>Omschrijving</th><th>Bron</th></tr></thead>
            <tbody>
              {uit.length > 0 && <tr className="subkop"><td colSpan={4}>Vanuit {kort(p.naam, 40)}</td></tr>}
              {uit.map((r) => <Rij key={r.id} r={r} tegen={r.naar} tegenId={r.naar_id} />)}
              {in_.length > 0 && <tr className="subkop"><td colSpan={4}>Naar {kort(p.naam, 40)}</td></tr>}
              {in_.map((r) => <Rij key={r.id} r={r} tegen={r.van} tegenId={r.van_id} />)}
              {!d.relaties.length && <tr><td colSpan={4} className="uitleg">Geen vastgelegde relaties.</td></tr>}
            </tbody>
          </table>
        </div>
        {d.overeenkomsten.length > 0 && (
          <>
            <h4>Overeenkomsten</h4>
            <ul>{d.overeenkomsten.map((o) => <li key={o.id}>{o.titel} {o.datum && `· ${datum(o.datum)}`} · {o.ondertekend ? 'ondertekend' : 'niet ondertekend'}</li>)}</ul>
          </>
        )}
        {d.gebeurtenissen.length > 0 && (
          <>
            <h4>Tijdlijn</h4>
            <ul className="tijdlijn">{d.gebeurtenissen.map((g) => <li key={g.id}><strong>{datum(g.datum)}</strong> {g.omschrijving} <small>{g.bron}</small></li>)}</ul>
          </>
        )}
      </section>
    </MetBronnen>
  );
}
