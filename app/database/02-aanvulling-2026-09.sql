-- Aanvulling op init.sql: mutaties spoor 1 na de startstand, ingevoerd in de
-- testomgeving (stand 2026-09-23).
--
-- Twee manieren waarop dit draait:
--   1. Nieuwe installatie: Postgres voert het na init.sql uit (leeg volume).
--   2. Bestaande database (productie): handmatig, bijvoorbeeld
--        docker exec -i boekhouding-db psql -U boekhouder -d boekhouding \
--          < 02-aanvulling-2026-09.sql
--
-- Elke regel wordt alleen toegevoegd als dezelfde regel er nog niet staat, dus
-- nogmaals uitvoeren levert geen dubbele boekingen op. Verwijst naar positie 1
-- en lening 1 uit init.sql. Vereist het schema van migratie 003 (bruto/netto):
-- start eerst de nieuwe serverversie, draai dan dit script.

BEGIN;

INSERT INTO dividend (positie_id, datum, bruto, dividendbelasting, bron, notitie)
SELECT 1, DATE '2025-05-08', 3150.00, 472.00, 'B-DIV-2025-05', 'Interimdividend "Dividend 2025-01"'
WHERE NOT EXISTS (
  SELECT 1 FROM dividend WHERE positie_id = 1 AND datum = DATE '2025-05-08'
);

INSERT INTO aflossing (lening_id, datum, bedrag, bron, notitie)
SELECT v.lening_id, v.datum, v.bedrag, 'Aflossing', NULL
FROM (VALUES
  (1, DATE '2025-12-30', 700.00),
  (1, DATE '2026-02-26', 2000.00)
) AS v (lening_id, datum, bedrag)
WHERE NOT EXISTS (
  SELECT 1 FROM aflossing a WHERE a.lening_id = v.lening_id AND a.datum = v.datum AND a.bedrag = v.bedrag
);

COMMIT;
