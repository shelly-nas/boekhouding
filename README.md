# Boekhouding

Vastlegging en onderbouwing voor de boekhouding en fiscale positie, gericht op
Nederlands ondernemings- en belastingrecht.

## Drie sporen
De administratie valt uiteen in drie sporen met elk een eigen fiscaal regime.

| Spoor | Betreft | Regime |
|---|---|---|
| [1 · Privé A. Dreves](1-prive-a-dreves/) | 9 certificaten VERRA, schuld € 17.100, 100% Dreves Holding | box 2 of box 3 — zie V-O01 |
| [2 · Dreves Holding B.V.](2-dreves-holding/) | KvK 99257467, certificaten tranche 2, schuld € 12.094,50 | VpB |
| [3 · Overname 40% VERRA](3-overname-verra/) | Vier kopende holdings, € 2.000.000, adviseur Atlantis Invest | VpB, aankoopkosten deelneming |

De sporen raken elkaar: Dreves Holding is koper in spoor 3, en de bestaande
certificaten uit spoor 1 en 2 zien op een vennootschap die tot de over te nemen
groep behoort. Die verbanden staan in [RELATIES.md](RELATIES.md).

## Overige bestanden
| Pad | Inhoud |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Werkinstructies: rol, vastleggingsmodel, werkwijze |
| [RELATIES.md](RELATIES.md) | Structuurschema, leningen, doorbelastingen |
| [openstaande-vragen/REGISTER.md](openstaande-vragen/REGISTER.md) | Alle vragen, gesplitst fiscaal vs. onderhandeling |
| [bronnen/nas-index/REGISTER.md](bronnen/nas-index/REGISTER.md) | Bronregister: alle gelezen NAS-documenten |
| [NOTION.md](NOTION.md) | Notion-pagina VERRA: structuur en schrijfregels |
| [SYNC.md](SYNC.md) | Wat is wanneer naar Notion overgezet |
| [templates/](templates/) | Formats voor entiteit en bron |
| [tools/](tools/) | `scan-nas.py` (wat is er veranderd) en `maskeer.py` (persoonsgegevens) |

## Bijwerken na een documentwijziging
```bash
python3 tools/scan-nas.py        # wat is nieuw, gewijzigd of verdwenen?
```
Het script vergelijkt de NAS met `bronnen/nas-index/state.json` en wijst aan wat
opnieuw gelezen moet worden. De werkwijze daarna staat in
[tools/README.md](tools/README.md) en [CLAUDE.md](CLAUDE.md).

## Persoonsgegevens
Directe identifiers (BSN, IBAN, privéadressen, geboortedata) worden **niet** in
deze repo of op Notion vastgelegd. Namen, KvK-nummers en RSIN wél — die zijn
nodig voor de analyse en grotendeels openbaar. Zie [CLAUDE.md](CLAUDE.md) en
[tools/README.md](tools/README.md).

## Uitgangspunt
Feiten, aannames en openstaande vragen worden strikt gescheiden vastgelegd.
Elk feit draagt een bron en een datum. Wat niet vaststaat, wordt een vraag —
geen schatting die later als feit gelezen wordt.

## Status
Opgezet 2026-09-23; 15 NAS-documenten ingelezen en vastgelegd.

Openstaand: 36 fiscale vragen (V-F01–V-F36) en 16 onderhandelingspunten
(V-O01–V-O16). Twee punten hebben een **deadline vóór ondertekening** van de
opdrachtbevestiging: V-O13 (hoofdelijkheid) en V-O14 (eigen advisering bij de
verdeling van het belang). De structuurkeuze — gezamenlijke koopholding of
persoonlijke holdings — valt in fase 2, die parallel aan fase 1 start.
