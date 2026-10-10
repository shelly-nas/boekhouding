import { useEffect, useState } from 'react';

// Licht/donker. Zonder eigen keuze volgt de app het systeem (ook als dat
// tijdens het gebruik wisselt); een klik legt de keuze vast in localStorage.
// De eerste klasse zet index.html al, vóór de eerste paint.
const systeem = () => matchMedia('(prefers-color-scheme: dark)');

function bewaard() {
  try {
    return localStorage.getItem('thema');
  } catch {
    return null;
  }
}

export default function Thema() {
  const [donker, setDonker] = useState(() => document.documentElement.classList.contains('theme-dark'));

  useEffect(() => {
    document.documentElement.className = donker ? 'theme-dark' : 'theme-light';
  }, [donker]);

  useEffect(() => {
    const mq = systeem();
    const volg = (e) => {
      if (!bewaard()) setDonker(e.matches);
    };
    mq.addEventListener('change', volg);
    return () => mq.removeEventListener('change', volg);
  }, []);

  const wissel = () => {
    const nieuw = !donker;
    setDonker(nieuw);
    try {
      localStorage.setItem('thema', nieuw ? 'donker' : 'licht');
    } catch {
      // alleen een gemak; zonder opslag geldt de keuze voor deze sessie
    }
  };

  return (
    <button className="stil klein" onClick={wissel} aria-pressed={donker}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        {donker ? (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        )}
      </svg>
      {donker ? 'Donker thema' : 'Licht thema'}
    </button>
  );
}
