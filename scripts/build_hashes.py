"""Build data/hashes.json: a small "fingerprint" of every card scan, so a deck picture exported by Limitless
(a grid of official scans) can be read card by card in the browser (assets/scan.js does the same maths).

usage: build_hashes.py <cards.json> <hashes.json>
Fingerprint = two difference hashes (64 bits each) of the grey picture: the whole card, and the artwork box.
Only prints not hashed yet are downloaded, so the daily run is quick.
"""
import json, sys, io, urllib.request, concurrent.futures
from PIL import Image

CARDS, OUT = sys.argv[1], sys.argv[2]
cards = json.load(open(CARDS))
try:
    old = json.load(open(OUT))
except Exception:
    old = {}

def url(ref):
    if ref.startswith("x:"): return f"https://images.scrydex.com/pokemon/{ref[2:]}/small"
    if ref.startswith("td:"): return f"https://assets.tcgdex.net/en/{ref[3:]}/low.webp"
    return f"https://images.pokemontcg.io/{ref}.png"

def dhash(px, w, h, x0, y0, x1, y1):
    """9x8 block means of the region (fractions of the card), then one bit per left/right comparison."""
    X0, X1, Y0, Y1 = int(x0 * w), int(x1 * w), int(y0 * h), int(y1 * h)
    cells = []
    for j in range(8):
        ya, yb = Y0 + (Y1 - Y0) * j // 8, Y0 + (Y1 - Y0) * (j + 1) // 8
        row = []
        for i in range(9):
            xa, xb = X0 + (X1 - X0) * i // 9, X0 + (X1 - X0) * (i + 1) // 9
            s = n = 0
            for y in range(ya, max(yb, ya + 1)):
                for x in range(xa, max(xb, xa + 1)):
                    s += px[x, y]; n += 1
            row.append(s / n)
        cells.append(row)
    bits = 0
    for j in range(8):
        for i in range(8):
            bits = (bits << 1) | (1 if cells[j][i] > cells[j][i + 1] else 0)
    return f"{bits:016x}"

def fingerprint(img):
    g = img.convert("L").resize((120, 168), Image.BOX)
    px = g.load()
    return dhash(px, 120, 168, .04, .03, .96, .97) + dhash(px, 120, 168, .08, .11, .92, .48)

def fetch(item):
    key, ref = item
    try:
        req = urllib.request.Request(url(ref), headers={"User-Agent": "poke-report-data/1.0"})
        data = urllib.request.urlopen(req, timeout=30).read()
        return key, fingerprint(Image.open(io.BytesIO(data)))
    except Exception:
        return key, None

todo = {}
for c in cards:
    for p in c["p"]:
        ref = p[6] if len(p) > 6 else ""
        k = f"{p[0]} {p[1]}"
        if ref and k not in old and k not in todo:
            todo[k] = ref
done = 0
with concurrent.futures.ThreadPoolExecutor(16) as ex:
    for k, h in ex.map(fetch, todo.items()):
        if h: old[k] = h; done += 1
keep = {f"{p[0]} {p[1]}" for c in cards for p in c["p"]}
out = {k: v for k, v in sorted(old.items()) if k in keep}
json.dump(out, open(OUT, "w"), separators=(",", ":"))
print(f"{done} new fingerprints, {len(out)} in total")
