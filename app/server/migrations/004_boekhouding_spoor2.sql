-- Spoor 2, fase A: dubbel boekhouden voor Dreves Holding B.V.
--
-- Uitgangspunten (art. 2:10 BW, art. 52 AWR):
-- - elke journaalpost is in balans (afgedwongen door de server);
-- - een definitieve post wijzigt niet meer: corrigeren gaat met een tegenboeking;
-- - een afgesloten boekjaar accepteert geen boekingen meer;
-- - bijlagen worden bewaard met een sha256, zodat wijziging opvalt;
-- - elke wijziging in het journaal komt in wijziging_log.

CREATE TABLE grootboekrekening (
  id        serial PRIMARY KEY,
  nummer    text NOT NULL UNIQUE,
  naam      text NOT NULL,
  soort     text NOT NULL CHECK (soort IN ('balans', 'resultaat')),
  categorie text NOT NULL,
  -- vaste rol voor automatische boekingen (rente, rekening-courant DGA, ...)
  functie   text UNIQUE,
  actief    boolean NOT NULL DEFAULT true,
  notitie   text
);

CREATE TABLE boekjaar (
  id            serial PRIMARY KEY,
  spoor         smallint NOT NULL DEFAULT 2 CHECK (spoor IN (1, 2, 3)),
  start         date NOT NULL,
  eind          date NOT NULL CHECK (eind > start),
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'afgesloten')),
  afgesloten_op timestamptz,
  notitie       text
);

CREATE TABLE journaalpost (
  id            serial PRIMARY KEY,
  boekjaar_id   integer NOT NULL REFERENCES boekjaar (id) ON DELETE RESTRICT,
  datum         date NOT NULL,
  dagboek       text NOT NULL CHECK (dagboek IN ('memoriaal', 'bank', 'inkoop', 'verkoop')),
  omschrijving  text NOT NULL,
  -- vrije referentie; automatische boekingen gebruiken een vaste sleutel
  -- (bijv. 'rente:2:2026') zodat ze niet dubbel worden aangemaakt
  referentie    text UNIQUE,
  status        text NOT NULL DEFAULT 'concept' CHECK (status IN ('concept', 'definitief')),
  bron          text,
  notitie       text,
  aangemaakt_op timestamptz NOT NULL DEFAULT now(),
  gewijzigd_op  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE journaalregel (
  id           serial PRIMARY KEY,
  post_id      integer NOT NULL REFERENCES journaalpost (id) ON DELETE CASCADE,
  rekening_id  integer NOT NULL REFERENCES grootboekrekening (id) ON DELETE RESTRICT,
  debet        numeric(14, 2) NOT NULL DEFAULT 0 CHECK (debet >= 0),
  credit       numeric(14, 2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  omschrijving text,
  CHECK ((debet = 0) <> (credit = 0))
);
CREATE INDEX journaalregel_rekening ON journaalregel (rekening_id);

CREATE TABLE overeenkomst (
  id          serial PRIMARY KEY,
  spoor       smallint NOT NULL CHECK (spoor IN (1, 2, 3)),
  soort       text NOT NULL CHECK (soort IN ('lening', 'rekening-courant', 'besluit', 'overig')),
  titel       text NOT NULL,
  datum       date,
  lening_id   integer REFERENCES lening (id) ON DELETE SET NULL,
  partijen    text,
  ondertekend boolean NOT NULL DEFAULT false,
  bron        text,
  notitie     text
);

CREATE TABLE bijlage (
  id              serial PRIMARY KEY,
  post_id         integer REFERENCES journaalpost (id) ON DELETE CASCADE,
  overeenkomst_id integer REFERENCES overeenkomst (id) ON DELETE CASCADE,
  bestandsnaam    text NOT NULL,
  mime            text NOT NULL,
  grootte         integer NOT NULL,
  sha256          text NOT NULL,
  geupload_op     timestamptz NOT NULL DEFAULT now(),
  CHECK (post_id IS NOT NULL OR overeenkomst_id IS NOT NULL)
);

CREATE TABLE wijziging_log (
  id        bigserial PRIMARY KEY,
  tabel     text NOT NULL,
  record_id integer NOT NULL,
  actie     text NOT NULL,
  oud       jsonb,
  nieuw     jsonb,
  op        timestamptz NOT NULL DEFAULT now()
);

-- Leningen: richting (schuld of vordering van de houder) en de grootboekrekening
-- waarop de hoofdsom staat. Voor spoor 2 is het journaal leidend.
ALTER TABLE lening ADD COLUMN richting text NOT NULL DEFAULT 'ontvangen'
  CHECK (richting IN ('ontvangen', 'verstrekt'));
ALTER TABLE lening ADD COLUMN rekening_id integer REFERENCES grootboekrekening (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Startgegevens Dreves Holding B.V. (stand 2026-09-23, uit 2-dreves-holding/)
-- ---------------------------------------------------------------------------

-- Eenvoudig decimaal rekeningschema. Koppeling aan RGS volgt in fase B (export).
INSERT INTO grootboekrekening (nummer, naam, soort, categorie, functie) VALUES
  ('0300', 'Certificaten Verra Aan- en Verkoop (tranche 2)', 'balans', 'Financiële vaste activa', NULL),
  ('0900', 'Geplaatst kapitaal', 'balans', 'Eigen vermogen', 'kapitaal'),
  ('0910', 'Overige reserves', 'balans', 'Eigen vermogen', 'reserves'),
  ('1100', 'ING zakelijk', 'balans', 'Liquide middelen', 'bank'),
  ('1200', 'Rekening-courant DGA (A. Dreves)', 'balans', 'Vorderingen / schulden DGA', 'rc_dga'),
  ('1300', 'Derdengelden notaris', 'balans', 'Vorderingen', NULL),
  ('1400', 'Nog te ontvangen rente', 'balans', 'Vorderingen', 'te_ontvangen_rente'),
  ('1500', 'Crediteuren', 'balans', 'Kortlopende schulden', 'crediteuren'),
  ('1550', 'Te betalen rente', 'balans', 'Kortlopende schulden', 'te_betalen_rente'),
  ('1600', 'Te betalen vennootschapsbelasting', 'balans', 'Kortlopende schulden', 'te_betalen_vpb'),
  ('1700', 'Lening Verra Aan- en Verkoop B.V. (B-GL-2025)', 'balans', 'Langlopende schulden', NULL),
  ('4000', 'Oprichtings- en inschrijvingskosten', 'resultaat', 'Algemene kosten', NULL),
  ('4100', 'Advieskosten', 'resultaat', 'Algemene kosten', NULL),
  ('4200', 'Bankkosten', 'resultaat', 'Algemene kosten', 'bankkosten'),
  ('4900', 'Overige kosten', 'resultaat', 'Algemene kosten', NULL),
  ('8000', 'Managementvergoeding', 'resultaat', 'Omzet', NULL),
  ('8500', 'Dividend uit certificaten', 'resultaat', 'Financiële baten', 'dividendbaten'),
  ('9000', 'Rentebaten', 'resultaat', 'Financiële baten', 'rentebaten'),
  ('9100', 'Rentelasten', 'resultaat', 'Financiële lasten', 'rentelasten'),
  ('9900', 'Vennootschapsbelasting', 'resultaat', 'Belastingen', 'vpb');

INSERT INTO boekjaar (spoor, start, eind, notitie) VALUES
  (2, '2025-12-23', '2026-12-31', 'Eerste boekjaar, verlengd (B-AKTE-OPR slotverklaring, F4)');

INSERT INTO entiteit (spoor, naam, kvk, soort, rol, bron, notitie) VALUES
  (2, 'Dreves Holding B.V.', '99257467', 'B.V.', 'De vennootschap; RSIN 868903772, opgericht 23-12-2025, boekjaar = kalenderjaar', 'B-KVK-DRV, B-AKTE-OPR', NULL),
  (2, 'A. Dreves (privé)', NULL, 'Natuurlijk persoon', 'Enig aandeelhouder en alleen/zelfstandig bevoegd bestuurder (F2)', 'B-KVK-DRV, B-UBO-DRV', 'Rechtshandelingen met de BV schriftelijk vastleggen: art. 2:247 BW'),
  (2, 'Kamer van Koophandel', NULL, 'Overheid', 'Crediteur inschrijfvergoeding', 'B-FACT-KVK', NULL);

WITH l AS (
  INSERT INTO lening (spoor, omschrijving, geldgever_id, schuldenaar, positie_id, hoofdsom, rente_pct,
                      rente_bijschrijven, rente_periode, startdatum, looptijd_jaren,
                      aflossing_uit_dividend_pct, aflossing_grondslag, richting, rekening_id, bron, notitie)
  VALUES (2, 'Lening 2025 financiering certificaten tranche 2',
          (SELECT id FROM entiteit WHERE kvk = '76691705' ORDER BY id LIMIT 1),
          'Dreves Holding B.V.', NULL, 12094.50, 5.000, false, 'kalenderjaar', '2025-12-23', 5,
          25.000, 'bruto', 'ontvangen', (SELECT id FROM grootboekrekening WHERE nummer = '1700'),
          'B-GL-2025',
          'Rente jaarlijks aan het einde van het jaar berekend en overgemaakt (art. 2.2); 25% van het toekomende dividend als aflossing (art. 3.2); vrijwillig boetevrij aflossen (art. 3.3); bedrag rechtstreeks aan STAK voldaan (art. 1.2)')
  RETURNING id
)
INSERT INTO overeenkomst (spoor, soort, titel, datum, lening_id, partijen, ondertekend, bron, notitie)
SELECT 2, 'lening', 'Geldleningsovereenkomst Dreves Holding B.V. i.o.', '2025-12-23', l.id,
       'Verra Aan- en Verkoop B.V. (geldgever) – Dreves Holding B.V. i.o. (geldneemster)', true, 'B-GL-2025',
       'Aangegaan door de holding i.o.; bekrachtiging na oprichting niet vastgesteld'
FROM l;

-- Openingsboekingen, als concept: ze steunen deels op aannames (zie notities).
WITH bj AS (SELECT id FROM boekjaar WHERE spoor = 2 AND start = '2025-12-23'),
p1 AS (
  INSERT INTO journaalpost (boekjaar_id, datum, dagboek, omschrijving, referentie, bron, notitie)
  SELECT id, '2025-12-23', 'memoriaal', 'Storting geplaatst kapitaal (100 aandelen à € 1)', 'opening:kapitaal',
         'B-AKTE-OPR slotverklaring sub b', 'Gestort op de derdengeldenrekening van de notaris; doorstorting naar ING niet vastgesteld'
  FROM bj RETURNING id
),
p2 AS (
  INSERT INTO journaalpost (boekjaar_id, datum, dagboek, omschrijving, referentie, bron, notitie)
  SELECT id, '2025-12-23', 'memoriaal', 'Verkrijging certificaten tranche 2, betaald door geldgever aan STAK', 'opening:certificaten',
         'B-GL-2025 art. 1.1–1.2', 'Kostprijs voorlopig gelijk aan de lening. Leveringsakte ontbreekt (V-F20); opgave ca. € 12.000, verschil onverklaard (V-F05)'
  FROM bj RETURNING id
),
p3 AS (
  INSERT INTO journaalpost (boekjaar_id, datum, dagboek, omschrijving, referentie, bron, notitie)
  SELECT id, '2025-12-24', 'inkoop', 'KvK-inschrijfvergoeding, factuur 250883436 (btw-vrijgesteld)', 'opening:kvk',
         'B-FACT-KVK', 'Oprichtingskosten ten laste van de vennootschap (F5). Vervaldatum 21-01-2026; betaling niet vastgesteld'
  FROM bj RETURNING id
)
INSERT INTO journaalregel (post_id, rekening_id, debet, credit)
SELECT p1.id, (SELECT id FROM grootboekrekening WHERE nummer = '1300'), 100.00, 0 FROM p1
UNION ALL SELECT p1.id, (SELECT id FROM grootboekrekening WHERE nummer = '0900'), 0, 100.00 FROM p1
UNION ALL SELECT p2.id, (SELECT id FROM grootboekrekening WHERE nummer = '0300'), 12094.50, 0 FROM p2
UNION ALL SELECT p2.id, (SELECT id FROM grootboekrekening WHERE nummer = '1700'), 0, 12094.50 FROM p2
UNION ALL SELECT p3.id, (SELECT id FROM grootboekrekening WHERE nummer = '4000'), 82.25, 0 FROM p3
UNION ALL SELECT p3.id, (SELECT id FROM grootboekrekening WHERE nummer = '1500'), 0, 82.25 FROM p3;

INSERT INTO gebeurtenis (spoor, datum, omschrijving, bron) VALUES
  (2, '2025-12-23', 'Oprichting Dreves Holding B.V.; lening 2025 aangegaan', 'B-AKTE-OPR, B-GL-2025'),
  (2, '2025-12-31', 'Rente lening 2025 over 2025 berekenen en overmaken', 'B-GL-2025 art. 2.2'),
  (2, '2026-01-21', 'Vervaldatum KvK-factuur € 82,25', 'B-FACT-KVK'),
  (2, '2026-12-31', 'Einde eerste (verlengde) boekjaar; rente lening 2025 over 2026 overmaken', 'B-AKTE-OPR, B-GL-2025 art. 2.2'),
  (2, '2027-05-31', 'Jaarrekening 2025/2026 opgemaakt (5 maanden, art. 2:210 lid 1 BW); ondertekening = vaststelling (lid 5)', 'art. 2:210 BW'),
  (2, '2027-12-31', 'Uiterste datum deponering jaarrekening 2025/2026 bij KVK (art. 2:394 BW); binnen 8 dagen na vaststelling', 'art. 2:394 BW'),
  (2, '2030-12-23', 'Einde looptijd lening 2025', 'B-GL-2025 art. 1.3');
