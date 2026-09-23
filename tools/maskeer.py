#!/usr/bin/env python3
"""
Maskeert directe identifiers in tekst voordat die met een externe dienst wordt
gedeeld. Bedoeld voor documenten van de NAS.

Wat wél wordt gemaskeerd (directe identifiers, AVG art. 4 lid 1):
  BSN, IBAN, geboortedata, privéadressen, e-mail, telefoon, paspoort/ID-nummers

Wat NIET wordt gemaskeerd (bewuste keuze):
  Namen van personen en bedrijven, KvK-nummers, RSIN, bedragen, percentages.
  Die zijn nodig om kruisverbanden te zien — bijvoorbeeld dat een koper ook als
  kostenpost in het doelwit voorkomt. KvK-nummers en RSIN zijn bovendien
  openbaar via het handelsregister.

Gebruik:
  python3 tools/maskeer.py invoer.txt              # naar stdout
  python3 tools/maskeer.py invoer.txt -o uit.txt   # naar bestand
  python3 tools/maskeer.py --pdf doc.pdf -o uit.txt
  python3 tools/maskeer.py --check invoer.txt      # alleen rapporteren

Let op: dit is een hulpmiddel, geen garantie. Controleer de uitvoer voordat je
die deelt, zeker bij documenten met een ongebruikelijke opmaak.
"""
import argparse, re, subprocess, sys
from pathlib import Path

# ── Elfproef voor BSN (9 cijfers, gewogen som deelbaar door 11) ──────────────
def is_bsn(s: str) -> bool:
    if len(s) != 9 or not s.isdigit():
        return False
    weights = [9, 8, 7, 6, 5, 4, 3, 2, -1]
    return sum(int(c) * w for c, w in zip(s, weights)) % 11 == 0

# ── IBAN-validatie (mod-97) ─────────────────────────────────────────────────
def is_iban(s: str) -> bool:
    s = re.sub(r"\s", "", s).upper()   # ook newlines: pdftotext breekt regels af
    if not re.fullmatch(r"[A-Z]{2}\d{2}[A-Z0-9]{10,30}", s):
        return False
    r = s[4:] + s[:4]
    num = "".join(str(int(c, 36)) for c in r)
    return int(num) % 97 == 1

MAAND = r"(?:januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)"

REGELS = [
    # BSN: 9 cijfers die de elfproef doorstaan. RSIN en KvK-nummers doorstaan
    # die proef ook, dus de regel kijkt naar het label ervoor: alleen maskeren
    # als er géén zakelijke aanduiding aan voorafgaat.
    ("BSN", re.compile(r"(?<!\d)(?<![.,])\b\d{9}\b(?![.,]?\d)"), "[BSN]", is_bsn),

    # IBAN — \s omvat bewust ook newlines: pdftotext breekt nummers over regels af
    ("IBAN", re.compile(r"\b[A-Z]{2}\d{2}[\s]*(?:[A-Z0-9]{4}[\s]*){2,7}[A-Z0-9]{1,4}\b"), "[IBAN]", is_iban),

    # Geboortedatum — alleen met expliciete aanduiding, zodat transactiedata blijven
    ("GEBDATUM", re.compile(
        rf"(geboren te\s+[A-Za-zÀ-ÿ'\- ]+\s+op\s+)(\d{{1,2}}[-/ ]\w+[-/ ]\d{{4}}|[a-z ]+{MAAND}[a-z ]+)",
        re.I), r"\1[GEBOORTEDATUM]", None),
    ("GEBDATUM", re.compile(r"(geb(?:oren)?\.?\s*)(\d{2}-\d{2}-\d{4})", re.I), r"\1[GEBOORTEDATUM]", None),
    ("GEBDATUM", re.compile(r"(Geboortedatum\s+)(\d{2}-\d{2}-\d{4})", re.I), r"\1[GEBOORTEDATUM]", None),

    # Nederlandse postcode + huisnummer (adres van een natuurlijk persoon)
    ("ADRES", re.compile(r"\b\d{4}\s?[A-Z]{2}\b(?=\s+[A-Z])"), "[POSTCODE]", None),
    ("ADRES", re.compile(
        r"\b([A-ZÀ-Ý][a-zà-ÿ]+(?:straat|laan|weg|plein|kade|singel|dijk|gracht|hof|pad|burgwal|plantsoen))\s+\d+\s*[A-Za-z]?\b"),
        r"\1 [HUISNR]", None),

    # Contactgegevens
    ("EMAIL", re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b"), "[EMAIL]", None),
    ("TELEFOON", re.compile(r"\b(?:\+31|0)\s?6[\s-]?\d{8}\b"), "[TELEFOON]", None),

    # Reisdocumenten
    ("IDNUMMER", re.compile(r"\b[A-Z]{2}\d{7}\b"), "[IDNUMMER]", None),
]

# Labels die aangeven dat een 9-cijferig getal géén BSN is maar een openbaar
# bedrijfsnummer. Deze staan in KvK-uittreksels vlak vóór het nummer.
ZAKELIJK_LABEL = re.compile(
    r"(?:RSIN|KVK[- ]?nummer|KvK[- ]?nr|handelsregister|dossiernummer|"
    r"vestigingsnummer|BTW|OB[- ]?nummer|fiscaal nummer)[^0-9\n]*$", re.I)

def maskeer(tekst: str):
    telling = {}
    for label, patroon, vervanging, validator in REGELS:
        def _sub(m):
            treffer = m.group(0)
            # 9-cijferig getal vlak na een zakelijk label is RSIN/KvK, geen BSN
            if label == "BSN":
                regelstart = tekst.rfind("\n", 0, m.start()) + 1
                if ZAKELIJK_LABEL.search(tekst[regelstart:m.start()]):
                    return treffer
            if validator and not validator(m.group(0) if label != "IBAN" else treffer):
                return treffer
            telling[label] = telling.get(label, 0) + 1
            if callable(vervanging):
                return vervanging(m)
            if "\\1" in vervanging:
                return m.expand(vervanging)
            return vervanging
        tekst = patroon.sub(_sub, tekst)
    return tekst, telling

def lees(pad: Path, is_pdf: bool) -> str:
    if is_pdf or pad.suffix.lower() == ".pdf":
        r = subprocess.run(["pdftotext", "-layout", str(pad), "-"],
                           capture_output=True, text=True)
        if r.returncode != 0:
            sys.exit(f"pdftotext faalde op {pad}: {r.stderr.strip()}")
        return r.stdout
    return pad.read_text(errors="replace")

def main():
    p = argparse.ArgumentParser(description="Maskeer directe identifiers in een document.")
    p.add_argument("bestand", type=Path)
    p.add_argument("-o", "--output", type=Path, help="schrijf naar dit bestand")
    p.add_argument("--pdf", action="store_true", help="forceer pdftotext")
    p.add_argument("--check", action="store_true", help="alleen rapporteren, niets schrijven")
    a = p.parse_args()

    if not a.bestand.exists():
        sys.exit(f"niet gevonden: {a.bestand}")

    tekst = lees(a.bestand, a.pdf)
    gemaskeerd, telling = maskeer(tekst)

    if telling:
        print("Gemaskeerd:", ", ".join(f"{k}×{v}" for k, v in sorted(telling.items())),
              file=sys.stderr)
    else:
        print("Geen directe identifiers aangetroffen.", file=sys.stderr)

    if a.check:
        return
    if a.output:
        a.output.write_text(gemaskeerd)
        print(f"Geschreven naar {a.output}", file=sys.stderr)
    else:
        print(gemaskeerd)

if __name__ == "__main__":
    main()
