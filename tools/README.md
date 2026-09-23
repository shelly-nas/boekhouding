# tools

## scan-nas.py — wat is er veranderd?

Vergelijkt de NAS met een vastgelegde staat en zegt wat opnieuw gelezen moet
worden. Doet zelf **geen** analyse.

```bash
python3 tools/scan-nas.py                 # rapporteer verschillen
python3 tools/scan-nas.py --update-state  # leg de huidige staat vast
python3 tools/scan-nas.py --json          # machineleesbaar
```

Meldt vijf dingen:

| Signaal | Betekenis |
|---|---|
| **NIEUW** | document dat nog niet is gelezen |
| **GEWIJZIGD** | hash wijkt af — inhoud is aangepast, opnieuw lezen |
| **VERDWENEN** | verplaatst of verwijderd; check of feiten hun bron verliezen |
| **DUPLICATEN** | zelfde inhoud op meerdere paden — één bron, geen twee |
| **NIET IN BRONREGISTER** | bestaat op de NAS maar staat niet in `REGISTER.md` |

De staat staat in `bronnen/nas-index/state.json`: alleen paden en hashes, geen
documentinhoud. Dat bestand hoort in git, zodat je kunt zien wanneer welk
document veranderde.

### Werkwijze bij wijzigingen

1. `python3 tools/scan-nas.py` — kijk wat er speelt.
2. Per gewijzigd of nieuw document: laat het lezen, en werk het spoor bij waar
   het thuishoort (`1-prive-a-dreves/`, `2-dreves-holding/`, `3-overname-verra/`).
3. Raakt het een feit dat al vastligt? **Overschrijf dat feit niet.** Geef het
   oude feit een einddatum en zet het nieuwe eronder — zo blijft zichtbaar wat
   wanneer gold.
4. Beantwoordt het een openstaande vraag? Verplaats die naar *Afgesloten* in
   `openstaande-vragen/REGISTER.md`, met verwijzing naar het nieuwe feit.
5. Werk `bronnen/nas-index/REGISTER.md` bij.
6. Zet de wijziging op Notion en log het in `SYNC.md`.
7. `python3 tools/scan-nas.py --update-state` — pas hierna, als het werk af is.

> Stap 7 pas aan het eind. Zolang de staat niet is bijgewerkt, blijft het
> signaal staan en vergeet je niets.

## maskeer.py — persoonsgegevens eruit

Maskeert directe identifiers in een document voordat het met een externe dienst
wordt gedeeld.

```bash
python3 tools/maskeer.py --pdf "/Volumes/Documents/.../akte.pdf" -o /tmp/veilig.txt
python3 tools/maskeer.py --pdf document.pdf --check    # alleen rapporteren
```

### Wat het maskeert
| Type | Herkenning |
|---|---|
| BSN | 9 cijfers die de elfproef doorstaan |
| IBAN | mod-97-validatie, ook als het nummer over twee regels is afgebroken |
| Geboortedata | alleen met expliciete aanduiding ("geboren te … op", "Geboortedatum") |
| Privéadressen | postcode + huisnummer bij straatnamen |
| E-mail, telefoon, ID-nummers | patroonherkenning |

RSIN en KvK-nummers doorstaan de elfproef ook, maar worden herkend aan het label
ervoor en blijven staan.

### Wat het bewust níet maskeert
Namen van personen en bedrijven, KvK-nummers, RSIN, bedragen, percentages,
functies en rollen.

Dit is een afweging, geen omissie. De analyse leunt op het naast elkaar kunnen
leggen van namen — dat een koper ook als kostenpost in het overnamedoelwit
voorkomt, bijvoorbeeld, of dat dezelfde partij tegelijk werkgever, geldgever en
verkoper is. Met gemaskeerde namen zijn die verbanden onzichtbaar.
KvK-nummers en RSIN zijn bovendien openbaar via het handelsregister.

### Wat het niet kan
- **Scans zonder tekstlaag.** Drie documenten op de NAS zijn beeldscans;
  `pdftotext` haalt daar niets uit en het script dus ook niet. Die moet je zelf
  beoordelen voordat je ze deelt.
- **Ongebruikelijke opmaak.** Een BSN met spaties ertussen, of een adres in een
  vorm die het patroon niet herkent, glipt erdoor.

Controleer de uitvoer voordat je die deelt. Het script verkleint het risico, het
neemt het niet weg.

### Waarom geen naam-pseudonimisering
Overwogen en bewust niet gedaan. Een mapping van "Ashley Dreves → P1" moet ergens
worden vastgelegd, en dat mappingbestand bevat dan alle gevoelige koppelingen op
dezelfde NAS — een nieuw risico in plaats van minder risico. Bovendien verliest
de analyse er haar waarde door.

Wil je dat alsnog, dan is de juiste plek een aparte, versleutelde mapping buiten
deze repo, met alleen pseudoniemen in het dossier zelf.
