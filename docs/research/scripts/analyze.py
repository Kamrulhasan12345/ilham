# Calibrate each metric on hadiths whose witness row is known (stage-14 tiers),
# then count what each metric would place among the unmatched hadiths.
import csv, sys, pickle, numpy as np, collections, json
csv.field_size_limit(10**9)
S = sys.argv[1]
F = pickle.load(open(f'{S}/fuzzy.pkl', 'rb'))
side = {(r['src'], r['rid']): (r['k'], r['b']) for r in csv.DictReader(open(f'{S}/x_side.csv'))}
known = {(r['src'], r['hadith_id']): r['rid'] for r in csv.DictReader(open(f'{S}/x_hmatch.csv'))}
METRICS = ['tfidf', 'lev', 'levd', 'part', 'tset', 'tsort', 'jw']
BINS = (98, 95, 90, 85, 80, 75, 70, 60, 0)
cut = lambda v: next(t for t in BINS if v >= t)
picks = {}   # (src, hadith_id) -> {metric: (bab, score, margin)}
for (src, book), R in F.items():
    ids, rows, cand = R['ifta'], R['rows'], R['cand']
    print(f'\n## {src} {book}: known {sum((src,h) in known for h in ids)}, unmatched {sum((src,h) not in known for h in ids)}')
    print('metric | known: score bin -> n / bab accuracy %            || unmatched: bin -> n')
    for m in METRICS:
        sc = R['sc'][m]; o = np.argsort(-sc, 1)
        acc = collections.defaultdict(lambda: [0, 0]); un = collections.Counter()
        for i, h in enumerate(ids):
            j1, j2 = o[i, 0], o[i, 1]; s1 = float(sc[i, j1]); mg = s1 - float(sc[i, j2])
            bab = side[(src, rows[cand[i, j1]])]
            picks.setdefault((src, h), {})[m] = (bab, s1, mg)
            if (src, h) in known:
                acc[cut(s1)][0] += 1; acc[cut(s1)][1] += bab == side[(src, known[(src, h)])]
            else: un[cut(s1)] += 1
        s = ' '.join(f'{b}:{n}/{100*c/n:.1f}' for b, (n, c) in sorted(acc.items(), reverse=True))
        u = ' '.join(f'{b}:{un[b]}' for b in sorted(un, reverse=True))
        print(f'{m:6} | {s} || {u}')
pickle.dump(picks, open(f'{S}/picks.pkl', 'wb'))
