// Startscherm: de structuur (partijen en hun onderlinge relaties) met de
// belangrijkste cijfers. Relaties komen uit drie plekken: de tabel relatie
// (aandeelhouder, bestuurder, werkgever, koper, adviseur), de
// certificaatposities en de leningen — zodat niets dubbel wordt vastgelegd.
import { pool } from './db.js';
import { controles, rapport } from './administratie.js';
import { leningen } from './financiering.js';
import { vermogen } from './prive.js';
import { DIVIDENDTARIEF } from './rekenen.js';
import { overzicht as verraOverzicht } from './verra.js';

const q = (sql, p = []) => pool.query(sql, p).then((r) => r.rows);
const vandaag = () => new Date().toISOString().slice(0, 10);
const eur = (n) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const aandelen = (n) => String(Number(n)).replace('.', ',');

export const GROEPEN = {
  eigen: 'Eigen partijen',
  participatie: 'Certificering',
  verkopers: 'Holdings van de verkopers',
  'verra-groep': 'VERRA-groep (zes vennootschappen, B-OPDR art. a)',
  kopersgroep: 'Kopersgroep overname',
  overig: 'Overig',
};

async function relaties() {
  const [eigen, posities, lijst] = await Promise.all([
    q('SELECT * FROM relatie ORDER BY id'),
    q('SELECT * FROM certificaatpositie ORDER BY id'),
    leningen({ peildatum: vandaag() }),
  ]);
  const uit = eigen.map((r) => ({ ...r, id: `r${r.id}`, herkomst: 'relatie' }));
  for (const p of posities) {
    // Certificaten van aandelen in de vennootschap, uitgegeven door de STAK.
    uit.push({
      id: `p${p.id}`, van_id: p.houder_id, naar_id: p.vennootschap_id, naar_groep: null,
      soort: 'certificaathouder', status: 'feit', herkomst: 'certificaatpositie',
      label: `certificaten via STAK · ${aandelen(p.aantal_rekenbasis ?? p.aantal)} aandelen`,
      omschrijving: `certificaten via de STAK: ${aandelen(p.aantal_rekenbasis ?? p.aantal)} aandelen, inleg ${eur(p.inleg)}`, bron: p.bron,
    });
  }
  for (const l of lijst.leningen) {
    uit.push({
      id: `l${l.id}`, van_id: l.geldgever_id, naar_id: l.schuldenaar_id, naar_groep: null,
      soort: 'geldgever', status: 'feit', herkomst: 'lening',
      omschrijving: `${l.omschrijving}: schuld ${eur(l.schuld.totaal)} (hoofdsom ${eur(l.hoofdsom)}, ${String(l.rente_pct).replace('.', ',')}%)`, bron: l.bron,
    });
  }
  return { relaties: uit, leningen: lijst };
}

export async function overzicht() {
  const [partijen, { relaties: rel, leningen: fin }, prive, verra, holdingRapport, ctrl, termijnen] = await Promise.all([
    q('SELECT id, naam, kvk, soort, rol, groep, voorheen, code, regime FROM entiteit ORDER BY id'),
    relaties(),
    vermogen({}),
    verraOverzicht(vandaag()),
    rapport({ peildatum: vandaag() }).catch(() => null),
    controles(),
    q('SELECT g.*, e.naam AS partij FROM gebeurtenis g LEFT JOIN entiteit e ON e.id = g.partij_id WHERE datum >= $1 ORDER BY datum LIMIT 4', [vandaag()]),
  ]);

  const s = verra.samen;
  // Vermogen van A. Dreves doorgerekend: privé netto plus de holding tegen
  // marktwaarde van de certificaten, na de box 2-heffing die bij uitkering nog
  // komt (latent). Per factor, zodat ×3 en ×4 elk consistent blijven.
  const holdingPositie = verra.posities.find((x) => x.positie.houder_code === 'holding');
  const t2 = DIVIDENDTARIEF.box2 / 100;
  const ev = holdingRapport ? holdingRapport.passiva.filter((x) => x.categorie === 'Eigen vermogen').reduce((t, x) => t + x.bedrag, 0) : null;
  const holdingSchulden = holdingRapport ? holdingRapport.totaal_passiva - ev : null;
  const certBoek = holdingPositie?.positie.inleg ?? 0;
  const doorgerekend = (i) => {
    const priveCert = prive.bestanddelen.find((b) => b.omschrijving.startsWith('Certificaten'))?.waarden?.[i]?.waarde ?? 0;
    const priveRest = prive.bestanddelen.filter((b) => !b.omschrijving.startsWith('Certificaten') && !b.omschrijving.startsWith('Aandelen Dreves'))
      .reduce((t, b) => t + (b.waarden?.[0]?.waarde ?? 0), 0);
    const markt = holdingPositie?.matrix[i]?.cellen.at(-1)?.waarde ?? certBoek;
    const evMarkt = (ev ?? 0) - certBoek + markt;
    return { prive: priveCert + priveRest, holding_markt: evMarkt, holding_na_box2: evMarkt > 0 ? evMarkt * (1 - t2) : evMarkt, totaal: priveCert + priveRest + (evMarkt > 0 ? evMarkt * (1 - t2) : evMarkt) };
  };
  const factoren = (holdingPositie?.matrix ?? []).map((m, i) => ({ factor: m.waardering.factor, ...doorgerekend(i) }));

  // Kerncijfer per partij, voor de tooltip op het schema.
  const kern = {};
  const priveId = partijen.find((p) => p.code === 'prive')?.id;
  const holdingId = partijen.find((p) => p.code === 'holding')?.id;
  const vaId = partijen.find((p) => p.kvk === '76691705')?.id;
  if (priveId) kern[priveId] = `netto vermogen ${eur(prive.netto.min)} tot ${eur(prive.netto.max)}`;
  if (holdingId && ev != null) kern[holdingId] = `eigen vermogen ${eur(ev)}, balanstotaal ${eur(holdingRapport.totaal_activa)}`;
  if (vaId && s) kern[vaId] = `waardering ${s.per_factor.map((f) => `×${f.factor}`).join('–')}: ${eur(Math.min(...s.per_factor.map((f) => f.waarde)) / s.aandelen * s.noemer)} tot ${eur(Math.max(...s.per_factor.map((f) => f.waarde)) / s.aandelen * s.noemer)}`;

  return {
    peildatum: vandaag(),
    groepen: GROEPEN,
    partijen: partijen.map((p) => ({ ...p, kern: kern[p.id] ?? null })),
    relaties: rel,
    kpis: {
      doorgerekend: factoren,
      box2_tarief: DIVIDENDTARIEF.box2,
      prive_netto: prive.netto,
      holding_ev: ev,
      belang: s && { aandelen: s.aandelen, noemer: s.noemer, pct: s.pct, waarde: s.per_factor.map((f) => ({ factor: f.factor, waarde: f.waarde })) },
      schuld: fin.totalen,
      controles: ctrl.meldingen.filter((m) => m.niveau !== 'info').length,
    },
    balans: {
      holding: holdingRapport && { peildatum: holdingRapport.peildatum, activa: holdingRapport.totaal_activa, eigen_vermogen: ev, schulden: holdingSchulden, concept: holdingRapport.concept },
      prive: {
        bezittingen: prive.bestanddelen.filter((b) => b.soort === 'bezitting').map((b) => ({ omschrijving: b.omschrijving, min: Math.min(...(b.waarden ?? [{ waarde: 0 }]).map((w) => w.waarde)), max: Math.max(...(b.waarden ?? [{ waarde: 0 }]).map((w) => w.waarde)) })),
        schulden: prive.bestanddelen.filter((b) => b.soort === 'schuld').map((b) => ({ omschrijving: b.omschrijving, bedrag: -b.waarden[0].waarde })),
        netto: prive.netto,
      },
    },
    termijnen,
  };
}

// Detail van één partij: gegevens, alle relaties in beide richtingen,
// overeenkomsten en de tijdlijn.
export async function partij(id) {
  const [p] = await q('SELECT * FROM entiteit WHERE id = $1', [id]);
  if (!p) return null;
  const [{ relaties: rel }, namen, overeenkomsten, gebeurtenissen] = await Promise.all([
    relaties(),
    q('SELECT id, naam, groep FROM entiteit'),
    q('SELECT * FROM overeenkomst WHERE partij_id = $1 ORDER BY datum', [id]),
    q('SELECT * FROM gebeurtenis WHERE partij_id = $1 ORDER BY datum', [id]),
  ]);
  const naam = Object.fromEntries(namen.map((n) => [n.id, n.naam]));
  const groepVan = p.groep;
  const eigen = rel
    .filter((r) => r.van_id === p.id || r.naar_id === p.id || (r.naar_groep && r.naar_groep === groepVan))
    .map((r) => ({
      ...r,
      richting: r.van_id === p.id ? 'uit' : 'in',
      van: naam[r.van_id],
      naar: r.naar_id ? naam[r.naar_id] : GROEPEN[r.naar_groep] ?? r.naar_groep,
    }));
  return { partij: { ...p, groep_naam: GROEPEN[p.groep] ?? null }, relaties: eigen, overeenkomsten, gebeurtenissen };
}
