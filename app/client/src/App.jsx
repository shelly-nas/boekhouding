import { useState } from 'react';
import Verra from './Verra.jsx';
import Financiering from './Financiering.jsx';
import Administratie from './Administratie.jsx';
import Overdracht from './Overdracht.jsx';

// Ingedeeld naar functie, niet naar partij: de deelneming in Verra A&V en de
// financiering raken privé en holding allebei; de administratie is per partij.
const MODULES = [
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
      return MODULES.some((m) => m.id === bewaard) ? bewaard : 'verra';
    } catch {
      return 'verra';
    }
  });
  const kies = (id) => {
    setModule(id);
    history.replaceState(null, '', `?module=${id}`);
    try {
      localStorage.setItem('module', id);
    } catch {
      // alleen een gemak; zonder opslag start de app op Verra A&V
    }
  };
  return (
    <>
      <header className="kop">
        <h1>Boekhouding</h1>
        <nav className="tabs">
          {MODULES.map((m) => (
            <button key={m.id} className={m.id === module ? 'actief' : ''} onClick={() => kies(m.id)}>
              {m.naam}
              <small>{m.sub}</small>
            </button>
          ))}
        </nav>
      </header>
      <main>
        {module === 'verra' && <Verra />}
        {module === 'financiering' && <Financiering />}
        {module === 'administratie' && <Administratie />}
        {module === 'overdracht' && <Overdracht />}
        {module === 'overname' && (
          <Leeg titel="Overname 40% VERRA-groep — nog niet ingericht">
            <p>De verwerving via de holding volgt later.</p>
          </Leeg>
        )}
      </main>
    </>
  );
}
