"""Turn cached Limitless online tournaments into deck recommendations.

usage: analyze.py <cache dir> <card pool json> <out json>
"""
import json, os, sys, glob, datetime, collections, math, re

CACHE, POOL, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
EXCLUDED_WORD = "dragapult"                  # the group's "too popular" deck (all variants): hidden unless the user opts in
MIN_GAMES = 60                               # below this a win rate is too noisy to recommend
PRIOR = 30                                   # shrink win rates toward 50% by this many virtual games
now = datetime.datetime.now(datetime.timezone.utc)

pool = json.load(open(POOL))
card_by_print = {}
for c in pool:
    for p in c["p"]:
        card_by_print[(p[0].upper(), str(p[1]).upper())] = c
card_by_name = {}
for c in pool:
    card_by_name.setdefault(c["n"].lower(), c)

T = []
WINDOW_DAYS = int(os.environ.get("DAYS", "21"))
for fn in glob.glob(os.path.join(CACHE, "*.json")):
    try:
        t = json.load(open(fn))
    except Exception:
        continue
    d = datetime.datetime.fromisoformat(t["meta"]["date"].replace("Z", "+00:00"))
    if (now - d).days > WINDOW_DAYS:
        os.remove(fn)                     # outside the window: drop it from the cache too
        continue
    T.append(t)

deck_name, deck_icons = {}, {}
players_by_deck = collections.Counter()
recent_players = collections.Counter()
rec = collections.defaultdict(lambda: [0, 0, 0])            # deck -> W L T (non-mirror matches)
rec7 = collections.defaultdict(lambda: [0, 0, 0])
recOld = collections.defaultdict(lambda: [0, 0, 0])
mu = collections.defaultdict(lambda: [0, 0, 0])             # (a, b) -> W L T for a
lists = collections.defaultdict(list)
total_players = 0; total_matches = 0
dates = []

for t in T:
    meta = t["meta"]
    d = datetime.datetime.fromisoformat(meta["date"].replace("Z", "+00:00"))
    dates.append(d)
    age = (now - d).days
    pdeck = {}
    for s in t["standings"] or []:
        dk = s.get("deck") or {}
        did = dk.get("id")
        if not did or did == "other":
            continue
        pdeck[s["player"]] = did
        deck_name[did] = dk.get("name") or did
        deck_icons[did] = dk.get("icons") or []
        players_by_deck[did] += 1
        total_players += 1
        if age <= 7:
            recent_players[did] += 1
        r = s.get("record") or {}
        if s.get("decklist"):
            lists[did].append({"player": s.get("name") or s["player"], "tournament": meta["name"], "players": meta.get("players", 0),
                               "date": meta["date"][:10], "placing": s.get("placing"), "w": r.get("wins", 0), "l": r.get("losses", 0), "t": r.get("ties", 0),
                               "list": s["decklist"]})
    for m in t["pairings"] or []:
        a, b = m.get("player1"), m.get("player2")
        if not a or not b or a not in pdeck or b not in pdeck:
            continue
        da, db = pdeck[a], pdeck[b]
        w = m.get("winner")
        if w == a: ra, rb = 0, 1
        elif w == b: ra, rb = 1, 0
        elif w in (0, "0", None, "tie"): ra, rb = 2, 2
        else: continue                                   # double loss / unknown
        total_matches += 1
        mu[(da, db)][ra] += 1
        mu[(db, da)][rb] += 1
        if da == db:
            continue
        for dd, rr in ((da, ra), (db, rb)):
            rec[dd][rr] += 1
            (rec7 if age <= 7 else recOld)[dd][rr] += 1

def wr(r):
    g = sum(r); return (r[0] + 0.5 * r[2]) / g if g else None
def shrunk(r):
    g = sum(r); return (r[0] + 0.5 * r[2] + PRIOR * 0.5) / (g + PRIOR)

# ---------- playstyle from the most successful real lists ----------
SPREAD = re.compile(r"(damage counters on (each of )?your opponent's|each of your opponent's (benched )?pok[eé]mon|to 1 of your opponent's benched)", re.I)
LOCK = re.compile(r"(can't play any item|can't use abilities|prevent all (damage|effects)|can't attack|can't retreat)", re.I)
HEAL = re.compile(r"heal", re.I)
MILL = re.compile(r"discard the top .* of your opponent's deck", re.I)

def resolve(line):
    c = card_by_print.get((str(line.get("set", "")).upper(), str(line.get("number", "")).upper()))
    return c or card_by_name.get(str(line.get("name", "")).lower())

def profile(L, icons):
    pk = L.get("pokemon", []); tr = L.get("trainer", []); en = L.get("energy", [])
    n_poke = sum(x["count"] for x in pk); n_tr = sum(x["count"] for x in tr); n_en = sum(x["count"] for x in en)
    cards = [(resolve(x), x) for x in pk]
    keys = set()
    for ic in icons:
        parts = [p for p in ic.lower().split('-') if p not in ('mega', 'ex', 'alolan', 'galarian', 'hisuian', 'paldean')]
        if parts: keys.add(parts[0])
    core = {c['n'] for c, _ in cards if c and any(k in c['n'].lower().replace(' ', '').replace("'", '') for k in keys)}
    changed = True
    while changed:
        changed = False
        for c, _ in cards:
            if c and c['n'] not in core and any((cc and cc['n'] in core and cc['ef'] == c['n']) for cc, _ in cards):
                core.add(c['n']); changed = True
    core_cards = [(c, x) for c, x in cards if c and (c['n'] in core or not core)]
    stage2 = sum(x["count"] for c, x in cards if c and "Stage 2" in c["st"])
    basics = sum(x["count"] for c, x in cards if c and "Basic" in c["st"])
    exes = sum(x["count"] for c, x in cards if c and "ex" in c["st"])
    uniq_poke = len(pk)
    text = " ".join(" ".join([a[3] for a in c["at"]] + [a[1] for a in c["ab"]]) for c, _ in core_cards)
    trtext = " ".join(" ".join(c["ru"]) for c in (resolve(x) for x in tr) if c)
    styles = []
    if SPREAD.search(text): styles.append("spread")
    if LOCK.search(text) or (HEAL.search(text) and stage2 == 0): styles.append("controllo")
    if MILL.search(text): styles.append("mill")
    if stage2 >= 3 or any(x["name"] == "Rare Candy" for x in tr): styles.append("evoluzione")
    if n_poke and basics / max(1, n_poke) >= .8 and stage2 == 0: styles.append("aggro")
    singles = sum(1 for x in pk if x["count"] == 1)
    if uniq_poke >= 11 and singles >= 7: styles.append("toolbox")
    if not styles: styles.append("midrange")
    single_prize = exes == 0
    # difficulty: many distinct trainers + abilities + toolbox breadth make lines harder to pilot
    n_ab = sum(1 for c, _ in cards if c and c["ab"])
    diff_score = len(tr) * 0.6 + n_ab * 0.8 + uniq_poke * 0.4 + (2 if "controllo" in styles else 0)
    difficulty = 1 if diff_score < 13 else 2 if diff_score < 17 else 3
    return {"styles": styles, "singlePrize": single_prize, "difficulty": difficulty,
            "counts": {"pokemon": n_poke, "trainer": n_tr, "energy": n_en}}

def to_lines(L):
    out = []
    for sec in ("pokemon", "trainer", "energy"):
        for x in L.get(sec, []):
            out.append({"q": x["count"], "name": x["name"], "set": x.get("set", ""), "num": str(x.get("number", "")), "sec": sec})
    return out

deck_ids = [d for d in players_by_deck if sum(rec[d]) >= 15]
top_by_play = sorted(deck_ids, key=lambda d: -players_by_deck[d])[:8]
avg = 0.5
res = []
for d in deck_ids:
    r = rec[d]; g = sum(r)
    best = sorted(lists[d], key=lambda x: (-(x["w"] - x["l"]), -x["players"], x["placing"] or 999))[:1]
    prof = profile(best[0]["list"], deck_icons.get(d, [])) if best else {"styles": ["midrange"], "singlePrize": False, "difficulty": 2, "counts": {}}
    vs = []
    for o in top_by_play:
        if o == d: continue
        m = mu[(d, o)]
        if sum(m) >= 6:
            vs.append({"id": o, "name": deck_name[o], "games": sum(m), "wr": round(wr(m), 3)})
    w7, wo = wr(rec7[d]), wr(recOld[d])
    trend = round(w7 - wo, 3) if (w7 is not None and wo is not None and sum(rec7[d]) >= 40 and sum(recOld[d]) >= 40) else None
    share = players_by_deck[d] / total_players if total_players else 0
    share7 = recent_players[d] / max(1, sum(recent_players.values()))
    s = shrunk(r)
    trend_w = min(1, sum(rec7[d]) / 300)          # trust a trend only as far as last week's sample allows
    score = s + max(-0.05, min(0.05, trend or 0)) * 0.3 * trend_w
    res.append({
        "id": d, "name": deck_name[d], "icons": deck_icons.get(d, []),
        "players": players_by_deck[d], "share": round(share, 4), "share7": round(share7, 4),
        "W": r[0], "L": r[1], "T": r[2], "games": g, "wr": round(wr(r), 4) if g else None, "wrAdj": round(s, 4),
        "trend": trend, "score": round(score, 4), "vs": sorted(vs, key=lambda x: -x["games"]),
        "excluded": EXCLUDED_WORD in d,
        "exotic": share < 0.015 and g >= MIN_GAMES and s >= avg + 0.015,
        "recommendable": g >= MIN_GAMES,
        "style": prof,
        "list": ({"player": best[0]["player"], "tournament": best[0]["tournament"], "date": best[0]["date"],
                  "record": f'{best[0]["w"]}-{best[0]["l"]}-{best[0]["t"]}', "lines": to_lines(best[0]["list"])} if best else None),
        "url": f"https://play.limitlesstcg.com/decks/{d}?format=standard",
    })
res.sort(key=lambda x: -x["score"])
out = {
    "generated": now.strftime("%Y-%m-%d"),
    "window": {"from": min(dates).strftime("%Y-%m-%d") if dates else None, "to": max(dates).strftime("%Y-%m-%d") if dates else None,
               "tournaments": len(T), "players": total_players, "matches": total_matches},
    "top": [{"id": d, "name": deck_name[d]} for d in top_by_play],
    "archetypes": res,
}
json.dump(out, open(OUT, "w"), ensure_ascii=False)
print(json.dumps(out["window"]), len(res), "archetypes")
for x in res[:10]:
    print(f'{x["name"][:28]:28} share {x["share"]*100:5.1f}% games {x["games"]:5} wr {x["wr"]*100:5.1f} adj {x["wrAdj"]*100:5.1f} trend {x["trend"]} exotic {x["exotic"]} {x["style"]["styles"]} d{x["style"]["difficulty"]}')
