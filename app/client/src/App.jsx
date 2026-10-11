import { useState } from 'react';
import Overzicht from './Overzicht.jsx';
import Verra from './Verra.jsx';
import Financiering from './Financiering.jsx';
import Administratie from './Administratie.jsx';
import Overdracht from './Overdracht.jsx';
import Thema from './Thema.jsx';

// Ingedeeld naar functie, niet naar partij: de deelneming in Verra A&V en de
// financiering raken privé en holding allebei; de administratie is per partij.
const MODULES = [
  { id: 'overzicht', naam: 'Overzicht', sub: 'structuur · kerncijfers' },
  { id: 'verra', naam: 'Verra A&V', sub: 'deelneming · waardering' },
  { id: 'financiering', naam: 'Financiering', sub: 'leningen privé en holding' },
  { id: 'overdracht', naam: 'Overdracht', sub: 'privé → holding' },
  { id: 'overname', naam: 'Overname', sub: '40% VERRA-groep' },
  { id: 'administratie', naam: 'Administratie', sub: 'holding · privé' },
];

function Leeg({ titel, children }) {
  return (
    <section className="leeg">
      <h2>{titel}</h2>
      {children}
    </section>
  );
}

export default function App() {
  // ?module=... in de URL gaat voor; anders de laatst gekozen module.
  const [module, setModule] = useState(() => {
    const uitUrl = new URLSearchParams(location.search).get('module');
    if (MODULES.some((m) => m.id === uitUrl)) return uitUrl;
    try {
      const bewaard = localStorage.getItem('module');
      return MODULES.some((m) => m.id === bewaard) ? bewaard : 'overzicht';
    } catch {
      return 'overzicht';
    }
  });
  const kies = (id, partij) => {
    setModule(id);
    history.replaceState(null, '', `?module=${id}${partij ? `&partij=${partij}` : ''}`);
    try {
      localStorage.setItem('module', id);
    } catch {
      // alleen een gemak; zonder opslag start de app op het overzicht
    }
  };
  const huidig = MODULES.find((m) => m.id === module);
  return (
    <div className="shell">
      <aside className="zijbalk">
        <div className="merk">
          <span className="merk-logo" aria-hidden="true">B</span>
          <div>
            <div className="merk-naam">Boekhouding</div>
            <div className="merk-sub">Dreves · privé en holding</div>
          </div>
        </div>
        <nav className="nav" aria-label="Modules">
          {MODULES.map((m) => (
            <button
              key={m.id}
              className={`nav-item ${m.id === module ? 'is-active' : ''}`}
              aria-current={m.id === module ? 'page' : undefined}
              onClick={() => kies(m.id)}
            >
              {m.naam}
              <small>{m.sub}</small>
            </button>
          ))}
        </nav>
        <div className="zijbalk-voet">
          <Thema />
        </div>
      </aside>
      <main className="inhoud">
        <div className="inhoud-binnen">
        <header className="paginakop">
          <div>
            <h1>{huidig.naam}</h1>
            <p>{huidig.sub}</p>
          </div>
        </header>
        {module === 'overzicht' && <Overzicht naarModule={kies} />}
        {module === 'verra' && <Verra />}
        {module === 'financiering' && <Financiering />}
        {module === 'administratie' && <Administratie />}
        {module === 'overdracht' && <Overdracht />}
        {module === 'overname' && (
          <Leeg titel="Overname 40% VERRA-groep — nog niet ingericht">
            <p>De verwerving via de holding volgt later.</p>
          </Leeg>
        )}
        </div>
      </main>
    </div>
  );
}
