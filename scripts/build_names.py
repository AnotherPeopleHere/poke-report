"""Build data/names.json: card names in other languages -> English names used by the site.

usage: build_names.py <tcgdex cards-database/data dir> <cards.json> <out json>
Source: https://github.com/tcgdex/cards-database (each card file has name: {en, it, fr, ...}).
Only names of Standard-legal cards are kept, so exports from Pokémon TCG Live in Italian
(or another language) can be imported.
"""
import os, re, json, sys, collections
DATA, CARDS, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
LANGS = ("it", "fr", "es", "de", "pt")
legal = {c["n"] for c in json.load(open(CARDS))}
legal_lower = {n.lower(): n for n in legal}
block = re.compile(r'name:\s*\{(.*?)\}', re.S)
field = re.compile(r'(\w+):\s*"((?:[^"\\]|\\.)*)"')
votes = {l: collections.defaultdict(collections.Counter) for l in LANGS}
for root, _, files in os.walk(DATA):
    for fn in files:
        if not fn.endswith(".ts") or not fn[0].isdigit() and not re.match(r"^[A-Za-z]*\d", fn):
            continue
        try:
            txt = open(os.path.join(root, fn), encoding="utf-8").read()
        except Exception:
            continue
        m = block.search(txt)
        if not m:
            continue
        names = {k: v.replace('\\"', '"') for k, v in field.findall(m.group(1))}
        en = names.get("en")
        if not en:
            continue
        en = legal_lower.get(en.lower()) or legal_lower.get(en.lower().replace("basic ", ""))
        if not en:
            continue
        for l in LANGS:
            if names.get(l) and names[l].lower() != en.lower():
                votes[l][names[l].strip().lower()][en] += 1
out = {l: {k: c.most_common(1)[0][0] for k, c in sorted(v.items())} for l, v in votes.items()}
for l, m in out.items():                     # TCG Live writes "Name ex", the database "Name-ex"
    for k, v in list(m.items()):
        if "-ex" in k: m.setdefault(k.replace("-ex", " ex"), v)
json.dump(out, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
print({l: len(v) for l, v in out.items()})
