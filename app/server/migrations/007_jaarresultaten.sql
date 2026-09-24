-- Waarderingsmethode (B-PRES dia 5, 7, 8): resultaat vóór belastingen van de
-- laatste drie boekjaren, gewogen 3-2-1, × factor 3 of 4. De waardering per
-- eind jaar J-1 is de prijs die in jaar J geldt (instap per 1 januari).

CREATE TABLE jaarresultaat (
  id              serial PRIMARY KEY,
  vennootschap_id integer NOT NULL REFERENCES entiteit (id) ON DELETE CASCADE,
  boekjaar        integer NOT NULL,
  resultaat       numeric(14, 2) NOT NULL,
  status          text NOT NULL DEFAULT 'werkelijk' CHECK (status IN ('werkelijk', 'schatting', 'prognose')),
  bron            text,
  notitie         text,
  UNIQUE (vennootschap_id, boekjaar)
);

-- In welk jaar een vastgestelde waardering als prijs geldt.
ALTER TABLE waardering ADD COLUMN geldig_in_jaar integer;
UPDATE waardering SET geldig_in_jaar = 2026 WHERE bron = 'B-WRD-2025';

INSERT INTO jaarresultaat (vennootschap_id, boekjaar, resultaat, status, bron, notitie)
SELECT e.id, v.boekjaar, v.resultaat, v.status, 'B-WRD-2025', v.notitie
FROM entiteit e,
  (VALUES
    (2023, 14000.00, 'werkelijk', 'Zoals gebruikt in B-WRD-2025; onderaan hetzelfde stuk staat 18.178 (V-F45)'),
    (2024, 229000.00, 'werkelijk', 'Zoals gebruikt in B-WRD-2025; onderaan hetzelfde stuk staat 319.113 (V-F45)'),
    (2025, -12000.00, 'schatting', 'Kolom "2024 schatting" (V-F10); incl. correctie −200.000 verkoop Rotterdam (V-O03); december geschat')
  ) AS v (boekjaar, resultaat, status, notitie)
WHERE e.kvk = '76691705' AND e.spoor = 1;

INSERT INTO instelling (sleutel, waarde, omschrijving, bron) VALUES
  ('waardering_weging_1', 3, 'Weging meest recente boekjaar', 'B-PRES dia 7, B-WRD-2025'),
  ('waardering_weging_2', 2, 'Weging boekjaar daarvoor', 'B-PRES dia 7, B-WRD-2025'),
  ('waardering_weging_3', 1, 'Weging oudste boekjaar', 'B-PRES dia 7, B-WRD-2025')
ON CONFLICT (sleutel) DO NOTHING;
