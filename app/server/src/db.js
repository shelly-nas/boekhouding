import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

// DATE als 'YYYY-MM-DD' laten staan: omzetten naar een JS Date schuift de
// datum een dag op zodra de tijdzone van server en database verschilt.
pg.types.setTypeParser(1082, (v) => v);
// NUMERIC als getal. Ruim binnen de precisie van een double voor bedragen
// van deze orde; afronding gebeurt pas bij weergave.
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

export const pool = new pg.Pool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER ?? 'boekhouder',
  password: process.env.DB_PASSWORD ?? 'lokaal',
  database: process.env.DB_NAME ?? 'boekhouding',
});

const MIGRATIES = path.resolve(import.meta.dirname, '../migrations');

// Past elke nog niet toegepaste migratie toe, in naamvolgorde, elk in een eigen
// transactie. Het beginschema komt uit database/init.sql; dat maakt ook de
// tabel schema_migratie aan (IF NOT EXISTS hieronder is voor de zekerheid).
// Het advisory lock voorkomt dat twee gelijktijdig startende servers dezelfde
// migratie draaien.
export async function migreer() {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(4711)');
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migratie (
      naam text PRIMARY KEY,
      toegepast_op timestamptz NOT NULL DEFAULT now()
    )`);
    const { rows } = await client.query('SELECT naam FROM schema_migratie');
    const gedaan = new Set(rows.map((r) => r.naam));
    const bestanden = (await fs.readdir(MIGRATIES)).filter((f) => f.endsWith('.sql')).sort();
    for (const naam of bestanden) {
      if (gedaan.has(naam)) continue;
      const sql = await fs.readFile(path.join(MIGRATIES, naam), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migratie (naam) VALUES ($1)', [naam]);
        await client.query('COMMIT');
        console.log(`migratie toegepast: ${naam}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`migratie ${naam} mislukt: ${err.message}`);
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(4711)').catch(() => {});
    client.release();
  }
}

// Wacht tot de database bereikbaar is; lokaal start de server soms net eerder.
export async function wachtOpDatabase(pogingen = 30) {
  for (let i = 1; ; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      if (i >= pogingen) throw err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}
