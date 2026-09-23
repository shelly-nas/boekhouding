# Bronnen

Documenten staan op de NAS en worden **niet** in deze repo gekopieerd — te
omvangrijk en te vertrouwelijk. Wat hier staat is het spoor ernaartoe.

## Status NAS
SMB-share op `//jelle@192.168.2.100/Documents`, gemount als `/Volumes/Documents`.
Relevante map: `/Volumes/Documents/Professioneel/`, met daaronder
`Dreves Holding B.V./` en `VERRA/`.

De mount is niet permanent. Controleer vóór gebruik:

```
ls -la /Volumes/
mount | grep -iE 'smb|afp|nfs'
```

Het volledige overzicht van gelezen documenten staat in
[nas-index/REGISTER.md](nas-index/REGISTER.md).

## Werkwijze
1. Document op de NAS gelezen → maak `nas-index/<slug>.md` op basis van
   `templates/bron.md`.
2. Feiten uit het document krijgen een id (`F1`, `F2`, …) en worden overgenomen
   in de entiteitsnotitie, met verwijzing naar dit bronbestand.
3. Zo blijft elk feit herleidbaar tot een document, ook als de NAS niet gemount
   is.

## Bron-id's
Elke bron heeft een id (`B-KVK-DRV`, `B-PART-OVK`, …) waarnaar de feiten in de
entiteitsnotities verwijzen. Nieuwe bronnen krijgen een id in
[nas-index/REGISTER.md](nas-index/REGISTER.md).

## Persoonsgegevens
Directe identifiers worden **niet** in deze repo of op Notion vastgelegd:
BSN, IBAN, privéadressen van natuurlijke personen, geboortedata, e-mailadressen,
telefoonnummers en identiteitsdocumentnummers.

Namen van personen en bedrijven, KvK-nummers, RSIN, bedragen en percentages
blijven wél staan. Die zijn nodig om kruisverbanden te zien — bijvoorbeeld dat
een koper ook als kostenpost in het overnamedoelwit voorkomt — en KvK-nummers
en RSIN zijn openbaar via het handelsregister.

Gebruik `tools/maskeer.py` om een document te maskeren voordat het gedeeld
wordt. Zie `tools/README.md`.

## Documenten zonder tekstlaag
Drie documenten zijn scans zonder OCR-laag (B-PART-OVK, B-GL-2024, B-REG-DRV).
`pdftotext` levert daar niets op. Ze zijn gelezen door de pagina's naar PNG te
renderen met een klein Swift/PDFKit-script; er is op dit systeem geen
`tesseract` of `ocrmypdf` beschikbaar.
