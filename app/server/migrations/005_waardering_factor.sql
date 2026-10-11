-- Factor (multiple op het gewogen resultaat) per waardering, zodat per jaar
-- dezelfde reeks kan worden gevolgd (bijv. steeds ×3). Leeg = geen reeks.
ALTER TABLE waardering ADD COLUMN factor numeric(6, 2);

UPDATE waardering SET factor = 3 WHERE bron = 'B-WRD-2025' AND label LIKE '×3%';
UPDATE waardering SET factor = 4 WHERE bron = 'B-WRD-2025' AND label LIKE '×4%';
