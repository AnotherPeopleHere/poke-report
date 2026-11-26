"""Pokémon sprites for the site, all in one style: assets/spr/<dex>.png and assets/spr/mega-<name>.png.

Every sprite comes from PokeAPI (the same pixel-art set for all Pokémon, Megas included). Each one is trimmed to the
Pokémon itself (the originals have very different empty margins, so small Pokémon looked tiny) and fitted in the
middle of a 64x64 square, so every sprite on the site has the same visual size. Upscaling is done in whole steps
first (pixels stay sharp), the final resize is smooth (no jagged edges when the browser shrinks them).
Only missing files are downloaded: run it again after new cards are added (the daily workflow does).
"""
import csv, io, json, os, re, sys, time, urllib.request
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'spr')
SIZE, PAD = 64, 2
RAW = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{}.png'
CSV = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon.csv'

def get(url, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'poke-report-sprites'}), timeout=30) as r:
                return r.read()
        except Exception as e:
            if i == tries - 1: raise
            time.sleep(2 * (i + 1))

def words(name):
    return re.sub(r"[^a-z0-9 ]", ' ', name.lower().replace('é', 'e')).split()

def mega_slug(name):
    """'Mega Charizard X ex' -> 'charizard-mega-x' (PokeAPI) and 'mega-charizard-x' (file name)."""
    w = [x for x in words(name) if x not in ('mega', 'ex')]
    xy = w.pop() if w and w[-1] in ('x', 'y') else ''
    base = w[-1] if w else ''
    return f"{base}-mega{'-' + xy if xy else ''}", f"mega-{base}{'-' + xy if xy else ''}"

def make(png):
    im = Image.open(io.BytesIO(png)).convert('RGBA')
    box = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
    if not box: return None
    im = im.crop(box)
    w, h = im.size; room = SIZE - 2 * PAD
    k = max(1, int(room // max(w, h)) + (1 if room / max(w, h) > int(room // max(w, h)) else 0))
    if k > 1: im = im.resize((w * k, h * k), Image.NEAREST)          # whole-step upscale: sharp pixels
    w, h = im.size; s = room / max(w, h)
    im = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    out = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    out.alpha_composite(im, ((SIZE - im.width) // 2, (SIZE - im.height) // 2))
    return out

def main():
    os.makedirs(OUT, exist_ok=True)
    cards = json.load(open(os.path.join(ROOT, 'data', 'cards.json'), encoding='utf-8'))
    mons = [c for c in cards if c.get('s') == 'P']
    jobs = {str(c['dex']): str(c['dex']) for c in mons if c.get('dex')}       # file name -> PokeAPI id
    forms = {row['identifier']: row['id'] for row in csv.DictReader(io.StringIO(get(CSV).decode('utf-8')))}
    for c in mons:
        if 'mega' in words(c['n']):
            api, file = mega_slug(c['n'])
            if api in forms: jobs[file] = forms[api]
            else: print('no Mega sprite for', c['n'], api)
    done = miss = 0
    for file, pid in sorted(jobs.items()):
        path = os.path.join(OUT, file + '.png')
        if os.path.exists(path): continue
        try:
            img = make(get(RAW.format(pid)))
        except Exception as e:
            print('skip', file, e); miss += 1; continue
        if img is None: print('empty', file); miss += 1; continue
        # 128 colours with transparency: a third of the size, no visible difference at this size
        img.quantize(colors=128, method=Image.Quantize.FASTOCTREE).save(path, optimize=True); done += 1
    print(f'{done} new sprites, {miss} missing, {len(jobs)} in all')

if __name__ == '__main__':
    sys.exit(main())
