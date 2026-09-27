# Notion — vastlegging VERRA

## Doelpagina
- URL: `https://app.notion.com/p/Ondernemen-3e4716f3606d800fb083ce56a342449e`
- Page id: `3e4716f3606d800fb083ce56a342449e` (ongewijzigd)
- **Titel: "Ondernemen"** (was "VERRA")
- Status connector: **geautoriseerd** sinds 2026-09-23
- Locatie in Notion: `Huisje Boompje Beestje / VERRA / Ondernemen`
  (verplaatst op 2026-09-25; was `Huisje Boompje Beestje / MLK 73 / VERRA`)

De nieuwe bovenliggende pagina **VERRA** (`2d7716f3606d808c8120cb774048e8fd`) is
géén dossierpagina maar een werkmap met gespreksnotities per adviseur, in
uitklapblokken: *Akker*, *Oude Hengel* (notaris) en *Financieel Adviseur*.
Die notities bevatten vragen en antwoorden die het dossier raken — zie
`bronnen/nas-index/REGISTER.md` onder N-ADVIES.

## Toegang
De connector loopt via de claude.ai connector-instellingen, niet via een lokale
MCP-server in VS Code. Bij het autoriseren toont Notion een scherm waarin je
selecteert welke pagina's toegankelijk zijn — dáár wordt de toegang verleend,
niet achteraf via het `Connections`-menu van de pagina. Na autoriseren moet
Claude Code opnieuw worden gestart voordat de tools beschikbaar zijn.

## Paginastructuur
De VERRA-pagina spiegelt het model uit `CLAUDE.md`:

Zoals feitelijk aangebracht op 2026-09-23 (secties op één pagina, geen
subpagina's — de omvang rechtvaardigt die nog niet):

Elk spoor heeft een eigen subpagina; de hoofdpagina is de ingang en bevat wat
sporen overstijgt.

```
Ondernemen  (hoofdpagina, onder "VERRA")
├─ Overzicht en leeswijzer — de drie sporen, persoonsgegevens
├─ Wat als eerste aandacht vraagt
│    Deadlines, op te vragen stukken, waar geld op tafel ligt
├─ De VERRA-participatie (spoor 1 + 2)
│    Certificaten, kapitaalstructuur, leaver-regeling
├─ Relaties tussen de sporen
├─ De waarderingsvraag (spoor 1 + 2)
├─ Openstaande vragen — centraal register, alle sporen
├─ Bronnen (per NAS-map) + ontbrekende stukken
├─ Correcties op de eerste versie
│
├─ 📄 Spoor 1 · Privé A. Dreves        (subpagina)
├─ 📄 Spoor 2 · Dreves Holding B.V.    (subpagina)
└─ 📄 Spoor 3 · Overname 40% VERRA     (subpagina)
```

De subpagina-URL's:
- Spoor 1: `https://app.notion.com/p/3e4716f3606d810684c1dcffdad17679`
- Spoor 2: `https://app.notion.com/p/3e4716f3606d8118bbb0c6b0aeabf3b6`
- Spoor 3: `https://app.notion.com/p/3e4716f3606d81589fc1e6c3fecd80e0`

Wat spoor 1 en 2 gelijkelijk raakt — de participatievoorwaarden, de
leaver-regeling en de waarderingsvraag — staat op de hoofdpagina, niet dubbel
op beide subpagina's. Het vragenregister staat centraal op de hoofdpagina; per
spoor staan de relevante vragen ook op de eigen subpagina.

**Let op bij het bijwerken:** de subpagina's zijn `<page>`-blokken in de
hoofdpagina-inhoud. Een `replace_content` op de hoofdpagina zonder die blokken
mee te nemen verwijdert de subpagina's. Gebruik `update_content` met gerichte
vervangingen, of neem de `<page url="...">`-tags letterlijk over.

## Schrijfregels
- Een feit krijgt op Notion altijd: **stelling — bron — vastgesteld op**.
- Feiten worden **niet overschreven**. Achterhaald feit: laten staan, einddatum
  erbij, nieuw feit eronder.
- Openstaande vraag krijgt: **vraag — type — wie moet antwoorden — sinds wanneer
  open — waarom het uitmaakt**.
- Een onderhandelingsvraag krijgt nooit een "antwoord" van ons; die krijgt een
  *standpunt* en een *uitkomst* zodra er overeenstemming is.
- Bedragen: euro, met duizendtalpunt en decimaalkomma (€ 1.250.000,00).
- Datums: ISO (2026-09-23), om verwarring tussen NL- en US-notatie te vermijden.

## Synchronisatie
Repo → Notion is de richting. De repo mag voorlopen; Notion mag dat niet.
Na elke vastleggingssessie:
1. Werk de betreffende entiteitsnotitie in `entiteiten/` bij.
2. Zet de wijziging op de Notion-pagina onder de juiste sectie.
3. Noteer in `SYNC.md` wat is overgezet en wanneer.
