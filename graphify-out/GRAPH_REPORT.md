# Graph Report - boekhouding  (2026-09-26)

## Corpus Check
- 48 files · ~47,937 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 385 nodes · 564 edges · 30 communities (28 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ca7e4405`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]

## God Nodes (most connected - your core abstractions)
1. `Index per document` - 21 edges
2. `q()` - 18 edges
3. `leaver()` - 13 edges
4. `Boekhouding — werkinstructies` - 11 edges
5. `schuldOp()` - 10 edges
6. `simuleer()` - 10 edges
7. `naarDatum()` - 9 edges
8. `plusJaren()` - 9 edges
9. `simulatie()` - 9 edges
10. `pct()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `rapport()` --calls--> `regels`  [INFERRED]
  app/server/src/spoor2.js → app/server/test/rekenen.test.js
- `planUitQuery()` --calls--> `getal`  [INFERRED]
  app/server/src/spoor1.js → app/client/src/format.js
- `laad()` --calls--> `q()`  [INFERRED]
  app/server/src/spoor1.js → app/server/src/spoor2.js
- `leningDetail()` --calls--> `plusJaren()`  [EXTRACTED]
  app/server/src/spoor2.js → app/server/src/rekenen.js
- `leningDetail()` --calls--> `schuldOp()`  [EXTRACTED]
  app/server/src/spoor2.js → app/server/src/rekenen.js

## Communities (30 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (32): api, SPOREN, datum(), eur(), eurc(), euro, euroCent, getal (+24 more)

### Community 1 - "Community 1"
Cohesion: 0.16
Nodes (34): aflossingenVoor(), boxIndicatie(), breakEven(), dagenInJaar(), dagenTussen(), DIVIDENDTARIEF, dividendToets(), jaaroverzicht() (+26 more)

### Community 2 - "Community 2"
Cohesion: 0.15
Nodes (31): bijlagePad(), boekjaarVoor(), boekRente(), cent(), Conflict, controles(), eur(), euro() (+23 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (26): afl, b, b0, bad, badLaag, basis, contract, div (+18 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (27): B-AKTE-CERT, B-AKTE-OPR, B-DIV-2025-05, B-DOC-OPR, B-FACT-KVK, B-GL-2024, B-GL-2025, B-KVK-DRV (+19 more)

### Community 5 - "Community 5"
Cohesion: 0.1
Nodes (20): MIGRATIES, migreer(), pool, wachtOpDatabase(), app, invoervelden(), kolommen, LABEL (+12 more)

### Community 6 - "Community 6"
Cohesion: 0.13
Nodes (14): A. De transactie, Aftrekbaarheid van het honorarium, B. De kopersgroep, C. De VERRA-groep — zes vennootschappen, D. Fasering en honorarium, E. Feiten / absolute waarheden, F. Aannames, Facturatie loopt via IP Holding (+6 more)

### Community 7 - "Community 7"
Cohesion: 0.15
Nodes (12): 1. Wat vaststaat, 2. De twee routes, 3. Het beslissende fiscale punt: de 5%-grens, 4. Afweging per aspect, 5. Wat dit voor Ashley bijzonder maakt, 6. Aandachtspunten, 7. Openstaande vragen, code:block1 (Dreves Holding   Fortimare   Uddevalla   IP Holding) (+4 more)

### Community 8 - "Community 8"
Cohesion: 0.17
Nodes (11): Boekhouding — werkinstructies, Bronnen op de NAS, Canonieke opslag: Notion, Drie sporen, Herindexeren na een documentwijziging, Persoonsgegevens (AVG), Rol, Taal (+3 more)

### Community 9 - "Community 9"
Cohesion: 0.18
Nodes (10): code:bash (python3 tools/scan-nas.py                 # rapporteer versc), code:bash (python3 tools/maskeer.py --pdf "/Volumes/Documents/.../akte.), maskeer.py — persoonsgegevens eruit, scan-nas.py — wat is er veranderd?, tools, Waarom geen naam-pseudonimisering, Wat het bewust níet maskeert, Wat het maskeert (+2 more)

### Community 10 - "Community 10"
Cohesion: 0.22
Nodes (8): code:block1 (Ashley Dreves (privé)), Deelnemingen, Doorlopende verrekeningen, Fiscale eenheden, Leningen en rekening-courant, Rectificatie en bijkoop (B-MAIL-2025-12), Relaties tussen de drie sporen, Structuurschema (per 2026-09-23)

### Community 11 - "Community 11"
Cohesion: 0.22
Nodes (8): Bijwerken na een documentwijziging, Boekhouding, code:bash (python3 tools/scan-nas.py        # wat is nieuw, gewijzigd o), Drie sporen, Overige bestanden, Persoonsgegevens, Status, Uitgangspunt

### Community 12 - "Community 12"
Cohesion: 0.22
Nodes (8): 1. Wat de overeenkomst voorschrijft, 2. De drie noemers die in de stukken voorkomen, 3. Wat dit betekent voor de waarde per certificaat, 4. De kern van het probleem, 5. Waarom dit nu uitmaakt, 6. Kanttekeningen bij de waardering zelf (B-WRD-2025), 7. Wat hier níet uit blijkt, Analyse: waardering certificaten VERRA

### Community 13 - "Community 13"
Cohesion: 0.22
Nodes (8): A. Betrokken entiteiten, B. Positie A. Dreves, C. Feiten / absolute waarheden, D. Leaver-regeling (B-PART-OVK art. 6), E. Aannames, F. Openstaande vragen, G. Aandachtspunten, VERRA-participatie — A. Dreves

### Community 14 - "Community 14"
Cohesion: 0.22
Nodes (8): A. Identiteit, B. Zeggenschap en belang, C. Fiscale positie, D. Feiten / absolute waarheden, Dreves Holding B.V., E. Aannames, F. Openstaande vragen, G. Aandachtspunten

### Community 15 - "Community 15"
Cohesion: 0.22
Nodes (8): A. Identiteit, B. Zeggenschap en belang, C. Fiscale positie, D. Feiten / absolute waarheden, E. Aannames, F. Openstaande vragen, G. Aandachtspunten, <Naam entiteit> <rechtsvorm>

### Community 16 - "Community 16"
Cohesion: 0.36
Nodes (7): dmj(), Grafiek(), kort, MARGE, ms(), netteStap(), vol

### Community 17 - "Community 17"
Cohesion: 0.25
Nodes (7): code:block1 (VERRA  (hoofdpagina)), Doelpagina, Notion — vastlegging VERRA, Paginastructuur, Schrijfregels, Synchronisatie, Toegang

### Community 18 - "Community 18"
Cohesion: 0.25
Nodes (7): Boekhouding (spoor 2), code:bash (cd app), Lokaal, Productie, Rekenregels (spoor 1), Schema en data, Webapp boekhouding

### Community 19 - "Community 19"
Cohesion: 0.25
Nodes (7): Bron-id's, Bronnen, code:block1 (ls -la /Volumes/), Documenten zonder tekstlaag, Persoonsgegevens, Status NAS, Werkwijze

### Community 20 - "Community 20"
Cohesion: 0.43
Nodes (6): bron_ids(), hash_bestand(), lees_state(), main(), Bestandsnamen die in het bronregister voorkomen., scan()

### Community 21 - "Community 21"
Cohesion: 0.47
Nodes (3): lees(), main(), maskeer()

### Community 22 - "Community 22"
Cohesion: 0.33
Nodes (5): Bron: <documentnaam>, Feiten die hieruit volgen, Vragen die het oproept, Wat het document is, Wat het document níet zegt

### Community 23 - "Community 23"
Cohesion: 0.33
Nodes (5): Afgesloten, Fiscaal / administratief, Onderhandeling, Op te vragen stukken, Register openstaande vragen

### Community 24 - "Community 24"
Cohesion: 0.4
Nodes (4): De structuurvraag, In één oogopslag, Spoor 3 — Overname 40% VERRA-groep, Twee punten vóór ondertekening

### Community 25 - "Community 25"
Cohesion: 0.4
Nodes (4): Rol in de overname, Samenvatting positie, Spoor 2 — Dreves Holding B.V., Termijnen

### Community 26 - "Community 26"
Cohesion: 0.5
Nodes (3): Samenvatting positie, Spoor 1 — Privébezittingen A. Dreves, Wat dit spoor bepaalt

## Knowledge Gaps
- **184 isolated node(s):** `Bestandsnamen die in het bronregister voorkomen.`, `contract`, `kalender`, `v`, `op3112` (+179 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Overzicht()` connect `Community 1` to `Community 0`, `Community 5`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Why does `Leningen()` connect `Community 2` to `Community 0`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `Journaal()` connect `Community 2` to `Community 0`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `Bestandsnamen die in het bronregister voorkomen.`, `contract`, `kalender` to the rest of the system?**
  _184 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._