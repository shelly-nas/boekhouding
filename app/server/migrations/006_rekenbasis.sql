-- Eén rekenbasis voor spoor 1 (opgave Jelle 2026-09-24, na B-MAIL-2025-12):
-- noemer 300 aandelen, privépositie 13,5 aandelen = 4,5%. Dit is een aanname
-- (A11): de akte van 02-01-2025 zegt nog 9 certificaten op 100 (V-F40).
ALTER TABLE certificaatpositie ADD COLUMN aantal_rekenbasis numeric(8, 2);
ALTER TABLE noemer ADD COLUMN standaard boolean NOT NULL DEFAULT false;

UPDATE certificaatpositie SET aantal_rekenbasis = 13.5,
  notitie = coalesce(notitie || '; ', '') || 'Rekenbasis 13,5 van 300 aandelen volgens rectificatievoornemen (B-MAIL-2025-12, A10/A11)'
WHERE id = 1 AND aantal = 9;
UPDATE noemer SET standaard = true WHERE vennootschap_id = 1 AND aantal = 300;
