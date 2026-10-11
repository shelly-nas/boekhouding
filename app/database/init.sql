-- Initiële database: schema + stamdata spoor 1 (stand 2026-09-23).
--
-- Postgres voert dit alleen uit bij de eerste start van een LEEG volume. Zodra
-- er data in staat, wijzigt een aanpassing hier niets meer: een schemawijziging
-- wordt dan een migratie in server/migrations/, die de server bij het starten
-- toepast. Houd dit bestand daarna gelijk aan schema + migraties, zodat een
-- nieuwe installatie op hetzelfde uitkomt.
--
-- Geen directe identifiers (BSN, IBAN, adressen, geboortedata) — zie CLAUDE.md.

-- Welke migraties in dit bestand al verwerkt zijn: de server slaat die over.
-- Verwerk je een migratie hierin, voeg dan ook haar naam hier toe.
CREATE TABLE schema_migratie (
  naam          text PRIMARY KEY,
  toegepast_op  timestamptz NOT NULL DEFAULT now()
);
INSERT INTO schema_migratie (naam) VALUES
  ('003_dividend_bruto_en_renteperiode.sql');

CREATE TABLE entiteit (
  id        serial PRIMARY KEY,
  spoor     smallint NOT NULL CHECK (spoor IN (1, 2, 3)),
  naam      text NOT NULL,
  kvk       text,
  soort     text,
  rol       text,
  bron      text,
  notitie   text
);

CREATE TABLE certificaatpositie (
  id              serial PRIMARY KEY,
  spoor           smallint NOT NULL CHECK (spoor IN (1, 2, 3)),
  houder          text NOT NULL,
  vennootschap_id integer REFERENCES entiteit (id) ON DELETE RESTRICT,
  aantal          integer NOT NULL CHECK (aantal > 0),
  nummers         text,
  inleg           numeric(14, 2) NOT NULL,
  verkregen_op    date NOT NULL,
  vergaderrecht   boolean NOT NULL DEFAULT false,
  bron            text,
  notitie         text
);

CREATE TABLE lening (
  id                          serial PRIMARY KEY,
  spoor                       smallint NOT NULL CHECK (spoor IN (1, 2, 3)),
  omschrijving                text NOT NULL,
  geldgever_id                integer REFERENCES entiteit (id) ON DELETE RESTRICT,
  schuldenaar                 text NOT NULL,
  positie_id                  integer REFERENCES certificaatpositie (id) ON DELETE SET NULL,
  hoofdsom                    numeric(14, 2) NOT NULL,
  rente_pct                   numeric(6, 3) NOT NULL,
  -- true: rente wordt jaarlijks bij de hoofdsom geteld; false: jaarlijks betaald
  rente_bijschrijven          boolean NOT NULL DEFAULT true,
  -- wanneer de rente wordt bijgeschreven of betaald: op 31-12 of op de jaardag
  rente_periode               text NOT NULL DEFAULT 'contractjaar'
                              CHECK (rente_periode IN ('kalenderjaar', 'contractjaar')),
  startdatum                  date NOT NULL,
  looptijd_jaren              integer NOT NULL,
  -- verplichte aflossing als % van het dividend; alleen getoetst, niet
  -- automatisch geboekt
  aflossing_uit_dividend_pct  numeric(6, 3) NOT NULL DEFAULT 0,
  aflossing_grondslag         text NOT NULL DEFAULT 'bruto'
                              CHECK (aflossing_grondslag IN ('bruto', 'netto')),
  bron                        text,
  notitie                     text
);

-- Dividend dat de houder van de positie toekomt (niet het totaal van de
-- vennootschap).
CREATE TABLE dividend (
  id                 serial PRIMARY KEY,
  positie_id         integer NOT NULL REFERENCES certificaatpositie (id) ON DELETE CASCADE,
  datum              date NOT NULL,
  bruto              numeric(14, 2) NOT NULL,
  dividendbelasting  numeric(14, 2) NOT NULL DEFAULT 0,
  netto              numeric(14, 2) GENERATED ALWAYS AS (bruto - dividendbelasting) STORED,
  bron        text,
  notitie     text
);

-- Aflossingen buiten de dividendregeling om.
CREATE TABLE aflossing (
  id        serial PRIMARY KEY,
  lening_id integer NOT NULL REFERENCES lening (id) ON DELETE CASCADE,
  datum     date NOT NULL,
  bedrag    numeric(14, 2) NOT NULL,
  bron      text,
  notitie   text
);

CREATE TABLE waardering (
  id                  serial PRIMARY KEY,
  vennootschap_id     integer NOT NULL REFERENCES entiteit (id) ON DELETE CASCADE,
  peildatum           date NOT NULL,
  label               text NOT NULL,
  ondernemingswaarde  numeric(14, 2) NOT NULL,
  bron                text,
  notitie             text
);

-- Kandidaat-noemers voor de waarde per certificaat (V-O01).
CREATE TABLE noemer (
  id              serial PRIMARY KEY,
  vennootschap_id integer NOT NULL REFERENCES entiteit (id) ON DELETE CASCADE,
  aantal          integer NOT NULL CHECK (aantal > 0),
  label           text NOT NULL,
  bron            text,
  notitie         text
);

-- Leaver-regeling per positie. Jaar 1 = eerste jaar na verkrijging.
CREATE TABLE leaver_regel (
  id               serial PRIMARY KEY,
  positie_id       integer NOT NULL REFERENCES certificaatpositie (id) ON DELETE CASCADE,
  categorie        text NOT NULL CHECK (categorie IN ('good', 'early', 'bad')),
  vanaf_jaar       integer,
  tot_en_met_jaar  integer,
  pct_marktwaarde  numeric(6, 3) NOT NULL,
  -- true: prijs is het laagste van het percentage en de inleg (bad leaver)
  max_inleg        boolean NOT NULL DEFAULT false,
  bron             text,
  notitie          text
);

CREATE TABLE instelling (
  sleutel       text PRIMARY KEY,
  waarde        numeric(14, 4) NOT NULL,
  omschrijving  text,
  bron          text
);

CREATE TABLE gebeurtenis (
  id           serial PRIMARY KEY,
  spoor        smallint NOT NULL CHECK (spoor IN (1, 2, 3)),
  datum        date NOT NULL,
  omschrijving text NOT NULL,
  bron         text
);

-- ---------------------------------------------------------------------------
-- Stamdata spoor 1, overgenomen uit 1-prive-a-dreves/ en RELATIES.md.
-- Na de eerste start is de UI leidend.
-- ---------------------------------------------------------------------------

INSERT INTO entiteit (id, spoor, naam, kvk, soort, rol, bron, notitie) VALUES
  (1, 1, 'Verra Aan- en Verkoop Den Haag B.V.', '76691705', 'B.V.', 'Vennootschap waarop de certificaten zien; geldgever lening 2024', 'B-AKTE-CERT, B-GL-2024', 'Naam in overeenkomsten: "Verra Aan- en Verkoop B.V." — zie V-F07'),
  (2, 1, 'Stichting Administratiekantoor VERRA Makelaars', '92551521', 'Stichting', 'STAK; houdt de aandelen, geeft certificaten uit, stelt Marktwaarde vast', 'B-AKTE-CERT', NULL),
  (3, 1, 'Niek Verra Holding B.V.', '55388809', 'B.V.', 'Verkoper 1; bestuurder Vennootschap en STAK', 'B-AKTE-CERT', NULL),
  (4, 1, 'Martijn van der Laan Holding B.V.', '55388833', 'B.V.', 'Verkoper 2; bestuurder Vennootschap en STAK', 'B-AKTE-CERT', NULL),
  (5, 1, 'Verra Real Estate Beheer B.V.', NULL, 'B.V.', 'Werkgever van A. Dreves', 'B-PART-OVK sub A', 'KvK onbekend — V-F06'),
  (6, 1, 'Dreves Holding B.V.', '99257467', 'B.V.', '100% in handen van A. Dreves privé (€ 100 nominaal, sinds 2025-12-23)', 'N-VERRA', 'Eigen spoor: 2');

INSERT INTO certificaatpositie (id, spoor, houder, vennootschap_id, aantal, nummers, inleg, verkregen_op, vergaderrecht, bron, notitie) VALUES
  (1, 1, 'A. Dreves (privé)', 1, 9, '212–216 (Niek Verra Holding), 265–268 (Martijn van der Laan Holding)', 17100.00, '2025-01-02', false, 'B-AKTE-CERT, B-NOTA-DRV', 'Tranche 1; € 1.900 per certificaat');

INSERT INTO lening (id, spoor, omschrijving, geldgever_id, schuldenaar, positie_id, hoofdsom, rente_pct, rente_bijschrijven, rente_periode, startdatum, looptijd_jaren, aflossing_uit_dividend_pct, aflossing_grondslag, bron, notitie) VALUES
  (1, 1, 'Lening 2024 financiering certificaten', 1, 'A. Dreves (privé)', 1, 17100.00, 5.000, true, 'kalenderjaar', '2024-12-23', 5, 25.000, 'bruto', 'B-GL-2024', 'Rente bijgeschreven op 31-12 (art. 2.2); 25% van het toekomende dividend als aflossing (art. 3.2); vrijwillig boetevrij aflossen (art. 3.3); geen zekerheid (F17); opeisbaar bij einde participatie (F16); verrekening toegestaan (art. 4.2)');

INSERT INTO waardering (id, vennootschap_id, peildatum, label, ondernemingswaarde, bron, notitie) VALUES
  (1, 1, '2025-11-30', '×3 gewogen resultaat', 220000.00, 'B-WRD-2025', 'Jaaraanduiding in pdf inconsistent — V-F10'),
  (2, 1, '2025-11-30', '×4 gewogen resultaat', 290000.00, 'B-WRD-2025', 'Jaaraanduiding in pdf inconsistent — V-F10');

INSERT INTO noemer (id, vennootschap_id, aantal, label, bron, notitie) VALUES
  (1, 1, 100, 'Gecertificeerd kapitaal (akte)', 'B-AKTE-CERT art. 1 sub f', 'V-O01'),
  (2, 1, 200, 'Presentatie / spreadsheet 2024', 'B-PRES slide 12, B-WRD-2024 cel D25', 'V-O01'),
  (3, 1, 300, 'Geplaatst kapitaal / waardering 2025', 'B-AKTE-CERT art. 1 sub e, B-WRD-2025', 'V-O01');

INSERT INTO leaver_regel (positie_id, categorie, vanaf_jaar, tot_en_met_jaar, pct_marktwaarde, max_inleg, bron, notitie) VALUES
  (1, 'good',  NULL, NULL, 100.000, false, 'B-PART-OVK art. 6.3', NULL),
  (1, 'early', 1,    2,     70.000, false, 'B-PART-OVK art. 6.2', 'Einde arbeidsovereenkomst binnen 3 jaar op initiatief Participant'),
  (1, 'early', 3,    3,     80.000, false, 'B-PART-OVK art. 6.2, 6.4(iii)(c)', NULL),
  (1, 'bad',   NULL, NULL,  50.000, true,  'B-PART-OVK art. 6.1', 'Laagste van 50% Marktwaarde óf de inleg');

INSERT INTO instelling (sleutel, waarde, omschrijving, bron) VALUES
  ('leaver_extra_korting_pct', 10, 'Extra korting bij onbetaald verlof of gemiddeld < 40 uur per week', 'B-PART-OVK art. 6.5');

INSERT INTO gebeurtenis (spoor, datum, omschrijving, bron) VALUES
  (1, '2024-12-23', 'Lening € 17.100 verstrekt (5%, bijgeschreven, 5 jaar)', 'B-GL-2024'),
  (1, '2024-12-30', 'Participatieovereenkomst ondertekend', 'B-PART-OVK p. 10'),
  (1, '2025-01-02', 'Levering 9 certificaten', 'B-AKTE-CERT'),
  (1, '2028-01-02', 'Einde early-leavertermijn (3 jaar na verkrijging) — afgeleid, startpunt termijn te verifiëren', 'B-PART-OVK art. 6.2'),
  (1, '2029-12-23', 'Einde looptijd lening 2024', 'B-GL-2024');

SELECT setval('entiteit_id_seq', (SELECT max(id) FROM entiteit));
SELECT setval('certificaatpositie_id_seq', (SELECT max(id) FROM certificaatpositie));
SELECT setval('lening_id_seq', (SELECT max(id) FROM lening));
SELECT setval('waardering_id_seq', (SELECT max(id) FROM waardering));
SELECT setval('noemer_id_seq', (SELECT max(id) FROM noemer));
