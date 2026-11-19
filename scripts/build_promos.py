"""Add Black Star promo prints that PokemonTCG/pokemon-tcg-data does not have yet (it lags behind on promos),
taking them from tcgdex/cards-database. Only prints of cards already in the pool are added (same name and
same attacks/abilities), appended after the existing prints so card keys do not change.

usage: build_promos.py <tcgdex cards-database/data dir> <cards.json>
Images: assets.tcgdex.net, referenced as "td:<serie>/<set>/<number>" (expanded in assets/deck.js).
"""
import os, re, json, sys, urllib.request, concurrent.futures
DATA, CARDS = sys.argv[1], sys.argv[2]
# tcgdex folder, tcgdex serie id, code used on the site (as Pokémon TCG Live writes it), set name
PROMOS = [("Scarlet & Violet/SVP Black Star Promos", "sv", "PR-SV", "Scarlet & Violet Black Star Promos"),
          ("Mega Evolution/MEP Black Star Promos", "me", "MEP", "Mega Evolution Black Star Promos")]
cards = json.load(open(CARDS))
by_name = {}
for c in cards:
    by_name.setdefault(c["n"].lower(), []).append(c)
en_name = re.compile(r'name:\s*\{[^}]*?\ben:\s*"((?:[^"\\]|\\.)*)"', re.S)
added = 0
for folder, serie, code, set_name in PROMOS:
    base = os.path.join(DATA, folder)
    if not os.path.isdir(base):
        print("missing", folder); continue
    meta = open(base + ".ts", encoding="utf-8").read()
    set_id = re.search(r'id:\s*"([^"]+)"', meta).group(1)
    date = re.search(r'releaseDate:\s*"([^"]+)"', meta).group(1).replace("-", "/")
    for fn in os.listdir(base):
        if not fn.endswith(".ts"): continue
        num = fn[:-3]
        txt = open(os.path.join(base, fn), encoding="utf-8").read()
        names = [n.replace('\\"', '"') for n in en_name.findall(txt)]
        if not names: continue
        cands = by_name.get(names[0].lower(), [])
        moves = set(names[1:])
        def own(c): return {a[0] for a in c["at"]} | {a[0] for a in c["ab"]}
        match = [c for c in cands if c["s"] != "P" or own(c) == moves] or ([cands[0]] if len(cands) == 1 and cands[0]["s"] != "P" else [])
        if len(match) != 1: continue
        c = match[0]
        short = num.lstrip("0") or "0"                       # "092" -> "92", as decklists write it
        if any(p[0] == code and str(p[1]).lstrip("0") == short for p in c["p"]): continue
        mark = (re.search(r'regulationMark:\s*"(\w)"', txt) or [None, ""])[1]
        c["p"].append([code, short, set_name, date, "Promo", mark, f"td:{serie}/{set_id}/{num}"])
        added += 1
# keep the image reference only where tcgdex really has the scan (recent promos often don't yet)
def has_image(path):
    try:
        req = urllib.request.Request(f"https://assets.tcgdex.net/en/{path}/low.webp", method="HEAD", headers={"User-Agent": "poke-report-data/1.0"})
        return urllib.request.urlopen(req, timeout=20).status == 200
    except Exception:
        return False
refs = sorted({p[6][3:] for c in cards for p in c["p"] if len(p) > 6 and p[6].startswith("td:")})
with concurrent.futures.ThreadPoolExecutor(8) as ex:
    ok = {r for r, good in zip(refs, ex.map(has_image, refs)) if good}
for c in cards:
    for p in c["p"]:
        if len(p) > 6 and p[6].startswith("td:") and p[6][3:] not in ok:
            p[6] = ""
json.dump(cards, open(CARDS, "w"), ensure_ascii=False, separators=(",", ":"))
print(added, "promo prints added,", len(ok), "with an image")
