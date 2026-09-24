-- Dividend bruto/dividendbelasting/netto in plaats van één bedrag, en per
-- lening wanneer de rente wordt bijgeschreven en over welk dividendbedrag de
-- verplichte aflossing gaat. Aanleiding: B-GL-2024 art. 2.2 en 3.2.

ALTER TABLE dividend RENAME COLUMN bedrag TO bruto;
ALTER TABLE dividend ADD COLUMN dividendbelasting numeric(14, 2) NOT NULL DEFAULT 0;
ALTER TABLE dividend ADD COLUMN netto numeric(14, 2) GENERATED ALWAYS AS (bruto - dividendbelasting) STORED;

ALTER TABLE lening ADD COLUMN rente_periode text NOT NULL DEFAULT 'contractjaar'
  CHECK (rente_periode IN ('kalenderjaar', 'contractjaar'));
ALTER TABLE lening ADD COLUMN aflossing_grondslag text NOT NULL DEFAULT 'bruto'
  CHECK (aflossing_grondslag IN ('bruto', 'netto'));

-- Lening 2024: rente wordt op het einde van het kalenderjaar bijgeschreven
-- (B-GL-2024 art. 2.2).
UPDATE lening SET rente_periode = 'kalenderjaar' WHERE id = 1 AND bron = 'B-GL-2024';

-- Het dividend van 08-05-2025 was als netto bedrag ingevoerd; splitsen volgens
-- de dividendnota (bruto € 3.150, dividendbelasting € 472).
UPDATE dividend SET bruto = 3150.00, dividendbelasting = 472.00
WHERE positie_id = 1 AND datum = DATE '2025-05-08' AND bruto = 2678.00;
