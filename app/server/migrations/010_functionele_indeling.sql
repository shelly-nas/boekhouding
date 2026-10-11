-- Functionele indeling (akkoord Jelle 2026-09-27): de app is niet langer per
-- spoor ingedeeld maar per functie (Verra A&V, Financiering, Overdracht,
-- Administratie). Houders en schuldenaren worden partijen in plaats van tekst;
-- de kolom 'spoor' vervalt.
--
-- Niets gaat verloren: van elke rij waarvan een kolom vervalt of die wordt
-- samengevoegd, staat de oorspronkelijke rij in wijziging_log (actie
-- 'migratie 010'). Alle koppelingen gaan op naam/KvK, niet op id, zodat dit ook
-- klopt op een database waarin de id's anders zijn uitgegeven.

-- 1. Partijen ---------------------------------------------------------------
-- 'code' markeert de eigen partijen (die een administratie en posities
-- hebben); 'regime' is het fiscale regime waaronder zij vallen.
ALTER TABLE entiteit ADD COLUMN code text UNIQUE;
ALTER TABLE entiteit ADD COLUMN regime text;

INSERT INTO wijziging_log (tabel, record_id, actie, oud, nieuw)
SELECT 'entiteit', id, 'migratie 010', to_jsonb(e), NULL FROM entiteit e;

-- Dreves Holding B.V. stond twee keer (spoor 1 en spoor 2). De registratie uit
-- spoor 2 blijft; verwijzingen naar de andere gaan daarheen.
DO $$
DECLARE
  blijft integer := (SELECT id FROM entiteit WHERE kvk = '99257467' ORDER BY (spoor = 2) DESC, id LIMIT 1);
  weg    record;
BEGIN
  IF blijft IS NULL THEN
    RAISE EXCEPTION 'Dreves Holding B.V. (KvK 99257467) niet gevonden';
  END IF;
  FOR weg IN SELECT * FROM entiteit WHERE kvk = '99257467' AND id <> blijft LOOP
    UPDATE lening             SET geldgever_id    = blijft WHERE geldgever_id    = weg.id;
    UPDATE certificaatpositie SET vennootschap_id = blijft WHERE vennootschap_id = weg.id;
    UPDATE waardering         SET vennootschap_id = blijft WHERE vennootschap_id = weg.id;
    UPDATE noemer             SET vennootschap_id = blijft WHERE vennootschap_id = weg.id;
    UPDATE jaarresultaat      SET vennootschap_id = blijft WHERE vennootschap_id = weg.id;
    UPDATE entiteit SET notitie = concat_ws(E'\n', nullif(notitie, ''),
      'Samengevoegd met de dubbele registratie uit spoor 1: ' || weg.rol || ' (bron ' || coalesce(weg.bron, '—') || ')')
    WHERE id = blijft;
    DELETE FROM entiteit WHERE id = weg.id;
  END LOOP;
  UPDATE entiteit SET code = 'holding', regime = 'VpB' WHERE id = blijft;
END $$;

UPDATE entiteit SET code = 'prive', regime = 'IB (box 3; box 2 bij aanmerkelijk belang)'
WHERE naam = 'A. Dreves (privé)';

DO $$
BEGIN
  IF (SELECT count(*) FROM entiteit WHERE code IN ('prive', 'holding')) <> 2 THEN
    RAISE EXCEPTION 'Eigen partijen (privé, holding) niet eenduidig gevonden';
  END IF;
END $$;

ALTER TABLE entiteit DROP COLUMN spoor;

-- 2. Certificaatposities: houder wordt een partij ----------------------------
INSERT INTO wijziging_log (tabel, record_id, actie, oud, nieuw)
SELECT 'certificaatpositie', id, 'migratie 010', to_jsonb(p), NULL FROM certificaatpositie p;

ALTER TABLE certificaatpositie ADD COLUMN houder_id integer REFERENCES entiteit(id);
UPDATE certificaatpositie p SET houder_id = e.id FROM entiteit e WHERE e.naam = p.houder;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM certificaatpositie WHERE houder_id IS NULL) THEN
    RAISE EXCEPTION 'Certificaatpositie met onbekende houder: %',
      (SELECT string_agg(houder, ', ') FROM certificaatpositie WHERE houder_id IS NULL);
  END IF;
END $$;
ALTER TABLE certificaatpositie ALTER COLUMN houder_id SET NOT NULL;
ALTER TABLE certificaatpositie DROP COLUMN houder;
ALTER TABLE certificaatpositie DROP COLUMN spoor;
-- Het aantal certificaten is niet altijd een geheel getal aandelen (mede-
-- eigendom van het certificaat van aandeel nr. 275, F65); de rekenbasis telt.
ALTER TABLE certificaatpositie ALTER COLUMN aantal DROP NOT NULL;

-- De positie van de holding stond alleen als journaalpost vast (F58, F59).
INSERT INTO certificaatpositie (houder_id, vennootschap_id, aantal, aantal_rekenbasis, nummers, inleg, verkregen_op, vergaderrecht, bron, notitie)
SELECT h.id, v.id, NULL, 16.5,
       '233–241 (Certificaten 2 A); 283–289 en de onverdeelde helft van 275 (Certificaten 2 B)',
       12094.50, DATE '2025-12-31', false,
       'B-AKTE-2025 p. 4–6, p. 6 (F58, F59); geen vergaderrecht: F9',
       'Koper 2 in de akte van 31-12-2025: € 6.597,00 + € 5.497,50, € 733 per aandeel'
FROM entiteit h, entiteit v
WHERE h.code = 'holding' AND v.kvk = '76691705'
  AND NOT EXISTS (SELECT 1 FROM certificaatpositie p WHERE p.houder_id = h.id AND p.vennootschap_id = v.id);

-- 3. Leningen: schuldenaar wordt een partij; de richting volgt uit wie de
-- administratie voert (geldgever of schuldenaar) --------------------------------
INSERT INTO wijziging_log (tabel, record_id, actie, oud, nieuw)
SELECT 'lening', id, 'migratie 010', to_jsonb(l), NULL FROM lening l;

ALTER TABLE lening ADD COLUMN schuldenaar_id integer REFERENCES entiteit(id);
UPDATE lening l SET schuldenaar_id = e.id FROM entiteit e WHERE e.naam = l.schuldenaar;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM lening WHERE schuldenaar_id IS NULL) THEN
    RAISE EXCEPTION 'Lening met onbekende schuldenaar: %',
      (SELECT string_agg(schuldenaar, ', ') FROM lening WHERE schuldenaar_id IS NULL);
  END IF;
END $$;
ALTER TABLE lening ALTER COLUMN schuldenaar_id SET NOT NULL;
ALTER TABLE lening DROP COLUMN schuldenaar;
ALTER TABLE lening DROP COLUMN richting;
ALTER TABLE lening DROP COLUMN spoor;

-- De lening 2025 financierde de certificaten van de holding (F59).
UPDATE lening l SET positie_id = p.id
FROM certificaatpositie p, entiteit h
WHERE l.positie_id IS NULL AND l.schuldenaar_id = h.id AND h.code = 'holding'
  AND p.houder_id = h.id AND l.hoofdsom = p.inleg;

-- 4. Boekjaren horen bij de administratie van een partij ---------------------
INSERT INTO wijziging_log (tabel, record_id, actie, oud, nieuw)
SELECT 'boekjaar', id, 'migratie 010', to_jsonb(b), NULL FROM boekjaar b;
ALTER TABLE boekjaar ADD COLUMN partij_id integer REFERENCES entiteit(id);
UPDATE boekjaar SET partij_id = (SELECT id FROM entiteit WHERE code = 'holding') WHERE spoor = 2;
UPDATE boekjaar SET partij_id = (SELECT id FROM entiteit WHERE code = 'prive') WHERE spoor = 1;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM boekjaar WHERE partij_id IS NULL) THEN
    RAISE EXCEPTION 'Boekjaar zonder partij (spoor 3?)';
  END IF;
END $$;
ALTER TABLE boekjaar ALTER COLUMN partij_id SET NOT NULL;
ALTER TABLE boekjaar DROP COLUMN spoor;

-- 5. Tijdlijn en overeenkomsten: bij welke partij (leeg = overname) -----------
INSERT INTO wijziging_log (tabel, record_id, actie, oud, nieuw)
SELECT 'gebeurtenis', id, 'migratie 010', to_jsonb(g), NULL FROM gebeurtenis g;
INSERT INTO wijziging_log (tabel, record_id, actie, oud, nieuw)
SELECT 'overeenkomst', id, 'migratie 010', to_jsonb(o), NULL FROM overeenkomst o;

ALTER TABLE gebeurtenis  ADD COLUMN partij_id integer REFERENCES entiteit(id);
ALTER TABLE overeenkomst ADD COLUMN partij_id integer REFERENCES entiteit(id);
UPDATE gebeurtenis  SET partij_id = (SELECT id FROM entiteit WHERE code = CASE spoor WHEN 1 THEN 'prive' WHEN 2 THEN 'holding' END);
UPDATE overeenkomst SET partij_id = (SELECT id FROM entiteit WHERE code = CASE spoor WHEN 1 THEN 'prive' WHEN 2 THEN 'holding' END);
ALTER TABLE gebeurtenis  DROP COLUMN spoor;
ALTER TABLE overeenkomst DROP COLUMN spoor;
