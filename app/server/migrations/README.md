# Migraties

Schemawijzigingen ná de eerste installatie. Het beginschema en de stamdata
staan in `../../database/init.sql`, dat Postgres alleen op een leeg volume
uitvoert.

- Een bestand per wijziging: `003_omschrijving.sql`, oplopend genummerd.
- De server voert bij het starten alles uit wat nog niet in de tabel
  `schema_migratie` staat, elk bestand in een eigen transactie.
- Wijzig nooit een migratie die al is uitgevoerd; voeg een nieuwe toe.
- Een nieuwe installatie draait eerst `init.sql` en daarna, via de server,
  alle migraties die `init.sql` niet als uitgevoerd markeert. Een migratie
  hoeft dus niet in `init.sql` te worden overgenomen.
- Wordt een migratie toch in `init.sql` verwerkt (zoals 003), zet dan haar
  naam in de `INSERT INTO schema_migratie` bovenin `init.sql`, anders draait
  zij twee keer.
