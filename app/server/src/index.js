import express from 'express';
import { pool, migreer, wachtOpDatabase } from './db.js';
import { RESOURCES, normaliseer, Invoerfout } from './resources.js';
import { overzicht, leaver, simuleer } from './spoor1.js';
import * as s2 from './spoor2.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true });
});

app.get('/api/meta', (_req, res) => res.json(RESOURCES));

// Filter op spoor voor tabellen zonder eigen spoorkolom: via de ouder.
const SPOOR_VIA = {
  dividend: 'positie_id IN (SELECT id FROM certificaatpositie WHERE spoor = $1)',
  aflossing: 'lening_id IN (SELECT id FROM lening WHERE spoor = $1)',
  waardering: 'vennootschap_id IN (SELECT id FROM entiteit WHERE spoor = $1)',
  noemer: 'vennootschap_id IN (SELECT id FROM entiteit WHERE spoor = $1)',
  jaarresultaat: 'vennootschap_id IN (SELECT id FROM entiteit WHERE spoor = $1)',
  leaver_regel: 'positie_id IN (SELECT id FROM certificaatpositie WHERE spoor = $1)',
};

// Leesbaar label voor keuzelijsten.
const LABEL = {
  grootboekrekening: "nummer || ' ' || naam",
  boekjaar: "to_char(start, 'DD-MM-YYYY') || ' t/m ' || to_char(eind, 'DD-MM-YYYY')",
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
  const spoor = req.query.spoor ? Number(req.query.spoor) : null;
  let where = '';
  if (spoor && r.velden.some((v) => v.naam === 'spoor')) where = 'WHERE spoor = $1';
  else if (spoor && SPOOR_VIA[tabel]) where = `WHERE ${SPOOR_VIA[tabel]}`;
  const { rows } = await pool.query(
    `SELECT *${LABEL[tabel] ? `, ${LABEL[tabel]} AS label` : ''} FROM ${tabel} ${where} ORDER BY ${VOLGORDE[tabel] ?? sleutel}`,
    where ? [spoor] : [],
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

app.get('/api/spoor1/overzicht', async (req, res) => {
  res.json(await overzicht(req.query.peildatum));
});

app.get('/api/spoor1/simulatie', async (req, res) => {
  res.json(await simuleer(req.query));
});

app.get('/api/spoor1/leaver', async (req, res) => {
  res.json(await leaver(req.query));
});

// Spoor 2: boekhouding Dreves Holding B.V.
app.get('/api/spoor2/journaal', async (req, res) => res.json(await s2.journaal(req.query)));
app.get('/api/spoor2/journaal/:id', async (req, res) => {
  const p = await s2.post(Number(req.params.id));
  p ? res.json(p) : res.status(404).json({ fout: 'niet gevonden' });
});
app.post('/api/spoor2/journaal', async (req, res) => res.status(201).json(await s2.maakPost(req.body)));
app.put('/api/spoor2/journaal/:id', async (req, res) => res.json(await s2.wijzigPost(Number(req.params.id), req.body)));
app.delete('/api/spoor2/journaal/:id', async (req, res) => {
  await s2.verwijderPost(Number(req.params.id));
  res.status(204).end();
});
app.post('/api/spoor2/journaal/:id/tegenboeking', async (req, res) =>
  res.status(201).json(await s2.tegenboeking(Number(req.params.id), req.body?.datum)),
);
app.post('/api/spoor2/boekjaar/:id/afsluiten', async (req, res) => res.json(await s2.sluitBoekjaar(Number(req.params.id))));
app.get('/api/spoor2/rapport', async (req, res) => res.json(await s2.rapport(req.query)));
app.get('/api/spoor2/grootboek/:id', async (req, res) => {
  const k = await s2.grootboekkaart(Number(req.params.id), req.query);
  k ? res.json(k) : res.status(404).json({ fout: 'niet gevonden' });
});
app.get('/api/spoor2/leningen', async (req, res) => res.json(await s2.leningen(req.query)));
app.post('/api/spoor2/leningen/:id/rente', async (req, res) =>
  res.status(201).json(await s2.boekRente(Number(req.params.id), req.body?.eind)),
);
app.get('/api/spoor2/controles', async (_req, res) => res.json(await s2.controles()));

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
