# Candidate generation by char TF-IDF (top K), then every metric on the candidates.
import csv, sys, numpy as np, pickle, time
from rapidfuzz import fuzz, distance
from sklearn.feature_extraction.text import TfidfVectorizer
csv.field_size_limit(10**9)
S = sys.argv[1]; L = 400; K = 25
ifta = list(csv.DictReader(open(f'{S}/x_ifta.csv')))
side = list(csv.DictReader(open(f'{S}/x_side.csv')))
METRICS = {'lev': fuzz.ratio, 'levd': lambda a, b: 100*distance.Levenshtein.normalized_similarity(a, b),
           'part': fuzz.partial_ratio, 'tset': fuzz.token_set_ratio, 'tsort': fuzz.token_sort_ratio,
           'jw': lambda a, b: 100*distance.JaroWinkler.normalized_similarity(a, b)}
out = {}
log = open(f'{S}/fuzzy.log', 'w')
for src in ('sn', 'lk'):
  for book in ('sahih-al-bukhari', 'sahih-muslim'):
    t = time.time()
    I = [r for r in ifta if r['book'] == book]; W = [r for r in side if r['src'] == src and r['book'] == book]
    q = [r['w'][:L] for r in I]; c = [r['w'][:L] for r in W]
    vec = TfidfVectorizer(analyzer='char_wb', ngram_range=(3, 5), min_df=2, sublinear_tf=True)
    X = vec.fit_transform(c + q); C, Q = X[:len(c)], X[len(c):]
    cand = np.zeros((len(q), K), np.int32); tf = np.zeros((len(q), K), np.float32)
    for s0 in range(0, len(q), 300):
      m = (Q[s0:s0+300] @ C.T).toarray()
      idx = np.argpartition(-m, K, axis=1)[:, :K]; v = np.take_along_axis(m, idx, 1); o = np.argsort(-v, 1)
      cand[s0:s0+300] = np.take_along_axis(idx, o, 1); tf[s0:s0+300] = np.take_along_axis(v, o, 1) * 100
    sc = {'tfidf': tf}
    for name, f in METRICS.items():
      sc[name] = np.array([[f(q[i], c[j]) for j in cand[i]] for i in range(len(q))], np.float32)
      print(src, book, name, f'{time.time()-t:.0f}s', file=log, flush=True)
    out[(src, book)] = {'ifta': [r['hadith_id'] for r in I], 'rows': [r['rid'] for r in W], 'cand': cand, 'sc': sc}
pickle.dump(out, open(f'{S}/fuzzy.pkl', 'wb'))
print('DONE', file=log, flush=True)
