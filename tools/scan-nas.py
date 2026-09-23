#!/usr/bin/env python3
"""
Vergelijkt de NAS met het bronregister en zegt wat er is veranderd.

Doet géén analyse — het signaleert alleen wat opnieuw gelezen moet worden.
De interpretatie blijft mensen- (of modellen-)werk.

Gebruik:
  python3 tools/scan-nas.py                 # rapporteer verschillen
  python3 tools/scan-nas.py --update-state  # leg de huidige staat vast
  python3 tools/scan-nas.py --json          # machineleesbaar

Staat wordt bijgehouden in bronnen/nas-index/state.json (hash per document).
Dat bestand bevat alleen paden en hashes, geen documentinhoud.
"""
import argparse, hashlib, json, subprocess, sys
from datetime import date
from pathlib import Path

NAS = Path("/Volumes/Documents/Professioneel")
STATE = Path(__file__).resolve().parent.parent / "bronnen/nas-index/state.json"
REGISTER = Path(__file__).resolve().parent.parent / "bronnen/nas-index/REGISTER.md"

NEGEER = {".DS_Store"}
NEGEER_PREFIX = ("._", "~$")


def hash_bestand(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for blok in iter(lambda: f.read(1 << 16), b""):
            h.update(blok)
    return h.hexdigest()[:16]


def scan() -> dict:
    if not NAS.is_dir():
        sys.exit(f"NAS niet bereikbaar op {NAS}\n"
                 "Controleer of de share gemount is: ls /Volumes/")
    gevonden = {}
    for p in sorted(NAS.rglob("*")):
        if not p.is_file() or p.name in NEGEER:
            continue
        if p.name.startswith(NEGEER_PREFIX):
            continue
        gevonden[str(p.relative_to(NAS))] = hash_bestand(p)
    return gevonden


def lees_state() -> dict:
    if not STATE.exists():
        return {}
    return json.loads(STATE.read_text()).get("documenten", {})


def bron_ids() -> set:
    """Bestandsnamen die in het bronregister voorkomen."""
    if not REGISTER.exists():
        return set()
    return set(REGISTER.read_text().split())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--update-state", action="store_true",
                    help="leg de huidige staat vast als nieuwe referentie")
    ap.add_argument("--json", action="store_true", help="machineleesbare uitvoer")
    a = ap.parse_args()

    nu, was = scan(), lees_state()

    nieuw = {p: h for p, h in nu.items() if p not in was}
    gewijzigd = {p: (was[p], h) for p, h in nu.items() if p in was and was[p] != h}
    verdwenen = {p: h for p, h in was.items() if p not in nu}

    # duplicaten: zelfde hash, ander pad
    per_hash = {}
    for p, h in nu.items():
        per_hash.setdefault(h, []).append(p)
    duplicaten = {h: ps for h, ps in per_hash.items() if len(ps) > 1}

    # documenten die niet in het bronregister voorkomen
    reg = REGISTER.read_text() if REGISTER.exists() else ""
    ongeregistreerd = [p for p in nu if Path(p).name not in reg]

    if a.json:
        print(json.dumps({
            "nieuw": sorted(nieuw), "gewijzigd": sorted(gewijzigd),
            "verdwenen": sorted(verdwenen),
            "duplicaten": {h: sorted(ps) for h, ps in duplicaten.items()},
            "ongeregistreerd": sorted(ongeregistreerd),
            "totaal": len(nu),
        }, indent=2, ensure_ascii=False))
    else:
        print(f"NAS: {len(nu)} documenten onder {NAS}")
        if not was:
            print("\nGeen eerdere staat vastgelegd — draai met --update-state "
                  "om een referentiepunt te zetten.")
        if nieuw:
            print(f"\n■ NIEUW ({len(nieuw)}) — nog niet gelezen:")
            for p in sorted(nieuw):
                print(f"    {p}")
        if gewijzigd:
            print(f"\n■ GEWIJZIGD ({len(gewijzigd)}) — opnieuw lezen:")
            for p, (oud, nieuw_h) in sorted(gewijzigd.items()):
                print(f"    {p}\n      {oud} → {nieuw_h}")
        if verdwenen:
            print(f"\n■ VERDWENEN ({len(verdwenen)}) — verplaatst of verwijderd:")
            for p in sorted(verdwenen):
                print(f"    {p}")
        if duplicaten:
            print(f"\n■ DUPLICATEN ({len(duplicaten)}) — zelfde inhoud, meerdere paden:")
            for h, ps in sorted(duplicaten.items()):
                print(f"    {h}:")
                for p in sorted(ps):
                    print(f"      {p}")
        if ongeregistreerd:
            print(f"\n■ NIET IN BRONREGISTER ({len(ongeregistreerd)}):")
            for p in sorted(ongeregistreerd):
                print(f"    {p}")
        if not (nieuw or gewijzigd or verdwenen or ongeregistreerd):
            print("\n✓ Geen verschillen met de vastgelegde staat.")

    if a.update_state:
        STATE.parent.mkdir(parents=True, exist_ok=True)
        STATE.write_text(json.dumps({
            "bijgewerkt": date.today().isoformat(),
            "nas_pad": str(NAS),
            "documenten": nu,
        }, indent=2, ensure_ascii=False) + "\n")
        print(f"\nStaat vastgelegd in {STATE.relative_to(STATE.parent.parent.parent)} "
              f"({len(nu)} documenten).")


if __name__ == "__main__":
    main()
