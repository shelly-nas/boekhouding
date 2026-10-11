import { useEffect, useState } from 'react';
import { api } from './api.js';
import { datum, num } from './format.js';

// Generieke tabel voor één resource uit /api/meta: tonen, toevoegen,
// bewerken en verwijderen. Velden en types komen van de server.
// 'partij' (prive|holding) toont alleen wat bij die eigen partij hoort; gedeelde
// stamdata negeert het filter.
export default function CrudTabel({ naam, meta, partij, onWijziging }) {
  const def = meta[naam];
  const sleutel = def.sleutel ?? 'id';
  const [rijen, setRijen] = useState([]);
  const [refs, setRefs] = useState({});
  const [bewerk, setBewerk] = useState(null); // sleutelwaarde, of 'nieuw'
  const [concept, setConcept] = useState({});
  const [fout, setFout] = useState(null);

  const laad = async () => {
    const q = partij ? `?partij=${partij}` : '';
    setRijen(await api.get(`/data/${naam}${q}`));
    const refNamen = [...new Set(def.velden.filter((v) => v.type === 'ref').map((v) => v.ref))];
    const geladen = await Promise.all(refNamen.map((r) => api.get(`/data/${r}`)));
    setRefs(Object.fromEntries(refNamen.map((r, i) => [r, geladen[i]])));
  };

  useEffect(() => {
    laad().catch((e) => setFout(e.message));
  }, [naam, partij]);

  const refLabel = (ref, id) => {
    const rij = refs[ref]?.find((r) => r.id === id);
    return rij ? rij[meta[ref].labelVeld] ?? `#${id}` : id == null ? '—' : `#${id}`;
  };

  const toon = (v, w) => {
    if (w == null || w === '') return '—';
    if (v.type === 'ref') return refLabel(v.ref, w);
    if (v.type === 'bool') return w ? 'ja' : 'nee';
    if (v.type === 'date') return datum(w);
    if (v.type === 'number') return num(w);
    return String(w);
  };

  const start = (rij) => {
    setFout(null);
    if (rij) {
      setBewerk(rij[sleutel]);
      setConcept({ ...rij });
    } else {
      setBewerk('nieuw');
      setConcept({});
    }
  };

  const bewaar = async () => {
    try {
      if (bewerk === 'nieuw') await api.post(`/data/${naam}`, concept);
      else await api.put(`/data/${naam}/${encodeURIComponent(bewerk)}`, concept);
      setBewerk(null);
      await laad();
      onWijziging?.();
    } catch (e) {
      setFout(e.message);
    }
  };

  const verwijder = async (rij) => {
    if (!confirm('Dit record verwijderen?')) return;
    try {
      await api.del(`/data/${naam}/${encodeURIComponent(rij[sleutel])}`);
      await laad();
      onWijziging?.();
    } catch (e) {
      setFout(e.message);
    }
  };

  const invoer = (v) => {
    const w = concept[v.naam];
    const zet = (x) => setConcept((c) => ({ ...c, [v.naam]: x }));
    switch (v.type) {
      case 'bool':
        return <input type="checkbox" checked={!!w} onChange={(e) => zet(e.target.checked)} />;
      case 'date':
        return <input type="date" value={w ?? ''} onChange={(e) => zet(e.target.value)} />;
      case 'number':
      case 'integer':
        return <input type="number" step="any" value={w ?? ''} onChange={(e) => zet(e.target.value)} />;
      case 'enum':
        return (
          <select value={w ?? ''} onChange={(e) => zet(e.target.value)}>
            <option value="">—</option>
            {v.opties.map((o) => <option key={o}>{o}</option>)}
          </select>
        );
      case 'ref':
        return (
          <select value={w ?? ''} onChange={(e) => zet(e.target.value)}>
            <option value="">—</option>
            {(refs[v.ref] ?? []).map((r) => (
              <option key={r.id} value={r.id}>{r[meta[v.ref].labelVeld] ?? `#${r.id}`}</option>
            ))}
          </select>
        );
      default:
        return v.lang
          ? <textarea rows={2} value={w ?? ''} onChange={(e) => zet(e.target.value)} />
          : <input value={w ?? ''} onChange={(e) => zet(e.target.value)} />;
    }
  };

  const kolommen = def.velden;

  const formulier = (
    <div className="formulier">
      {def.velden.filter((v) => !v.berekend).map((v) => (
        <label key={v.naam} className={v.lang ? 'breed' : ''}>
          <span>{v.label}{v.verplicht && ' *'}</span>
          {invoer(v)}
        </label>
      ))}
      <div className="knoppen">
        <button className="primair" onClick={bewaar}>Opslaan</button>
        <button onClick={() => setBewerk(null)}>Annuleren</button>
      </div>
    </div>
  );

  return (
    <section className="kaart">
      <div className="kaart-kop">
        <div>
          <h3>{def.titel}</h3>
          <p className="uitleg">{def.uitleg}</p>
        </div>
        {bewerk === null && <button onClick={() => start(null)}>+ Toevoegen</button>}
      </div>
      {fout && <p className="fout">{fout}</p>}
      {bewerk === 'nieuw' && formulier}
      <div className="scroll">
        <table>
          <thead>
            <tr>
              {kolommen.map((v) => <th key={v.naam}>{v.label}</th>)}
              <th />
            </tr>
          </thead>
          <tbody>
            {rijen.map((rij) =>
              bewerk === rij[sleutel] ? (
                <tr key={rij[sleutel]}>
                  <td colSpan={kolommen.length + 1}>{formulier}</td>
                </tr>
              ) : (
                <tr key={rij[sleutel]}>
                  {kolommen.map((v) => (
                    <td key={v.naam} className={v.type === 'number' || v.type === 'integer' ? 'getal' : ''}>
                      {toon(v, rij[v.naam])}
                    </td>
                  ))}
                  <td className="acties">
                    <button onClick={() => start(rij)}>Bewerk</button>
                    <button className="gevaar" onClick={() => verwijder(rij)}>×</button>
                  </td>
                </tr>
              ),
            )}
            {!rijen.length && (
              <tr><td colSpan={kolommen.length + 1} className="uitleg">Nog niets vastgelegd.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
