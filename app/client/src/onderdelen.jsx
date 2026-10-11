import { useEffect, useState } from 'react';
import { api } from './api.js';
import CrudTabel from './CrudTabel.jsx';
import { MetBronnen } from './bronnen.jsx';
import { datum, eur, vandaag } from './format.js';

// Kleine bouwstenen die meerdere modules delen.

export const Netto = ({ n }) => <span className={n < 0 ? 'neg' : 'pos'}>{eur(n)}</span>;

export const Bereik = ({ min, max, kleur = true }) => {
  const B = kleur ? Netto : ({ n }) => eur(n);
  return Math.round(min) === Math.round(max) ? <B n={min} /> : <><B n={min} /> tot <B n={max} /></>;
};

export function Kpi({ titel, waarde, sub }) {
  return (
    <div className="kpi">
      <div className="kpi-titel">{titel}</div>
      <div className="kpi-waarde">{waarde}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

// Korte naam van een eigen partij, voor kolomkoppen en labels.
export const KORT = { prive: 'privé', holding: 'holding' };

// Subtabs binnen een module; ?deel=... in de URL kiest er een bij het openen.
export function useOnderdeel(onderdelen) {
  const [onderdeel, setOnderdeel] = useState(() => {
    const deel = new URLSearchParams(location.search).get('deel');
    return onderdelen.includes(deel) ? deel : onderdelen[0];
  });
  const kies = (o) => {
    setOnderdeel(o);
    const q = new URLSearchParams(location.search);
    q.set('deel', o);
    history.replaceState(null, '', `?${q}`);
  };
  const nav = (
    <nav className="subtabs">
      {onderdelen.map((o) => (
        <button key={o} className={o === onderdeel ? 'actief' : ''} onClick={() => kies(o)}>{o}</button>
      ))}
    </nav>
  );
  return [onderdeel, nav];
}

export function Tijdlijn({ items }) {
  const nu = vandaag();
  return (
    <MetBronnen>
    <section className="kaart">
      <h3>Tijdlijn</h3>
      <ul className="tijdlijn">
        {items.map((g) => (
          <li key={g.id} className={g.datum < nu ? 'verleden' : ''}>
            <strong>{datum(g.datum)}</strong> {g.omschrijving} <small>{g.partij ? `${g.partij} · ` : ''}{g.bron}</small>
          </li>
        ))}
      </ul>
    </section>
    </MetBronnen>
  );
}

// Stamdata van een module: per resource een CrudTabel. 'partij' filtert (alleen
// voor tabellen die bij een eigen partij horen).
export function Stamdata({ tabellen, partij, onWijziging }) {
  const [meta, setMeta] = useState(null);
  useEffect(() => {
    api.get('/meta').then(setMeta);
  }, []);
  if (!meta) return <p className="uitleg">Laden…</p>;
  return tabellen.map((n) => <CrudTabel key={n} naam={n} meta={meta} partij={partij?.(n)} onWijziging={onWijziging} />);
}
