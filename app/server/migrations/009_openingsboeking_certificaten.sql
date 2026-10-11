-- Openingsboeking certificaten tranche 2 in twee stappen, zodat de balans op
-- beide data klopt (akkoord Jelle 2026-09-26):
--   23-12-2025  lening verstrekt en rechtstreeks aan de STAK betaald
--               (B-GL-2025 art. 1.1–1.2, p. 1) → vordering op de STAK
--   31-12-2025  levering van de certificaten (B-AKTE-2025 p. 4–6, F58)
--               → certificaten tegen die vordering
-- Alleen zolang de oorspronkelijke boeking nog concept is; een definitieve
-- boeking wordt nooit door een migratie gewijzigd.

INSERT INTO grootboekrekening (nummer, naam, soort, categorie, functie)
SELECT '1350', 'Vordering STAK (vooruitbetaalde koopsom certificaten)', 'balans', 'Vorderingen', NULL
WHERE NOT EXISTS (SELECT 1 FROM grootboekrekening WHERE nummer = '1350');

DO $$
DECLARE
  bj       integer;
  oud      integer;
  nieuw    integer;
  r_cert   integer := (SELECT id FROM grootboekrekening WHERE nummer = '0300');
  r_vord   integer := (SELECT id FROM grootboekrekening WHERE nummer = '1350');
  r_lening integer := (SELECT id FROM grootboekrekening WHERE nummer = '1700');
  voor     jsonb;
BEGIN
  SELECT id, boekjaar_id INTO oud, bj FROM journaalpost
  WHERE referentie = 'opening:certificaten' AND status = 'concept';
  IF oud IS NULL OR EXISTS (SELECT 1 FROM journaalpost WHERE referentie = 'opening:lening') THEN
    RETURN;
  END IF;

  SELECT to_jsonb(p) || jsonb_build_object('regels', (SELECT jsonb_agg(to_jsonb(r)) FROM journaalregel r WHERE r.post_id = p.id))
    INTO voor FROM journaalpost p WHERE p.id = oud;

  -- 1. 23-12-2025: lening → vordering op de STAK
  INSERT INTO journaalpost (boekjaar_id, datum, dagboek, omschrijving, referentie, bron, notitie)
  VALUES (bj, '2025-12-23', 'memoriaal',
          'Lening Verra Aan- en Verkoop B.V., koopsom rechtstreeks voldaan aan de STAK',
          'opening:lening', 'B-GL-2025 art. 1.1–1.2 (p. 1)',
          'De geldgever betaalde de koopsom namens de holding aan de STAK; tot de levering op 31-12-2025 is dat een vordering op de STAK. Betaling aan de STAK nog niet aangetoond (V-F05)')
  RETURNING id INTO nieuw;
  INSERT INTO journaalregel (post_id, rekening_id, debet, credit) VALUES
    (nieuw, r_vord, 12094.50, 0),
    (nieuw, r_lening, 0, 12094.50);
  INSERT INTO wijziging_log (tabel, record_id, actie, oud, nieuw)
  VALUES ('journaalpost', nieuw, 'aangemaakt', NULL,
          jsonb_build_object('migratie', '009', 'datum', '2025-12-23', 'referentie', 'opening:lening'));

  -- 2. 31-12-2025: levering certificaten → tegen de vordering
  UPDATE journaalpost SET
    datum = '2025-12-31',
    omschrijving = 'Levering certificaten tranche 2: 16,5 aandelen à € 733 (Certificaten 2 A en 2 B)',
    bron = 'B-AKTE-2025 p. 4–6 (F58, F59)',
    notitie = 'Gepasseerd 31-12-2025; koopsom € 6.597,00 + € 5.497,50 = € 12.094,50, verrekend met de vordering op de STAK van 23-12-2025',
    gewijzigd_op = now()
  WHERE id = oud;
  DELETE FROM journaalregel WHERE post_id = oud;
  INSERT INTO journaalregel (post_id, rekening_id, debet, credit) VALUES
    (oud, r_cert, 12094.50, 0),
    (oud, r_vord, 0, 12094.50);
  INSERT INTO wijziging_log (tabel, record_id, actie, oud, nieuw)
  VALUES ('journaalpost', oud, 'gewijzigd', voor,
          jsonb_build_object('migratie', '009', 'datum', '2025-12-31', 'regels', 'D 0300 / C 1350 € 12.094,50'));
END $$;
