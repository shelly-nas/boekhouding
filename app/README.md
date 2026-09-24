# Webapp boekhouding

Eén app voor de drie sporen:
- **Spoor 1**, privé A. Dreves: positie, schuldverloop, aflossingstoets en vertrekberekening.
- **Spoor 2**, Dreves Holding B.V.: dubbel boekhouden (fase A).
- **Spoor 3**: nog een lege tab.

Een tab is direct te openen met `?spoor=2`.

## Lokaal
```bash
cd app
docker compose up --build      # http://localhost:8080
```
De data staat in het volume `boekhouding_pgdata` en overleeft rebuilds en
`docker compose down`. `docker compose down -v` wist haar; bij de volgende
start wordt de stamdata uit `database/init.sql` opnieuw geladen.

Zonder Docker: `npm install && npm start` in `server/` (tegen een Postgres op
`localhost:5432`) en `npm run dev` in `client/`. Rekentests: `npm test` in
`server/`.

## Productie
Drie images: `boekhouding-db`, `-server` en `-client`, met dezelfde
`IMAGE_TAG`. `docker-compose.prd.yml` samen met een `.env` (zie `.env.example`). De database
staat in een bind mount op `${DATA_DIR}/postgres`: een nieuwe `IMAGE_TAG`
vervangt alleen de images, de data blijft staan.

## Schema en data
- `database/init.sql` bevat het schema en de stamdata van spoor 1 (stand
  2026-09-23). Het zit in het db-image en draait alleen op een leeg volume.
  Daarna is de UI leidend.
- Aanvullingen op de stamdata komen in `database/0N-aanvulling-*.sql`. Bij een
  nieuwe installatie draait Postgres die na `init.sql`. Op een bestaande database
  (productie) voer je ze met de hand uit, zie de kop van het script. Ze voegen
  alleen toe wat er nog niet staat.
- Schemawijzigingen daarna gaan in `server/migrations/`; zie de README daar.
- Welke velden te bewerken zijn, staat in `server/src/resources.js`. De
  formulieren in de client worden daaruit opgebouwd.
- Geen directe identifiers (BSN, IBAN, adressen, geboortedata) invoeren; zie
  `../CLAUDE.md`.

## Boekhouding (spoor 2)
Het journaal is de administratie van de holding (art. 2:10 BW, art. 52 AWR):
- **In balans:** de server weigert een boeking waarvan debet en credit niet
  gelijk zijn, of waarvan de datum buiten een open boekjaar valt.
- **Concept en definitief:** een definitieve boeking is niet meer te wijzigen
  of te verwijderen. Corrigeren gaat met een tegenboeking.
- **Boekjaar afsluiten** kan alleen zonder conceptboekingen. Daarna kan er
  niets meer in dat boekjaar worden geboekt.
- **Wijzigingslog:** elke wijziging in het journaal komt in `wijziging_log`,
  met de oude en de nieuwe versie.
- **Bijlagen** staan op schijf onder hun sha256 (`/data/bijlagen`). Bij het
  openen wordt de hash opnieuw berekend. Een bijlage bij een definitieve boeking
  kan niet worden verwijderd.
- **Leningen:** het journaal is leidend. De app rekent uit wat het saldo en de
  rente horen te zijn, zet een renteboeking klaar als concept, en meldt een
  verschil met het grootboek.
- **Controles** in het overzicht: conceptboekingen, ontbrekende bijlagen,
  rente die nog niet is geboekt, leningen zonder overeenkomst (art. 2:247 BW),
  de rekening-courant DGA boven € 500.000 (art. 4.14a Wet IB 2001), en de open
  punten uit de vastlegging.
- Nog niet gebouwd (fase B/C): fiscale correcties en VpB, RGS-koppeling en
  exports (aangifte, XAF, micro-jaarrekening), ING-import (CAMT.053), btw.

## Rekenregels (spoor 1)
- **Rente** wordt per kalenderjaar of per contractjaar berekend (instelling per
  lening), naar rato van het aantal dagen in dat jaar. Bij bijschrijven telt de
  rente aan het eind van de periode op bij de schuld, en loopt er daarna rente
  over rente. Lening 2024: bijgeschreven op 31-12 (B-GL-2024 art. 2.2).
- **Aflossingen** voer je zelf in. Het dividendpercentage (art. 3.2) wordt niet
  automatisch afgeboekt maar per kalenderjaar getoetst: verplicht tegenover
  werkelijk afgelost, ook cumulatief. Zonder dividend is er geen verplichting.
- Waarde = ondernemingswaarde ÷ noemer × aantal certificaten, gerekend voor
  elke noemer (V-O01).
- **Aflossen of aanhouden** (tab Vertrek): de app vergelijkt jouw aflosplan (extra
  per maand, eenmalig) met alleen de verplichte aflossing uit dividend. "Eigen
  geld" is de som van alle kasstromen vanaf vandaag (dividend in, aflossingen
  uit), jaarlijks samengesteld met het rendement dat je op de schuif kiest. Het
  vermogenseffect is het verschil tussen de twee plannen in (eigen geld −
  schuld). Alles vóór inkomstenbelasting. Een aflossing boven de hoofdsom
  betaalt ook de opgelopen rente, zodat volledig aflossen echt op nul uitkomt.
  De vertrekdatum en het aflosplan gelden ook voor de vertrekberekening.
- Vertrek: de extra korting van art. 6.5 gaat van de Marktwaarde af vóórdat het
  leaverpercentage wordt toegepast. Dat is een lezing van het artikel, geen
  vaststaand gegeven.
