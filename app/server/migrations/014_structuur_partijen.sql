-- Structuuroverzicht (startscherm): partijen met officiële naam en groep, en
-- de relaties tussen hen die niet al in leningen of certificaatposities staan.
--
-- Officiële namen en KvK-nummers van de VERRA-vennootschappen en de holdings
-- van de verkopers komen uit het Handelsregister, geraadpleegd via drimble.nl
-- op 2026-09-27 (W-KVK, secundaire bron; F68–F72). Aandelenverhoudingen binnen
-- de VERRA-groep zijn niet openbaar en staan hier dus niet in.

ALTER TABLE entiteit ADD COLUMN groep text;
ALTER TABLE entiteit ADD COLUMN voorheen text;

INSERT INTO wijziging_log (tabel, record_id, actie, oud, nieuw)
SELECT 'entiteit', id, 'migratie 014', to_jsonb(e), NULL FROM entiteit e
WHERE kvk IN ('55388809', '76691705') OR naam = 'Verra Real Estate Beheer B.V.';

UPDATE entiteit SET groep = 'eigen' WHERE code IN ('prive', 'holding');
UPDATE entiteit SET groep = 'participatie' WHERE kvk = '92551521';
UPDATE entiteit SET groep = 'overig' WHERE naam = 'Kamer van Koophandel';

-- Holdings van de verkopers. KvK 55388809 staat in het Handelsregister als
-- Patrimonio Holding B.V.; de akten van 2025 noemen haar Niek Verra Holding B.V.
UPDATE entiteit SET naam = 'Patrimonio Holding B.V.', voorheen = 'Niek Verra Holding B.V. (zo genoemd in B-AKTE-CERT en B-AKTE-2025); sinds wanneer de naam is gewijzigd: V-F61',
  groep = 'verkopers', bron = concat_ws('; ', bron, 'naam: Handelsregister via drimble.nl 2026-09-27 (F70)')
WHERE kvk = '55388809';
UPDATE entiteit SET groep = 'verkopers' WHERE kvk = '55388833';

-- De VERRA-groep: de zes vennootschappen uit B-OPDR art. a.
UPDATE entiteit SET voorheen = 'Verra Expat Home Services B.V. (tot 17-01-2023)', groep = 'verra-groep',
  bron = concat_ws('; ', bron, 'statutaire naam: Handelsregister via drimble.nl 2026-09-27 (F69)')
WHERE kvk = '76691705';
UPDATE entiteit SET naam = 'VERRA Real Estate Beheer B.V.', kvk = '55389074', groep = 'verra-groep',
  bron = concat_ws('; ', bron, 'KvK: Handelsregister via drimble.nl 2026-09-27 (F68)'),
  notitie = NULL
WHERE naam = 'Verra Real Estate Beheer B.V.' AND kvk IS NULL;

INSERT INTO entiteit (naam, kvk, soort, rol, bron, groep)
SELECT v.naam, v.kvk, 'B.V.', v.rol, v.bron, v.groep
FROM (VALUES
  ('VERRA Real Estate Rotterdam B.V.', '64490270', 'VERRA-groep', 'Handelsregister via drimble.nl 2026-09-27 (F71); B-OPDR art. a', 'verra-groep'),
  ('Verra Real Estate Verhuur (DH) B.V.', '88943380', 'VERRA-groep', 'Handelsregister via drimble.nl 2026-09-27 (F71); B-OPDR art. a', 'verra-groep'),
  ('Verra Expat Home Services Den Haag B.V.', '88942880', 'VERRA-groep', 'Handelsregister via drimble.nl 2026-09-27 (F71); B-OPDR art. a', 'verra-groep'),
  ('Verra Expat Home Services Rotterdam B.V.', '88942910', 'VERRA-groep', 'Handelsregister via drimble.nl 2026-09-27 (F71); B-OPDR art. a', 'verra-groep'),
  ('Fortimare Holding B.V.', '95837078', 'Kopersgroep overname', 'B-OPDR p. 1', 'kopersgroep'),
  ('Uddevalla Holding B.V.', '98932462', 'Kopersgroep overname; ook koper certificaten (F60)', 'B-OPDR p. 1; B-AKTE-2025 p. 2–4', 'kopersgroep'),
  ('IP Holding B.V.', '91795052', 'Kopersgroep overname; penvoerder (F29)', 'B-OPDR p. 1, art. 4', 'kopersgroep')
) AS v (naam, kvk, rol, bron, groep)
WHERE NOT EXISTS (SELECT 1 FROM entiteit e WHERE e.kvk = v.kvk);

INSERT INTO entiteit (naam, kvk, soort, rol, bron, groep)
SELECT 'Atlantis Invest', '82433798', 'Adviseur', 'Adviseur kopende zijde (F26)', 'B-OPDR p. 1, p. 8', 'overig'
WHERE NOT EXISTS (SELECT 1 FROM entiteit WHERE kvk = '82433798');

-- Relaties die niet uit een lening of certificaatpositie volgen. 'naar_groep'
-- verwijst naar een hele groep (bijv. het beoogde 40%-belang in de VERRA-groep).
CREATE TABLE relatie (
  id           serial PRIMARY KEY,
  van_id       integer NOT NULL REFERENCES entiteit(id),
  naar_id      integer REFERENCES entiteit(id),
  naar_groep   text,
  soort        text NOT NULL CHECK (soort IN ('aandeelhouder', 'bestuurder', 'werkgever', 'koper', 'adviseur', 'overig')),
  omschrijving text,
  status       text NOT NULL DEFAULT 'feit' CHECK (status IN ('feit', 'beoogd')),
  bron         text,
  CHECK ((naar_id IS NULL) <> (naar_groep IS NULL))
);

INSERT INTO relatie (van_id, naar_id, soort, omschrijving, bron)
SELECT p.id, h.id, 'aandeelhouder', '100% (100 aandelen à € 1)', 'B-KVK-DRV p. 1, B-REG-DRV blad D.1 (F2, F3)'
FROM entiteit p, entiteit h WHERE p.code = 'prive' AND h.code = 'holding';

INSERT INTO relatie (van_id, naar_id, soort, omschrijving, bron)
SELECT s.id, v.id, 'aandeelhouder', '100 van 300 aandelen, gecertificeerd', 'B-AKTE-2025 p. 8 garanties sub e en f (F61)'
FROM entiteit s, entiteit v WHERE s.kvk = '92551521' AND v.kvk = '76691705';

INSERT INTO relatie (van_id, naar_id, soort, omschrijving, bron)
SELECT b.id, p.id, 'werkgever', 'arbeidsovereenkomst, algemeen manager', 'B-PART-OVK overweging A (F10)'
FROM entiteit b, entiteit p WHERE b.kvk = '55389074' AND p.code = 'prive';

INSERT INTO relatie (van_id, naar_id, soort, omschrijving, bron)
SELECT h.id, s.id, 'bestuurder', 'bestuurder STAK', 'B-AKTE-CERT p. 1–2'
FROM entiteit h, entiteit s WHERE h.kvk IN ('55388809', '55388833') AND s.kvk = '92551521';

INSERT INTO relatie (van_id, naar_id, soort, omschrijving, bron)
SELECT h.id, g.id, 'bestuurder', 'bestuurder', 'Handelsregister via drimble.nl 2026-09-27 (F72)'
FROM entiteit h, entiteit g WHERE h.kvk IN ('55388809', '55388833') AND g.groep = 'verra-groep';

INSERT INTO relatie (van_id, naar_groep, soort, omschrijving, status, bron)
SELECT k.id, 'verra-groep', 'koper', 'beoogd: samen 40% van de VERRA-groep, indicatief € 2.000.000', 'beoogd', 'B-OPDR art. 1 (F24, F25)'
FROM entiteit k WHERE k.groep = 'kopersgroep' OR k.code = 'holding';

INSERT INTO relatie (van_id, naar_groep, soort, omschrijving, bron)
SELECT a.id, 'kopersgroep', 'adviseur', 'aankoopbegeleiding, € 36.250 excl. btw, hoofdelijk (F27, F28); opdracht nog niet getekend (F30)', 'B-OPDR'
FROM entiteit a WHERE a.kvk = '82433798';
