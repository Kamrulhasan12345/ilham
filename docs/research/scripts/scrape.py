import urllib.request, time, json, sys, re
from bs4 import BeautifulSoup
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'
books = [('bukhari', str(i)) for i in range(1, 98)] + [('muslim', 'introduction')] + [('muslim', str(i)) for i in range(1, 57)]
rows = []
for col, b in books:
    html = urllib.request.urlopen(urllib.request.Request(f'https://sunnah.com/{col}/{b}', headers={'User-Agent': UA}), timeout=60).read()
    d = BeautifulSoup(html, 'lxml'); allh = d.select_one('.AllHadith')
    t = lambda e, s: (e.select_one(s).get_text(' ', strip=True) if e.select_one(s) else None)
    rows.append({'col': col, 'b': b, 'kind': 'book', 'en': t(d, '.book_page_english_name'), 'ar': t(d, '.book_page_arabic_name')})
    surah = bab = None; pos = 0
    for e in allh.find_all(recursive=False):
        cls = ' '.join(e.get('class') or [])
        if 'surah' in cls:
            surah = e.get_text(' ', strip=True)
        elif 'chapter' in cls:
            bab = t(e, '.echapno')
            rows.append({'col': col, 'b': b, 'kind': 'bab', 'surah': surah, 'pos': pos, 'n': bab, 'en': t(e, '.englishchapter'), 'ar': t(e, '.arabicchapter')}); pos += 1
        elif 'echapintro' in cls:
            rows.append({'col': col, 'b': b, 'kind': 'intro', 'surah': surah, 'pos': pos, 'n': bab, 'text': e.get_text(' ', strip=True)}); pos += 1
        elif 'actualHadithContainer' in cls:
            ref = e.select_one('.hadith_reference'); m = re.search(r'Reference\s*:\s*([^\n]+)', ref.get_text('\n') if ref else '')
            rows.append({'col': col, 'b': b, 'kind': 'hadith', 'surah': surah, 'pos': pos, 'n': bab, 'id': e.get('id'), 'ref': m and m.group(1).strip()}); pos += 1
    print(col, b, len(rows), flush=True)
    time.sleep(1)
json.dump(rows, open(sys.argv[1], 'w'), ensure_ascii=False)
print('DONE', flush=True)
