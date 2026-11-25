"""Build data/pokedex.json: every Pokémon (plus Mega and regional forms) with English and Italian names,
for the "favourite Pokémon" in the profile. Source: PokeAPI's CSV data on GitHub.
usage: build_pokedex.py <out json>
Entry: [english name, italian name, showdown sprite id, PokeAPI pokemon id (static sprite fallback)]"""
import csv, io, json, re, sys, urllib.request
BASE = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/"
get = lambda f: list(csv.DictReader(io.StringIO(urllib.request.urlopen(BASE + f, timeout=60).read().decode("utf-8"))))
names = {}
for r in get("pokemon_species_names.csv"):
    if r["local_language_id"] in ("9", "8"):
        names.setdefault(r["pokemon_species_id"], {})[r["local_language_id"]] = r["name"]
REG = {"alola": ("Alolan", "di Alola"), "galar": ("Galarian", "di Galar"), "hisui": ("Hisuian", "di Hisui"), "paldea": ("Paldean", "di Paldea")}
sd = lambda s: re.sub(r"[^a-z0-9]", "", s.lower().replace("♀", "f").replace("♂", "m"))
out = []
for r in get("pokemon.csv"):
    sid, ident = r["species_id"], r["identifier"]
    n = names.get(sid, {}); en, it = n.get("9"), n.get("8") or n.get("9")
    if not en: continue
    base = sd(en)
    if r["is_default"] == "1":
        out.append([en, it, base, int(r["id"])]); continue
    m = re.search(r"-mega(?:-([xy]))?$", ident)
    if m:
        xy = (m.group(1) or "")
        out.append([f"Mega {en}{' '+xy.upper() if xy else ''}", f"Mega {it}{' '+xy.upper() if xy else ''}", f"{base}-mega{xy}", int(r["id"])]); continue
    for k, (pe, pi) in REG.items():
        if ident.endswith("-" + k):
            out.append([f"{pe} {en}", f"{it} {pi}", f"{base}-{k}", int(r["id"])]); break
out.sort(key=lambda e: e[0])
json.dump(out, open(sys.argv[1], "w"), ensure_ascii=False, separators=(",", ":"))
print(len(out), "Pokémon")
