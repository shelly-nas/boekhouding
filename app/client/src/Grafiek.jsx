import { useEffect, useRef, useState } from 'react';

// Lijngrafiek in SVG: één y-as in euro's, tijd op de x-as, crosshair met
// tooltip (muis en pijltjestoetsen), labels aan het eind van elke lijn en een
// optionele verticale markering. Kleuren komen uit CSS-variabelen
// (--reeks-1 ...), zodat licht en donker elk hun eigen stappen hebben.

const MARGE = { boven: 14, rechts: 128, onder: 28, links: 64 };
const ms = (d) => Date.parse(`${d}T00:00:00Z`);
const kort = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 });
const vol = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const dmj = (d) => d.split('-').reverse().join('-');

function netteStap(bereik, doel = 4) {
  const ruw = bereik / doel;
  const macht = 10 ** Math.floor(Math.log10(ruw || 1));
  const f = ruw / macht;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * macht;
}

export default function Grafiek({ titel, reeksen, markering, hoogte = 260, nulLijn = false }) {
  const houder = useRef(null);
  const [breedte, setBreedte] = useState(640);
  const [actief, setActief] = useState(null);

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setBreedte(Math.max(320, e.contentRect.width)));
    ro.observe(houder.current);
    return () => ro.disconnect();
  }, []);

  const datums = reeksen[0]?.punten.map((p) => p.datum) ?? [];
  if (!datums.length) return <div ref={houder} />;
  const smal = breedte < 520;
  const marge = { ...MARGE, rechts: smal ? 12 : MARGE.rechts };
  const b = breedte - marge.links - marge.rechts;
  const h = hoogte - marge.boven - marge.onder;

  const x0 = ms(datums[0]);
  const x1 = ms(datums.at(-1));
  const sx = (d) => marge.links + ((ms(d) - x0) / (x1 - x0 || 1)) * b;
  const alle = reeksen.flatMap((r) => r.punten.map((p) => p.waarde));
  let lo = Math.min(0, ...alle);
  let hi = Math.max(0, ...alle);
  if (hi === lo) hi = lo + 1;
  const stap = netteStap(hi - lo);
  lo = Math.floor(lo / stap) * stap;
  hi = Math.ceil(hi / stap) * stap;
  const sy = (v) => marge.boven + (1 - (v - lo) / (hi - lo)) * h;
  const yTicks = [];
  for (let v = lo; v <= hi + stap / 2; v += stap) yTicks.push(v);
  const jaren = [];
  for (let j = Number(datums[0].slice(0, 4)) + 1; j <= Number(datums.at(-1).slice(0, 4)); j++) jaren.push(`${j}-01-01`);

  const pad = (punten) => punten.map((p, i) => `${i ? 'L' : 'M'}${sx(p.datum).toFixed(1)},${sy(p.waarde).toFixed(1)}`).join('');

  // Eindlabels: naar elkaar toe geschoven labels uit elkaar duwen.
  const eind = reeksen
    .map((r, i) => ({ i, y: sy(r.punten.at(-1).waarde), r }))
    .sort((a, c) => a.y - c.y);
  for (let k = 1; k < eind.length; k++) if (eind[k].y - eind[k - 1].y < 30) eind[k].y = eind[k - 1].y + 30;

  const kiesVanMuis = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * breedte;
    let best = 0;
    datums.forEach((d, i) => {
      if (Math.abs(sx(d) - px) < Math.abs(sx(datums[best]) - px)) best = i;
    });
    setActief(best);
  };
  const toets = (e) => {
    if (e.key === 'ArrowRight') setActief((a) => Math.min(datums.length - 1, (a ?? -1) + 1));
    else if (e.key === 'ArrowLeft') setActief((a) => Math.max(0, (a ?? datums.length) - 1));
    else if (e.key === 'Escape') setActief(null);
    else return;
    e.preventDefault();
  };

  const ax = actief != null ? sx(datums[actief]) : 0;
  return (
    <figure className="grafiek" ref={houder}>
      <figcaption>{titel}</figcaption>
      {reeksen.length > 1 && (
        <ul className="legenda">
          {reeksen.map((r) => (
            <li key={r.naam}><span className="lijnsleutel" style={{ background: `var(${r.kleur})` }} />{r.naam}</li>
          ))}
        </ul>
      )}
      <div className="grafiek-vlak">
        <svg
          width={breedte}
          height={hoogte}
          role="img"
          aria-label={titel}
          tabIndex={0}
          onPointerMove={kiesVanMuis}
          onPointerLeave={() => setActief(null)}
          onKeyDown={toets}
          onBlur={() => setActief(null)}
        >
          {yTicks.map((v) => (
            <g key={v}>
              <line className={v === 0 && (nulLijn || lo < 0) ? 'as-nul' : 'raster'} x1={marge.links} x2={marge.links + b} y1={sy(v)} y2={sy(v)} />
              <text className="as-tekst" x={marge.links - 8} y={sy(v)} dy="0.32em" textAnchor="end">{kort.format(v)}</text>
            </g>
          ))}
          {jaren.map((d) => (
            <text key={d} className="as-tekst" x={sx(d)} y={hoogte - 8} textAnchor="middle">{d.slice(0, 4)}</text>
          ))}
          {markering && ms(markering.datum) >= x0 && ms(markering.datum) <= x1 && (
            <g>
              <line className="markering" x1={sx(markering.datum)} x2={sx(markering.datum)} y1={marge.boven} y2={marge.boven + h} />
              <text className="as-tekst" x={sx(markering.datum) + 4} y={marge.boven + 10}>{markering.label}</text>
            </g>
          )}
          {reeksen.map((r) => (
            <path key={r.naam} d={pad(r.punten)} fill="none" stroke={`var(${r.kleur})`} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {!smal && eind.map(({ r, y }) => (
            <g key={r.naam}>
              <line x1={marge.links + b + 8} x2={marge.links + b + 18} y1={y} y2={y} stroke={`var(${r.kleur})`} strokeWidth="2" />
              <text className="eindlabel" x={marge.links + b + 22} y={y} dy="-0.15em">{vol.format(r.punten.at(-1).waarde)}</text>
              <text className="eindlabel sub" x={marge.links + b + 22} y={y} dy="1.05em">{r.kortNaam ?? r.naam}</text>
            </g>
          ))}
          {actief != null && (
            <g>
              <line className="crosshair" x1={ax} x2={ax} y1={marge.boven} y2={marge.boven + h} />
              {reeksen.map((r) => (
                <circle key={r.naam} cx={ax} cy={sy(r.punten[actief].waarde)} r="4" fill={`var(${r.kleur})`} className="punt" />
              ))}
            </g>
          )}
        </svg>
        {actief != null && (
          <div className="tooltip" style={{ left: Math.min(ax + 12, breedte - 200), top: marge.boven }}>
            <div className="tooltip-kop">{dmj(datums[actief])}</div>
            {reeksen.map((r) => (
              <div key={r.naam} className="tooltip-rij">
                <span className="lijnsleutel" style={{ background: `var(${r.kleur})` }} />
                <strong>{vol.format(r.punten[actief].waarde)}</strong> <span>{r.kortNaam ?? r.naam}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <details className="tabelweergave">
        <summary>Tabel</summary>
        <table>
          <thead><tr><th>Datum</th>{reeksen.map((r) => <th key={r.naam} className="getal">{r.naam}</th>)}</tr></thead>
          <tbody>
            {datums.map((d, i) => (i === 0 || d.endsWith('-01-01') || i === datums.length - 1) && (
              <tr key={d}><td>{dmj(d)}</td>{reeksen.map((r) => <td key={r.naam} className="getal">{vol.format(r.punten[i].waarde)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
