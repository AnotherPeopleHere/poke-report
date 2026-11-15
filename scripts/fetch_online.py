"""Fetch recent online Standard tournaments from the Limitless play API (public).

Writes cache/<id>.json with {meta, standings, pairings} for each tournament with
at least MIN_PLAYERS players in the last DAYS days. Already cached tournaments
are not downloaded again.
"""
import json, os, sys, time, urllib.request, datetime

API = "https://play.limitlesstcg.com/api"
DAYS = int(os.environ.get("DAYS", "21"))
MIN_PLAYERS = int(os.environ.get("MIN_PLAYERS", "16"))
OUT = sys.argv[1] if len(sys.argv) > 1 else "cache"
os.makedirs(OUT, exist_ok=True)

def get(path):
    for attempt in range(4):
        try:
            req = urllib.request.Request(API + path, headers={"User-Agent": "standard-hub-stats/1.0"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            if attempt == 3:
                raise
            time.sleep(2 * (attempt + 1))

cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=DAYS)
tours, page = [], 1
while True:
    batch = get(f"/tournaments?game=PTCG&format=STANDARD&limit=100&page={page}")
    if not batch:
        break
    stop = False
    for t in batch:
        d = datetime.datetime.fromisoformat(t["date"].replace("Z", "+00:00"))
        if d < cutoff:
            stop = True
            continue
        if (t.get("players") or 0) >= MIN_PLAYERS:
            tours.append(t)
    if stop:
        break
    page += 1
    time.sleep(0.3)

new = 0
for t in tours:
    fn = os.path.join(OUT, t["id"] + ".json")
    if os.path.exists(fn):
        continue
    try:
        st = get(f"/tournaments/{t['id']}/standings")
        time.sleep(0.25)
        pa = get(f"/tournaments/{t['id']}/pairings")
        time.sleep(0.25)
    except Exception as e:
        print("skip", t["id"], e, file=sys.stderr)
        continue
    json.dump({"meta": t, "standings": st, "pairings": pa}, open(fn, "w"))
    new += 1

print(f"{len(tours)} tournaments in window, {new} newly downloaded")
