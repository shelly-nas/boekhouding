# Graph Report - boekhouding  (2026-09-27)

## Corpus Check
- 63 files · ~58,642 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 526 nodes · 1041 edges · 35 communities (32 shown, 3 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d9676ad7`
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
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]

## God Nodes (most connected - your core abstractions)
1. `datum()` - 25 edges
2. `Index per document` - 25 edges
3. `pct()` - 23 edges
4. `schuldOp()` - 19 edges
5. `q()` - 18 edges
6. `q()` - 18 edges
7. `Overdracht()` - 17 edges
8. `eurc()` - 17 edges
9. `plusJaren()` - 15 edges
10. `schuldverloop()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `rapport()` --calls--> `regels`  [INFERRED]
  app/server/src/administratie.js → app/server/test/rekenen.test.js
- `rapport()` --calls--> `regels`  [INFERRED]
  app/server/src/spoor2.js → app/server/test/rekenen.test.js
- `Overdracht()` --calls--> `plusJaren()`  [INFERRED]
  app/client/src/Overdracht.jsx → app/server/src/rekenen.js
- `vermogen()` --calls--> `som()`  [INFERRED]
  app/server/src/prive.js → app/server/src/jaarrekening.js
- `planUitQuery()` --calls--> `getal`  [INFERRED]
  app/server/src/verra.js → app/client/src/format.js

## Communities (35 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (57): aflossingenVoor(), boxIndicatie(), breakEven(), dagenInJaar(), dagenTussen(), jaaroverzicht(), leaverPrijs(), leaverRegel() (+49 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (49): MIGRATIES, migreer(), pool, wachtOpDatabase(), aflossingenPerLening(), leningen(), q(), app (+41 more)

### Community 2 - "Community 2"
Cohesion: 0.1
Nodes (42): bijlagePad(), boekjaarVoor(), boekRente(), cent(), Conflict, controles(), eur(), euro() (+34 more)

### Community 3 - "Community 3"
Cohesion: 0.15
Nodes (31): bijlagePad(), boekjaarVoor(), boekRente(), cent(), Conflict, controles(), eur(), euro() (+23 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (31): B-AKTE-2025, B-AKTE-CERT, B-AKTE-OPR, B-DIV-2025-05, B-DOC-OPR, B-FACT-KVK, B-GL-2024, B-GL-2025 (+23 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (19): Balanszijde(), Grootboek(), legeRegel(), ONDERDELEN, Overzicht(), PostEditor(), STAMDATA, eurc() (+11 more)

### Community 6 - "Community 6"
Cohesion: 0.13
Nodes (17): Lening(), datum(), num(), pct(), Prive(), Aflossen(), DividendToets(), Jaaroverzicht() (+9 more)

### Community 7 - "Community 7"
Cohesion: 0.16
Nodes (15): api, DividendToets(), ONDERDELEN, Overzicht(), STAMDATA, eur(), euro, euroCent (+7 more)

### Community 8 - "Community 8"
Cohesion: 0.16
Nodes (10): Financiering(), Tijdlijn(), useOnderdeel(), Aflossen(), Jaaroverzicht(), jarenTussen(), maandenTussen(), ONDERDELEN (+2 more)

### Community 9 - "Community 9"
Cohesion: 0.13
Nodes (14): A. De transactie, Aftrekbaarheid van het honorarium, B. De kopersgroep, C. De VERRA-groep — zes vennootschappen, D. Fasering en honorarium, E. Feiten / absolute waarheden, F. Aannames, Facturatie loopt via IP Holding (+6 more)

### Community 10 - "Community 10"
Cohesion: 0.21
Nodes (9): BELASTINGDIENST, jci(), linkTekst(), MetBronnen(), OVERSLAAN, verwerk(), WET, Zijde() (+1 more)

### Community 11 - "Community 11"
Cohesion: 0.15
Nodes (12): 1. Wat vaststaat, 2. De twee routes, 3. Het beslissende fiscale punt: de 5%-grens, 4. Afweging per aspect, 5. Wat dit voor Ashley bijzonder maakt, 6. Aandachtspunten, 7. Openstaande vragen, code:block1 (Dreves Holding   Fortimare   Uddevalla   IP Holding) (+4 more)

### Community 12 - "Community 12"
Cohesion: 0.17
Nodes (11): Boekhouding — werkinstructies, Bronnen op de NAS, Canonieke opslag: Notion, Drie sporen, Herindexeren na een documentwijziging, Persoonsgegevens (AVG), Rol, Taal (+3 more)

### Community 13 - "Community 13"
Cohesion: 0.18
Nodes (10): code:bash (python3 tools/scan-nas.py                 # rapporteer versc), code:bash (python3 tools/maskeer.py --pdf "/Volumes/Documents/.../akte.), maskeer.py — persoonsgegevens eruit, scan-nas.py — wat is er veranderd?, tools, Waarom geen naam-pseudonimisering, Wat het bewust níet maskeert, Wat het maskeert (+2 more)

### Community 14 - "Community 14"
Cohesion: 0.2
Nodes (9): Administratie Dreves Holding B.V., Boekhouding (spoor 2), code:bash (cd app), Lokaal, Productie, Rekenregels (spoor 1), Rekenregels (Verra A&V en Financiering), Schema en data (+1 more)

### Community 15 - "Community 15"
Cohesion: 0.22
Nodes (8): code:block1 (Ashley Dreves (privé)), Deelnemingen, Doorlopende verrekeningen, Fiscale eenheden, Leningen en rekening-courant, Rectificatie en bijkoop (B-MAIL-2025-12), Relaties tussen de drie sporen, Structuurschema (per 2026-09-23)

### Community 16 - "Community 16"
Cohesion: 0.22
Nodes (8): Bijwerken na een documentwijziging, Boekhouding, code:bash (python3 tools/scan-nas.py        # wat is nieuw, gewijzigd o), Drie sporen, Overige bestanden, Persoonsgegevens, Status, Uitgangspunt

### Community 17 - "Community 17"
Cohesion: 0.22
Nodes (8): 1. Wat de overeenkomst voorschrijft, 2. De drie noemers die in de stukken voorkomen, 3. Wat dit betekent voor de waarde per certificaat, 4. De kern van het probleem, 5. Waarom dit nu uitmaakt, 6. Kanttekeningen bij de waardering zelf (B-WRD-2025), 7. Wat hier níet uit blijkt, Analyse: waardering certificaten VERRA

### Community 18 - "Community 18"
Cohesion: 0.22
Nodes (8): A. Betrokken entiteiten, B. Positie A. Dreves, C. Feiten / absolute waarheden, D. Leaver-regeling (B-PART-OVK art. 6), E. Aannames, F. Openstaande vragen, G. Aandachtspunten, VERRA-participatie — A. Dreves

### Community 19 - "Community 19"
Cohesion: 0.22
Nodes (8): A. Identiteit, B. Zeggenschap en belang, C. Fiscale positie, D. Feiten / absolute waarheden, Dreves Holding B.V., E. Aannames, F. Openstaande vragen, G. Aandachtspunten

### Community 20 - "Community 20"
Cohesion: 0.22
Nodes (8): A. Identiteit, B. Zeggenschap en belang, C. Fiscale positie, D. Feiten / absolute waarheden, E. Aannames, F. Openstaande vragen, G. Aandachtspunten, <Naam entiteit> <rechtsvorm>

### Community 21 - "Community 21"
Cohesion: 0.36
Nodes (7): dmj(), Grafiek(), kort, MARGE, ms(), netteStap(), vol

### Community 22 - "Community 22"
Cohesion: 0.25
Nodes (7): code:block1 (Ondernemen  (hoofdpagina, onder "VERRA")), Doelpagina, Notion — vastlegging VERRA, Paginastructuur, Schrijfregels, Synchronisatie, Toegang

### Community 23 - "Community 23"
Cohesion: 0.25
Nodes (7): Bron-id's, Bronnen, code:block1 (ls -la /Volumes/), Documenten zonder tekstlaag, Persoonsgegevens, Status NAS, Werkwijze

### Community 24 - "Community 24"
Cohesion: 0.43
Nodes (6): bron_ids(), hash_bestand(), lees_state(), main(), Bestandsnamen die in het bronregister voorkomen., scan()

### Community 25 - "Community 25"
Cohesion: 0.47
Nodes (3): lees(), main(), maskeer()

### Community 27 - "Community 27"
Cohesion: 0.33
Nodes (5): Bron: <documentnaam>, Feiten die hieruit volgen, Vragen die het oproept, Wat het document is, Wat het document níet zegt

### Community 28 - "Community 28"
Cohesion: 0.33
Nodes (5): Afgesloten, Fiscaal / administratief, Onderhandeling, Op te vragen stukken, Register openstaande vragen

### Community 29 - "Community 29"
Cohesion: 0.4
Nodes (4): De structuurvraag, In één oogopslag, Spoor 3 — Overname 40% VERRA-groep, Twee punten vóór ondertekening

### Community 30 - "Community 30"
Cohesion: 0.4
Nodes (4): Rol in de overname, Samenvatting positie, Spoor 2 — Dreves Holding B.V., Termijnen

### Community 31 - "Community 31"
Cohesion: 0.5
Nodes (3): Samenvatting positie, Spoor 1 — Privébezittingen A. Dreves, Wat dit spoor bepaalt

## Knowledge Gaps
- **205 isolated node(s):** `Bestandsnamen die in het bronregister voorkomen.`, `contract`, `kalender`, `v`, `op3112` (+200 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Overdracht()` connect `Community 1` to `Community 0`, `Community 10`, `Community 6`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `schuldOp()` connect `Community 1` to `Community 0`, `Community 2`, `Community 3`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `Overzicht()` connect `Community 1` to `Community 8`, `Community 6`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **What connects `Bestandsnamen die in het bronregister voorkomen.`, `contract`, `kalender` to the rest of the system?**
  _205 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._