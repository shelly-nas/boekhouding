import express from 'express';
import { pool, migreer, wachtOpDatabase } from './db.js';
import { RESOURCES, normaliseer, Invoerfout } from './resources.js';
import { overzicht, leaver, simuleer } from './verra.js';
import * as fin from './financiering.js';
import { overdracht } from './overdracht.js';
import { vermogen } from './prive.js';
import { jaarrekening, vpb } from './jaarrekening.js';
import * as ov from './overzicht.js';
import { geldstromen } from './geldstromen.js';
import * as s2 from './administratie.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true });
});

app.get('/api/meta', (_req, res) => res.json(RESOURCES));

// Filter op een eigen partij (?partij=prive|holding). Gedeelde stamdata van de
// vennootschap (waarderingen, noemers, jaarresultaten) en de partijen zelf
// worden nooit gefilterd.
const PARTIJ = '(SELECT id FROM entiteit WHERE code = $1)';
const PARTIJ_FILTER = {
  certificaatpositie: `houder_id = ${PARTIJ}`,
  lening: `${PARTIJ} IN (geldgever_id, schuldenaar_id)`,
  dividend: `positie_id IN (SELECT id FROM certificaatpositie WHERE houder_id = ${PARTIJ})`,
  leaver_regel: `positie_id IN (SELECT id FROM certificaatpositie WHERE houder_id = ${PARTIJ})`,
  aflossing: `lening_id IN (SELECT id FROM lening WHERE ${PARTIJ} IN (geldgever_id, schuldenaar_id))`,
  boekjaar: `partij_id = ${PARTIJ}`,
  gebeurtenis: `partij_id = ${PARTIJ}`,
  overeenkomst: `partij_id = ${PARTIJ}`,
};

// Leesbaar label voor keuzelijsten.
const LABEL = {
  grootboekrekening: "nummer || ' ' || naam",
  boekjaar: "to_char(start, 'DD-MM-YYYY') || ' t/m ' || to_char(eind, 'DD-MM-YYYY')",
  certificaatpositie:
    "(SELECT naam FROM entiteit e WHERE e.id = houder_id) || ' – ' || trim_scale(coalesce(aantal_rekenbasis, aantal)) || ' aandelen'",
};
const VOLGORDE = { grootboekrekening: 'nummer', jaarresultaat: 'boekjaar', waardering: 'peildatum, id' };

// Een afgesloten boekjaar blijft zoals het is.
async function bewaakBoekjaar(tabel, id) {
  if (tabel !== 'boekjaar') return;
  const { rows } = await pool.query('SELECT status FROM boekjaar WHERE id = $1', [id]);
  if (rows[0]?.status === 'afgesloten') throw new s2.Conflict('Dit boekjaar is afgesloten');
}

function resource(req, res) {
  const r = RESOURCES[req.params.resource];
  if (!r) res.status(404).json({ fout: 'onbekende resource' });
  return r;
}

const invoervelden = (r) => r.velden.filter((v) => !v.berekend);

function waardenUit(r, body) {
  return invoervelden(r).map((v) => normaliseer(v, body[v.naam]));
}

app.get('/api/data/:resource', async (req, res) => {
  const r = resource(req, res);
  if (!r) return;
  const tabel = req.params.resource;
  const sleutel = r.sleutel ?? 'id';
  const partij = req.query.partij && PARTIJ_FILTER[tabel] ? String(req.query.partij) : null;
  const where = partij ? `WHERE ${PARTIJ_FILTER[tabel]}` : '';
  const { rows } = await pool.query(
    `SELECT *${LABEL[tabel] ? `, ${LABEL[tabel]} AS label` : ''} FROM ${tabel} ${where} ORDER BY ${VOLGORDE[tabel] ?? sleutel}`,
    partij ? [partij] : [],
  );
  res.json(rows);
});

app.post('/api/data/:resource', async (req, res) => {
  const r = resource(req, res);
  if (!r) return;
  const kolommen = invoervelden(r).map((v) => v.naam);
  const waarden = waardenUit(r, req.body);
  const { rows } = await pool.query(
    `INSERT INTO ${req.params.resource} (${kolommen.join(', ')})
     VALUES (${kolommen.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
    waarden,
  );
  res.status(201).json(rows[0]);
});

app.put('/api/data/:resource/:id', async (req, res) => {
  const r = resource(req, res);
  if (!r) return;
  await bewaakBoekjaar(req.params.resource, req.params.id);
  const kolommen = invoervelden(r).map((v) => v.naam);
  const waarden = waardenUit(r, req.body);
  const { rows } = await pool.query(
    `UPDATE ${req.params.resource} SET ${kolommen.map((k, i) => `${k} = $${i + 1}`).join(', ')}
     WHERE ${r.sleutel ?? 'id'} = $${kolommen.length + 1} RETURNING *`,
    [...waarden, req.params.id],
  );
  if (!rows.length) return res.status(404).json({ fout: 'niet gevonden' });
  res.json(rows[0]);
});

app.delete('/api/data/:resource/:id', async (req, res) => {
  const r = resource(req, res);
  if (!r) return;
  await bewaakBoekjaar(req.params.resource, req.params.id);
  const { rowCount } = await pool.query(
    `DELETE FROM ${req.params.resource} WHERE ${r.sleutel ?? 'id'} = $1`,
    [req.params.id],
  );
  if (!rowCount) return res.status(404).json({ fout: 'niet gevonden' });
  res.status(204).end();
});

app.get('/api/verra/overzicht', async (req, res) => {
  res.json(await overzicht(req.query.peildatum));
});

app.get('/api/verra/simulatie', async (req, res) => {
  res.json(await simuleer(req.query));
});

app.get('/api/verra/leaver', async (req, res) => {
  res.json(await leaver(req.query));
});

app.get('/api/geldstromen', async (req, res) => res.json(await geldstromen(req.query)));
app.get('/api/overzicht', async (_req, res) => res.json(await ov.overzicht()));
app.get('/api/overzicht/partij/:id', async (req, res) => {
  const p = await ov.partij(Number(req.params.id));
  p ? res.json(p) : res.status(404).json({ fout: 'niet gevonden' });
});
app.get('/api/prive/vermogen', async (req, res) => res.json(await vermogen(req.query)));
app.get('/api/overdracht', async (req, res) => res.json(await overdracht(req.query)));
app.get('/api/financiering/leningen', async (req, res) => res.json(await fin.leningen(req.query)));

// Administratie Dreves Holding B.V.
app.get('/api/administratie/journaal', async (req, res) => res.json(await s2.journaal(req.query)));
app.get('/api/administratie/journaal/:id', async (req, res) => {
  const p = await s2.post(Number(req.params.id));
  p ? res.json(p) : res.status(404).json({ fout: 'niet gevonden' });
});
app.post('/api/administratie/journaal', async (req, res) => res.status(201).json(await s2.maakPost(req.body)));
app.put('/api/administratie/journaal/:id', async (req, res) => res.json(await s2.wijzigPost(Number(req.params.id), req.body)));
app.delete('/api/administratie/journaal/:id', async (req, res) => {
  await s2.verwijderPost(Number(req.params.id));
  res.status(204).end();
});
app.post('/api/administratie/journaal/:id/tegenboeking', async (req, res) =>
  res.status(201).json(await s2.tegenboeking(Number(req.params.id), req.body?.datum)),
);
app.post('/api/administratie/boekjaar/:id/afsluiten', async (req, res) => res.json(await s2.sluitBoekjaar(Number(req.params.id))));
app.get('/api/administratie/rapport', async (req, res) => res.json(await s2.rapport(req.query)));
app.get('/api/administratie/grootboek/:id', async (req, res) => {
  const k = await s2.grootboekkaart(Number(req.params.id), req.query);
  k ? res.json(k) : res.status(404).json({ fout: 'niet gevonden' });
});
app.get('/api/administratie/leningen', async (req, res) => res.json(await s2.leningen(req.query)));
app.post('/api/administratie/leningen/:id/rente', async (req, res) =>
  res.status(201).json(await s2.boekRente(Number(req.params.id), req.body?.eind)),
);
app.get('/api/administratie/jaarrekening', async (req, res) => res.json(await jaarrekening(req.query)));
app.get('/api/administratie/vpb', async (req, res) => res.json(await vpb(req.query)));
app.get('/api/administratie/controles', async (_req, res) => res.json(await s2.controles()));

// Bijlagen: het bestand zelf als request body, metadata in de query.
app.post('/api/bijlagen', express.raw({ type: () => true, limit: '25mb' }), async (req, res) => {
  const b = await s2.slaBijlageOp({ ...req.query, mime: req.get('content-type') }, req.body);
  res.status(201).json(b);
});
app.get('/api/bijlagen/:id', async (req, res) => {
  const b = await s2.leesBijlage(Number(req.params.id));
  if (!b) return res.status(404).json({ fout: 'niet gevonden' });
  if (!b.intact) res.set('X-Bijlage-Gewijzigd', 'true');
  res.set('Content-Type', b.mime);
  res.set('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(b.bestandsnaam)}`);
  res.send(b.inhoud);
});
app.delete('/api/bijlagen/:id', async (req, res) => {
  await s2.verwijderBijlage(Number(req.params.id));
  res.status(204).end();
});

// Fouten uit validatie (normaliseer) en uit de database leesbaar teruggeven.
app.use((err, _req, res, _next) => {
  // Postgres-klassen 22 (ongeldige data) en 23 (constraint) zijn invoerfouten.
  if (err instanceof s2.Conflict) return res.status(409).json({ fout: err.message });
  if (err.type === 'entity.too.large') return res.status(413).json({ fout: 'Bestand is te groot (max. 25 MB)' });
  const invoer = err instanceof Invoerfout || /^2[23]/.test(err.code ?? '');
  if (!invoer) console.error(err);
  const fout =
    err.code === '23503'
      ? 'Kan niet: er verwijzen nog andere gegevens naar dit record.'
      : err.code === '23505'
        ? `Bestaat al (${err.constraint ?? 'unieke waarde'}); deze boeking of dit record is er al.`
      : invoer
        ? err.message
        : 'Interne fout';
  res.status(invoer ? 400 : 500).json({ fout });
});

const poort = Number(process.env.SERVER_PORT ?? 3000);
await wachtOpDatabase();
await migreer();
app.listen(poort, () => console.log(`server luistert op ${poort}`));
