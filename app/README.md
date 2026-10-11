# Webapp boekhouding

Eén app, ingedeeld naar functie (sinds migratie 010). Het startscherm
**Overzicht** toont de structuur: VERRA (eigenaren, STAK, de zes vennootschappen)
met daaronder A. Dreves en Dreves Holding, en de verbanden daartussen. Een blok
aanklikken toont alle afhankelijkheden; eroverheen bewegen licht ze op. Daarboven
de kerncijfers en een korte balans. Verbanden komen uit de tabel `relatie` en
vanzelf uit de certificaatposities en leningen (migratie 014).
Onder het schema staan de **geldstromen vanuit A. Dreves** (`/api/geldstromen`):
dividend van Verra A&V privé en via de holding, rente, aflossing, VpB, box 2 en
de uitkering van de holding aan privé, per jaar en als stroomschema. De
"waarde voor A. Dreves" telt geld in de holding mee na latente box 2 (A15). De eigen partijen — privé
A. Dreves en Dreves Holding B.V. — zijn partijen in de database, geen sporen.
- **Verra A&V**: de certificaatposities van privé en holding in Verra Aan- en
  Verkoop, de gedeelde waardering, en voor de privépositie het vertrekplan met
  de leaverregeling.
- **Financiering**: alle leningen van privé en holding. Voor een lening die in de
  administratie van de holding wordt geboekt, is het journaal leidend.
- **Overdracht** privé → holding: verkoop van de privécertificaten tegen
  marktwaarde (×3 tot ×4), per jaar van overdracht: resultaat en box 2-heffing,
  schuld die opeisbaar kan worden, belasting op het dividend daarna, voorwaarden.
- **Overname** 40% VERRA-groep: volgt.
- **Administratie**: Dreves Holding B.V. volledig (journaal, grootboek,
  leningen, controles, concept-jaarrekening en VpB-berekening met en zonder
  deelnemingsvrijstelling); privé: het vermogen uit dit dossier (certificaten,
  lening 2024, aandelen holding) en per jaar de box, de stand op 1 januari,
  dividend, dividendbelasting en rente.

Wetsverwijzingen in de schermen ("art. … Wet IB 2001", "art. 2:… BW", …) worden
automatisch links naar wetten.overheid.nl (`client/src/bronnen.jsx`).

Direct openen: `?module=verra|financiering|overdracht|overname|administratie`,
eventueel met `&deel=<subtab>`; bij Administratie `&partij=prive|holding`.

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
**boekhouding.shelly-nas.nl.** Elke merge naar `main` die `app/` raakt, gaat
direct naar productie (`.github/workflows/deploy.yml`). Drie images,
`boekhouding-db`, `-server` en `-client`, getagd met de commit (en `latest`);
`docker-compose.prod.yml` pint de commit als `IMAGE_TAG`, en
`GET /api/health` meldt hem als `version`.

De database en de bijlagen staan in de externe Docker-volumes
`boekhouding-db-data` en `boekhouding-bijlagen`. De eerste deploy maakt ze aan
(en de database krijgt dan `init.sql` en de aanvullingen); elke volgende deploy
hergebruikt ze. Geen deploy, opschoning of `docker compose down -v` verwijdert
ze; weggooien is altijd een bewuste `docker volume rm`.

Opnieuw deployen of terugrollen: *Actions → Build & Deploy to Production → Run
workflow*, op `main` of op een eerdere commit. Migraties worden bij een
rollback niet teruggedraaid.

## CI en acceptatie (acc)
De workflows staan in `.github/workflows/` in de root van de repo en
reageren alleen op wijzigingen onder `app/`. Een PR die alleen de vastlegging
(markdown) raakt, draait ze niet.

- **`ci.yml`**, bij elke push en PR: clientbuild; `init.sql` en de aanvullingen
  op een verse Postgres 17; de aanvullingen nog een keer (het aantal rijen moet
  gelijk blijven); een controle op dubbele migratienummers; alle migraties twee
  keer via `migreer()`; `npm test` in `server/`.
- **`acc.yml`**, bij elke PR naar `main`: bouwt de drie images als
  `acc-<commit>` en zet ze op **boekhouding-acc.shelly-nas.nl**
  (`/volume1/docker/boekhouding-acc`, `docker-compose.acc.yml`). De database
  wordt elke deploy opnieuw opgebouwd uit het db-image. Er komt nooit een
  kopie van productie op. Bij het sluiten of mergen van de PR ruimt
  `teardown-acceptance.yml` acc op, tenzij er intussen een andere PR op staat.
  Eén acc: de laatst gepushte PR wint. Met *Run workflow* zet je een branch er
  met de hand op.

Bekijk de wijziging op acc en merge daarna. Dat is de goedkeuring, en de merge
is de release (zie *Productie*).

Vereist in de GitHub-repo: de variables `REGISTRY_URL`, `REGISTRY_USERNAME`,
`DB_USER`, `DB_NAME` (optioneel `TZ`) en de secrets `REGISTRY_PASSWORD` en
`DB_PASSWORD`. Plus een self-hosted runner `shelly` op de NAS.

## Vormgeving
Volgt de shelly-nas designrichtlijnen (Web App Template):
`client/src/tokens.css` is de bron van waarheid voor kleur, spacing en radius.
`styles.css` leest alleen rollen (`--primary`, `--surface`, `--text-muted`),
nooit hexwaarden. Lettertype Figtree, self-hosted via `@fontsource/figtree`.
Dark mode volgt het systeem; de knop onderin de sidebar legt een eigen keuze
vast (`localStorage` `thema`). De grafiekreeksen (`--reeks-1..3`) zijn een apart
gevalideerd palet, want een reeks betekent geen actie of status.

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

## Administratie Dreves Holding B.V.
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

## Rekenregels (Verra A&V en Financiering)
- **Rente** wordt per kalenderjaar of per contractjaar berekend (instelling per
  lening), naar rato van het aantal dagen in dat jaar. Bij bijschrijven telt de
  rente aan het eind van de periode op bij de schuld, en loopt er daarna rente
  over rente. Lening 2024: bijgeschreven op 31-12 (B-GL-2024 art. 2.2).
- **Aflossingen** voer je zelf in. Het dividendpercentage (art. 3.2) wordt niet
  automatisch afgeboekt maar per kalenderjaar getoetst: verplicht tegenover
  werkelijk afgelost, ook cumulatief. Zonder dividend is er geen verplichting.
- **Rekenbasis:** waarde = ondernemingswaarde ÷ noemer × aantal aandelen. De noemer
  met "Rekenbasis" aan in Stamdata → Noemers (nu 300) en het "Aantal aandelen
  (rekenbasis)" van de positie (nu 13,5, aanname A11) worden overal gebruikt.
  Staat er geen noemer als rekenbasis, dan toont de app alle noemers naast elkaar.
- **Aflossen of aanhouden** (tab Vertrek): de app vergelijkt jouw aflosplan (extra
  per maand, eenmalig) met alleen de verplichte aflossing uit dividend. "Eigen
  geld" is de som van alle kasstromen vanaf vandaag (dividend in, aflossingen
  uit), jaarlijks samengesteld met het rendement dat je op de schuif kiest. Het
  vermogenseffect is het verschil tussen de twee plannen in (eigen geld −
  schuld). Alles vóór inkomstenbelasting. Een aflossing boven de hoofdsom
  betaalt ook de opgelopen rente, zodat volledig aflossen echt op nul uitkomt.
  De vertrekdatum en het aflosplan gelden ook voor de vertrekberekening.
- **Jaaroverzicht** (tab Vertrek): dezelfde opbouw als het eigen ROI-model
  (B-ROI). Per jaar: lening, rente, dividend van de vennootschap (× aandeel via
  de gekozen noemer), netto dividend, aflossing, waarde certificaten (inleg of
  een waardering), vermogen (waarde − lening), cumulatief kasoverschot (netto
  dividend − aflossingen) en netto resultaat (de som van die twee). ROI = netto
  resultaat ÷ inleg. Jaren tot vandaag komen uit de werkelijke dividenden en
  aflossingen. Het dividend van toekomstige jaren vul je per jaar in. Kies je
  "volledig netto dividend aflossen", dan werkt het net als het ROI-model.
- **Waarde certificaten per jaar** volgt de methode van de verkopers (B-PRES dia 5
  en 7): de waardering per eind van jaar J−1 is de prijs in jaar J. Volgorde:
  1. een vastgestelde waardering die in jaar J als prijs geldt (Stamdata → Waarderingen);
  2. anders factor × (3·R(J−1) + 2·R(J−2) + 1·R(J−3)) / 6 uit Stamdata → Jaarresultaten
     (wegingen in Instellingen);
  3. anders de waarde van het jaar ervoor, met de ingestelde groei;
  4. anders, en altijd in het jaar van verkrijging: de instapprijs (inleg).

  Daarna ÷ noemer × aantal aandelen (rekenbasis). Een nieuw jaarresultaat of een
  nieuwe prognose schuift de weging direct mee. De Excel B-ROI-APP rekent
  hetzelfde, via de bladen Waarderingen en Jaarresultaten.
- Vertrek: de extra korting van art. 6.5 gaat van de Marktwaarde af vóórdat het
  leaverpercentage wordt toegepast. Dat is een lezing van het artikel, geen
  vaststaand gegeven.
