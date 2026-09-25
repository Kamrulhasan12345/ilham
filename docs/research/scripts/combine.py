# Place every Ifta hadith into a live sunnah.com (kitab, bab) and measure how the
# independent methods agree with each other.
import csv, sys, pickle, collections, itertools
csv.field_size_limit(10**9)
S = sys.argv[1]
F = pickle.load(open(f'{S}/fuzzy.pkl', 'rb'))
web = {r['urn']: (int(r['k']), r['wbab'] or None) for r in csv.DictReader(open(f'{S}/x_web.csv'))}
lksec = {r['rid']: (r['k'], r['b']) for r in csv.DictReader(open(f'{S}/x_side.csv')) if r['src'] == 'lk'}
known = {(r['src'], r['hadith_id']): r['rid'] for r in csv.DictReader(open(f'{S}/x_hmatch.csv'))}
order = list(csv.DictReader(open(f'{S}/x_order.csv')))
STRONG = {'tfidf': 95, 'lev': 98, 'levd': 95, 'part': 98, 'tset': 98, 'tsort': 95, 'jw': 95}

def fuzzy(src):
    """hadith -> row, when >= 2 strong metrics agree on one target and none disagrees."""
    res = {}
    for (s, book), R in F.items():
        if s != src: continue
        for i, h in enumerate(R['ifta']):
            votes = []
            for m, t in STRONG.items():
                sc = R['sc'][m][i]; j = int(sc.argmax())
                if sc[j] >= t: votes.append(R['rows'][R['cand'][i, j]])
            if len(votes) >= 2: res[h] = votes
    return res
snf, lkf = fuzzy('sn'), fuzzy('lk')

ev = collections.defaultdict(dict)   # hadith -> method -> target
for h in (r['hadith_id'] for r in order):
    if ('sn', h) in known: ev[h]['sn_text'] = web[known[('sn', h)]]
    if h in snf:
        t = {web[r] for r in snf[h]}
        if len(t) == 1: ev[h]['sn_fuzzy'] = t.pop()

# LK section -> live target crosswalk, learnt from hadiths that both SN-text and LK-text match.
xw = collections.defaultdict(collections.Counter)
for h, e in ev.items():
    if 'sn_text' in e and ('lk', h) in known: xw[lksec[known[('lk', h)]]][e['sn_text']] += 1
cross = {}
for sec, c in xw.items():
    t, n = c.most_common(1)[0]
    if n == sum(c.values()): cross[sec] = t                       # pure: one live bab
    elif len({k for k, _ in c}) == 1: cross[sec] = (t[0], 'KITAB')  # pure only at kitab level
for h in (r['hadith_id'] for r in order):
    if ('lk', h) in known and lksec[known[('lk', h)]] in cross: ev[h]['lk_text'] = cross[lksec[known[('lk', h)]]]
    if h in lkf:
        t = {cross.get(lksec[r]) for r in lkf[h]}
        if len(t) == 1 and None not in t: ev[h]['lk_fuzzy'] = t.pop()

def best(e):
    for m in ('sn_text', 'sn_fuzzy', 'lk_text', 'lk_fuzzy'):
        if m in e and e[m][1] != 'KITAB': return e[m]
    return None
# structural methods read the text-based placements only
base = {h: best(ev[h]) for h in ev}
by_book = collections.defaultdict(list)
for r in order: by_book[r['book']].append(r)
chap = collections.defaultdict(list)
for r in order: chap[r['chapter_id']].append(r['hadith_id'])
for book, rs in by_book.items():
    ids = [r['hadith_id'] for r in rs]
    for i, h in enumerate(ids):
        p = next((base[x] for x in reversed(ids[:i]) if base.get(x)), None)
        n = next((base[x] for x in ids[i+1:] if base.get(x)), None)
        if p and p == n: ev[h]['sandwich'] = p
for cid, hs in chap.items():
    for h in hs:
        t = {base[x] for x in hs if x != h and base.get(x)}
        if len(t) == 1: ev[h]['inherit'] = t.pop()

# pairwise agreement between methods (bab level)
M = ['sn_text', 'sn_fuzzy', 'lk_text', 'lk_fuzzy', 'sandwich', 'inherit']
print('pairwise agreement (both present: n / same %)')
for a, b in itertools.combinations(M, 2):
    both = [h for h in ev if a in ev[h] and b in ev[h] and ev[h][a][1] != 'KITAB' and ev[h][b][1] != 'KITAB']
    if both: print(f'  {a:8} x {b:8}: {len(both):5} / {100*sum(ev[h][a]==ev[h][b] for h in both)/len(both):.2f}')

# final placement
final, how = {}, collections.Counter()
for r in order:
    h, e = r['hadith_id'], ev.get(r['hadith_id'], {})
    t = best(e); m = next((m for m in ('sn_text', 'sn_fuzzy', 'lk_text', 'lk_fuzzy') if m in e and e[m] == t), None)
    if not t and 'sandwich' in e and e.get('inherit') in (None, e['sandwich']): t, m = e['sandwich'], 'sandwich'
    if not t and 'inherit' in e: t, m = e['inherit'], 'inherit'
    if not t:
        kt = next((e[x] for x in M if x in e), None)
        if kt: t, m = (kt[0], None), 'kitab_only'
    final[h] = (t, m); how[(r['book'], m)] += 1
print('\nfinal placement by method:')
for k in sorted(how, key=str): print(' ', k, how[k])
# conflicts among text methods on the final pick
conf = [h for h, (t, m) in final.items() if t and any(ev[h][x] != t and ev[h][x][1] != 'KITAB' for x in M if x in ev[h])]
print('placed hadiths with a disagreeing method:', len(conf))
pickle.dump((final, ev), open(f'{S}/final.pkl', 'wb'))
with open(f'{S}/final.csv', 'w', newline='') as f:
    w = csv.writer(f)
    for h, (t, m) in final.items():
        w.writerow([h, t[0] if t else '', (t[1] or '') if t else '', m or '', int(h in conf)])

# ---------------------------------------------------------------- weighted vote
import re
via = {('sn', r['hadith_id']): r['via'] for r in csv.DictReader(open(f'{S}/x_via.csv'))}
via.update({('lk', r['hadith_id']): r['via'] for r in csv.DictReader(open(f'{S}/x_vialk.csv'))})
inum = {r['hadith_id']: r['hadith_num'] for r in csv.DictReader(open(f'{S}/x_inum.csv'))}
book_of = {r['hadith_id']: r['book'] for r in order}
chap_of = {r['hadith_id']: r['chapter_id'] for r in order}
num_idx = collections.defaultdict(set)
for r in csv.reader(open(f'{S}/sn.csv')):
    if r[0] in ('bukhari', 'muslim'):
        for n in re.findall(r'\d+', r[5]): num_idx[(r[0], n)].add(web[r[7]])
wb_t = {r['seq']: r['t'] for r in csv.DictReader(open(f'{S}/x_wbab.csv'))}
ch_t = {r['chapter_id']: r['t'] for r in csv.DictReader(open(f'{S}/x_chap.csv'))}
W = {'sn_fuzzy': 2, 'lk_fuzzy': 1.5, 'sandwich': 1.5, 'inherit': 1, 'num': 2, 'title': 1.5}
TW = {'E': 3, 'P': 2.5, '6': 2, '4': 1, 'M': 1.5}
final2, stats = {}, collections.Counter()
for r in order:
    h = r['hadith_id']; e = ev.get(h, {}); votes = collections.Counter()
    for m, t in e.items():
        if t[1] == 'KITAB': continue
        w = TW[via[(m[:2], h)]] if m in ('sn_text', 'lk_text') else W[m]
        votes[t] += w
    col = 'bukhari' if book_of[h] == 'sahih-al-bukhari' else 'muslim'
    nt = num_idx.get((col, inum[h]), set())
    if len(nt) == 1: t = next(iter(nt)); votes[t] += W['num']; e['num'] = t
    ct = ch_t[chap_of[h]]
    for t in list(votes):
        bt = wb_t.get(t[1]) if t[1] else None
        if ct and bt and (ct == bt or ct in bt or bt in ct): votes[t] += W['title']; e['title'] = t
    if not votes: final2[h] = (None, 0, 0); stats[(book_of[h], 'none')] += 1; continue
    (t1, v1), *rest = votes.most_common(); v2 = rest[0][1] if rest else 0
    final2[h] = (t1, v1, v1 - v2)
    old = final.get(h, (None,))[0]
    stats[(book_of[h], 'same' if t1 == old else 'changed')] += 1
    if v1 - v2 < 1.5: stats[(book_of[h], 'low_margin')] += 1
print('\nweighted vote:')
for k in sorted(stats): print(' ', k, stats[k])
gold = {'142': 3, '4550': 56, '5473': 60, '11515': 97, '13435': 6, '14267': 12, '16946': 32, '17766': 36, '20189': 53}
print('gold kitab check:', {h: (final2[h][0][0] == k) for h, k in gold.items()})
pickle.dump((final2, ev), open(f'{S}/final2.pkl', 'wb'))
