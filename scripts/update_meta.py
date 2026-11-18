"""Refresh data/meta.json, data/tourneys.json and data/coaches.json from limitlesstcg.com,
and set metaDate in data/snap.json.   usage: update_meta.py <data dir>"""
import re, json, html, sys, os, time, datetime, urllib.request
DATA = sys.argv[1]
BASE = "https://limitlesstcg.com"
def get(path):
    for attempt in range(4):
        try:
            req = urllib.request.Request(BASE + path, headers={"User-Agent": "Mozilla/5.0 (poke-report stats)"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode("utf-8")
        except Exception:
            if attempt == 3: raise
            time.sleep(3 * (attempt + 1))

def decks(page):
    return re.findall(r'<td>(\d+)</td>\s*<td>(.*?)</td>\s*<td><a href="(/decks/\d+)">(.*?)<span class="annotation">(.*?)</span></a></td>\s*<td>(\d+)</td>\s*<td>([\d.]+)%</td>', page, flags=re.S)
meta = []
for p in ("/decks", "/decks?page=2"):
    for rank, imgs, href, nm, ann, pts, share in decks(get(p)):
        meta.append({"rank": int(rank), "name": html.unescape((nm.strip() + " " + ann.strip()).strip()), "icons": re.findall(r'alt="([^"]+)"', imgs),
                     "url": BASE + href, "points": int(pts), "share": float(share)})
    time.sleep(1)
if len(meta) < 10:
    sys.exit("meta page format changed: refusing to overwrite data")

rows = re.findall(r'<tr data-date="([^"]+)" data-country="([^"]*)"\s+data-name="([^"]+)" data-format="([^"]+)"\s+data-players="([^"]*)" data-winner="([^"]*)">.*?href="(/tournaments/\d+)"', get("/tournaments"), flags=re.S)
tours, coaches = [], {}
for d, c, name, f, players, winner, href in [r for r in rows if r[3] == "standard"][:8]:
    page = get(href); time.sleep(1)
    top = []
    for m in re.finditer(r'<tr data-rank="(\d+)" data-name="([^"]*)" data-country="([^"]*)" data-deck="([^"]*)".*?</tr>', page, flags=re.S):
        rank, pl, cc, dk = m.groups()
        if int(rank) > 8: break
        top.append({"rank": int(rank), "player": html.unescape(pl), "country": cc, "deck": html.unescape(dk),
                    "icons": re.findall(r'class="pokemon"[^>]*alt="([^"]+)"', m.group(0))})
        mf = re.search(r'href="(https://metafy\.gg/@[^"?]+)', m.group(0))
        if mf:
            k = mf.group(1)
            co = coaches.setdefault(k, {"name": html.unescape(pl), "country": cc, "url": k, "results": []})
            co["results"].append({"rank": int(rank), "event": html.unescape(name), "deck": html.unescape(dk)})
    tours.append({"date": d, "country": c, "name": html.unescape(name), "players": int(players or 0), "url": BASE + href, "top": top})
if not tours:
    sys.exit("tournament page format changed: refusing to overwrite data")
coach_list = sorted(coaches.values(), key=lambda c: (-len(c["results"]), min(r["rank"] for r in c["results"])))

def dump(name, obj):
    json.dump(obj, open(os.path.join(DATA, name), "w"), ensure_ascii=False, separators=(",", ":"))
dump("meta.json", meta); dump("tourneys.json", tours); dump("coaches.json", coach_list)
snap_path = os.path.join(DATA, "snap.json")
snap = json.load(open(snap_path)) if os.path.exists(snap_path) else {}
snap["metaDate"] = snap["date"] = datetime.date.today().isoformat()
dump("snap.json", snap)
print(len(meta), "archetypes,", len(tours), "tournaments,", len(coach_list), "coaches")
