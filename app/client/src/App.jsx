import { useState } from 'react';
import Spoor1 from './Spoor1.jsx';
import Spoor2 from './Spoor2.jsx';

const SPOREN = [
  { nr: 1, naam: 'Privé A. Dreves', regime: 'box 1, 2 of 3' },
  { nr: 2, naam: 'Dreves Holding B.V.', regime: 'VpB' },
  { nr: 3, naam: 'Overname 40% VERRA', regime: 'VpB' },
];

export default function App() {
  // ?spoor=2 in de URL gaat voor; anders de laatst gekozen tab.
  const [spoor, setSpoor] = useState(() => {
    const uitUrl = Number(new URLSearchParams(location.search).get('spoor'));
    if ([1, 2, 3].includes(uitUrl)) return uitUrl;
    try {
      return Number(localStorage.getItem('spoor')) || 1;
    } catch {
      return 1;
    }
  });
  const kies = (nr) => {
    setSpoor(nr);
    history.replaceState(null, '', `?spoor=${nr}`);
    try {
      localStorage.setItem('spoor', nr);
    } catch {
      // alleen een gemak; zonder opslag start de app op spoor 1
    }
  };
  return (
    <>
      <header className="kop">
        <h1>Boekhouding</h1>
        <nav className="tabs">
          {SPOREN.map((s) => (
            <button key={s.nr} className={s.nr === spoor ? 'actief' : ''} onClick={() => kies(s.nr)}>
              <span className="tab-nr">{s.nr}</span> {s.naam}
              <small>{s.regime}</small>
            </button>
          ))}
        </nav>
      </header>
      <main>
        {spoor === 1 ? (
          <Spoor1 />
        ) : spoor === 2 ? (
          <Spoor2 />
        ) : (
          <section className="leeg">
            <h2>Spoor {spoor} — nog niet ingericht</h2>
            <p>De stamdata-tabellen zijn al voorbereid op dit spoor; de schermen volgen.</p>
          </section>
        )}
      </main>
    </>
  );
}
