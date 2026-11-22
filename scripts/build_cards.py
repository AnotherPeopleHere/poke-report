"""Build data/cards.json (the Standard-legal card pool) from a checkout of PokemonTCG/pokemon-tcg-data.

usage: build_cards.py <pokemon-tcg-data dir> <out json>
Legal = regulation mark in LEGAL_MARKS, plus older prints with the same text, plus basic Energy.
Change LEGAL_MARKS at each rotation.
"""
import json, glob, collections, sys, os
D, OUT = sys.argv[1], sys.argv[2]
LEGAL_MARKS = set(os.environ.get("LEGAL_MARKS", "HIJKLMN"))
sets = {s['id']: s for s in json.load(open(os.path.join(D, 'sets/en.json')))}
allc = []
for f in glob.glob(os.path.join(D, 'cards/en/*.json')):
    sid = os.path.basename(f)[:-5]
    for c in json.load(open(f)):
        c['_set'] = sid; allc.append(c)
def sig(c):
    return json.dumps([c['name'], c.get('supertype'), [(a.get('name'), a.get('text')) for a in c.get('abilities', [])],
        [(a.get('name'), a.get('cost'), a.get('damage'), a.get('text')) for a in c.get('attacks', [])],
        c.get('rules') if c['supertype'] != 'Pokémon' else None, c.get('hp')], sort_keys=True)
is_basic_energy = lambda c: c['supertype'] == 'Energy' and 'Basic' in c.get('subtypes', [])
legal_sigs = set(sig(c) for c in allc if c.get('regulationMark') in LEGAL_MARKS)
legal_trainer_names = set(c['name'] for c in allc if c.get('regulationMark') in LEGAL_MARKS and c['supertype'] != 'Pokémon')
groups = collections.OrderedDict()
for c in allc:
    if is_basic_energy(c):
        c['name'] = c['name'].replace('Basic ', ''); k = ('BE', c['name'])
    elif c['supertype'] != 'Pokémon':
        if c['name'] not in legal_trainer_names: continue
        k = ('TN', c['name'])
    else:
        if sig(c) not in legal_sigs: continue
        k = sig(c)
    groups.setdefault(k, []).append(c)
def img(c):
    # compact image reference, expanded in assets/deck.js (imgUrl)
    u = (c.get('images') or {}).get('small', '')
    if u.startswith('https://images.pokemontcg.io/') and u.endswith('.png'): return u[29:-4]
    if u.startswith('https://images.scrydex.com/pokemon/') and u.endswith('/small'): return 'x:' + u[35:-6]
    return ''
# Stadiums printed more than once in the same set with the same rarity (the "Legendary" Stadiums of DLR: halves of one
# picture) are different artworks a player may want side by side: each of those extra prints
# becomes its own entry. Same name, so the 4-copies rule still counts them together. The first print keeps the usual key.
def split_arts(prints):
    if prints[0]['supertype'] != 'Trainer' or 'Stadium' not in prints[0].get('subtypes', []): return [prints]
    by = collections.defaultdict(list)
    for c in prints:
        if c.get('regulationMark') in LEGAL_MARKS and str(c['number']).isdigit():
            by[(c['_set'], c.get('rarity', ''))].append(c)
    extra = [c for v in by.values() if len(v) > 1 for c in v if c is not prints[0]]
    if not extra: return [prints]
    return [[c for c in prints if c not in extra]] + [[c] for c in extra]
expanded = []
for k, prints in groups.items():
    prints.sort(key=lambda c: (c.get('regulationMark') in LEGAL_MARKS, sets[c['_set']]['releaseDate']), reverse=True)
    expanded.extend(split_arts(prints))
out = []
for prints in expanded:
    c = prints[0]
    out.append({
        'n': c['name'], 's': c['supertype'][0], 'st': c.get('subtypes', []), 'hp': int(c['hp']) if str(c.get('hp', '')).isdigit() else 0,
        't': c.get('types', []), 'ef': c.get('evolvesFrom', ''),
        'ab': [[a['name'], a.get('text', ''), a.get('type', 'Ability')] for a in c.get('abilities', [])],
        'at': [[a['name'], a.get('cost', []), a.get('damage', ''), a.get('text', '')] for a in c.get('attacks', [])],
        'w': [w['type'] + ' ' + w['value'] for w in c.get('weaknesses', [])],
        'r': [w['type'] + ' ' + w['value'] for w in c.get('resistances', [])],
        'rc': c.get('convertedRetreatCost', 0), 'ru': c.get('rules', []), 'rm': c.get('regulationMark', ''),
        'dex': (c.get('nationalPokedexNumbers') or [0])[0],
        'p': [[sets[p['_set']].get('ptcgoCode') or p['_set'].upper(), p['number'], sets[p['_set']]['name'], sets[p['_set']]['releaseDate'][:10], p.get('rarity', ''), p.get('regulationMark') or '', img(p)] for p in prints]})
json.dump(out, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'cards', dict(collections.Counter(o['s'] for o in out)))
