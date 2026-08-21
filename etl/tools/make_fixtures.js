// Generates Ifta-shaped fixtures so the whole pipeline can be exercised without
// the real Kaggle dump. Deliberately awkward: unusual field names to prove the
// shape adapter works, bare باب chapters, front matter, "N - " prefixes,
// multi-sanad chains, placeholder narrators, orphan mentions, colliding
// normalised names, vocalised transmission words.
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || './data/ifta';
fs.mkdirSync(path.join(OUT, 'books'), { recursive: true });

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];

const FIRST = ['محمد', 'أحمد', 'عبد الله', 'إبراهيم', 'يحيى', 'سفيان', 'مالك', 'حماد'];
const NISBA = ['البخاري', 'الزهري', 'الثوري', 'الأنصاري', 'النخعي', 'الكوفي', 'المدني'];
const GRADES = ['ثقة', 'ثقة ثبت', 'صدوق', 'صدوق يهم', 'مقبول', 'لين الحديث',
                'ضعيف', 'ضعيف جدا', 'متروك الحديث', 'ثقة حافظ'];
const WORDS = ['حَدَّثَنَا', 'أَخْبَرَنَا', 'عَنْ', 'عَنْ', 'عَنْ', 'سَمِعْتُ', 'قَالَ'];
const DIAC = ['\u064E', '\u064F', '\u0650', '\u0652', '\u0651'];

const vocalise = (s) =>
  [...s].map((c) => (/[\u0621-\u064A]/.test(c) && Math.random() < 0.5 ? c + pick(DIAC) : c)).join('');

// --- narrators ---------------------------------------------------------------
const N_NARRATORS = 900;
const narrators = [];
for (let i = 1; i <= N_NARRATORS; i++) {
  // ~4% placeholders, and deliberate name collisions so the ambiguity path is
  // actually exercised rather than merely present.
  const placeholder = i % 25 === 0;
  const base = placeholder
    ? '[راو موضع إبهام]'
    : `${pick(FIRST)} بن ${pick(FIRST)} ${pick(NISBA)}`;
  narrators.push({
    rawi_id: i,
    full_name: vocalise(base),
    narrator_name: base,
    kunyah: Math.random() < 0.4 ? `أبو ${pick(FIRST)}` : '',
    laqab: '',
    nasab: Math.random() < 0.3 ? [pick(NISBA), pick(NISBA)] : null,
    relations: '',
    classOfNarrators: `الطبقة ${1 + rnd(12)}`,
    madhhab: Math.random() < 0.5 ? pick(['حنفي', 'مالكي', 'شافعي', 'حنبلي']) : '',
    grade_ibn_hajar: placeholder ? '' : (Math.random() < 0.75 ? pick(GRADES) : ''),
    grade_dhahabi:   placeholder ? '' : (Math.random() < 0.55 ? pick(GRADES) : ''),
    death: Math.random() < 0.7 ? `${100 + rnd(200)} هـ` : '',
  });
}
fs.writeFileSync(path.join(OUT, 'ifta_narrators.json'), JSON.stringify(narrators));

// --- books -------------------------------------------------------------------
const BOOKS = [
  { slug: 'bukhari',  title_ar: 'صحيح البخاري',  title_en: 'Sahih al-Bukhari', n: 700 },
  { slug: 'muslim',   title_ar: 'صحيح مسلم',     title_en: 'Sahih Muslim',     n: 500 },
  { slug: 'abudawud', title_ar: 'سنن أبي داود',  title_en: 'Sunan Abi Dawud',  n: 300 },
  { slug: 'tirmidhi', title_ar: 'جامع الترمذي',  title_en: null,               n: 250 },
];
fs.writeFileSync(path.join(OUT, 'book_manifest.json'),
  JSON.stringify(BOOKS.map(({ slug, title_ar, title_en }) => ({ slug, title_ar, title_en }))));

let hid = 1000;
for (const b of BOOKS) {
  const recs = [];
  // Front matter: no hadith number. Must be filtered by the extractor.
  recs.push({ mainId: hid++, chapterTitle: 'المقدمة', hadithNo: '',
              hadith_tashkeel: 'مقدمة الكتاب', hadith_no_diac: 'مقدمة الكتاب',
              chainOfNarrators: [], rawis: [] });

  let chapter = 'كتاب بدء الوحي';
  for (let i = 1; i <= b.n; i++) {
    // Chapter titles rotate, and bare باب recurs constantly — the case that
    // breaks title-keyed chapter identity.
    if (i % 12 === 1) chapter = Math.random() < 0.55 ? 'باب' : `باب ${pick(['الإيمان','الصلاة','الزكاة','الصوم','العلم'])}`;

    const nSanad = Math.random() < 0.78 ? 1 : (Math.random() < 0.8 ? 2 : 3);
    const chains = [];
    const mentions = [];

    for (let s = 0; s < nSanad; s++) {
      const len = 3 + rnd(4);
      const nodes = [];
      const ids = [];
      for (let k = 0; k < len; k++) {
        const nid = 1 + rnd(N_NARRATORS);
        ids.push(nid);
        nodes.push({
          narrator: narrators[nid - 1].narrator_name,
          rawi_id: nid,
          seegha: pick(WORDS),
        });
      }
      // Compiler as the final position, named for the book, with no id.
      nodes.push({ narrator: b.title_ar.split(' ').pop(), rawi_id: null, seegha: null });
      chains.push(nodes);

      // Mentions only for single-sanad hadiths, in text order = chain reversed
      // minus compiler. ~8% get a deliberately wrong length so the guard in
      // stage 12 has something to reject.
      if (nSanad === 1) {
        const rev = [...ids].reverse();
        const emit = Math.random() < 0.08 ? rev.slice(0, -1) : rev;
        emit.forEach((nid, idx) => {
          mentions.push({
            id: nid,
            name: narrators[nid - 1].narrator_name,
            tashkeel: narrators[nid - 1].full_name,
          });
        });
        // ~2% orphan mention: an id with no profile. Must not abort the load.
        if (Math.random() < 0.02) mentions.push({ id: 99999, name: 'مجهول', tashkeel: 'مَجْهُول' });
      }
    }

    const body = `عن ${pick(FIRST)} قال قال رسول الله صلى الله عليه وسلم ${pick(['إنما الأعمال بالنيات','الدين النصيحة','من حسن إسلام المرء تركه ما لا يعنيه'])}`;
    const prefixed = Math.random() < 0.6;   // "N - " prefix, must be stripped
    recs.push({
      mainId: hid++,
      chapterTitle: chapter,
      hadithNo: String(i),
      hadith_tashkeel: (prefixed ? `${i} - ` : '') + vocalise(body),
      hadith_no_diac:  (prefixed ? `${i} - ` : '') + body,
      matnText: Math.random() < 0.85 ? body.split('قال').pop().trim() : undefined,
      matn_tashkeel: Math.random() < 0.85 ? vocalise(body.split('قال').pop().trim()) : undefined,
      chainOfNarrators: chains,
      rawis: mentions,
    });
  }
  fs.writeFileSync(path.join(OUT, 'books', `${b.slug}.json`), JSON.stringify(recs));
  console.log(`${b.slug}: ${recs.length} records`);
}
console.log(`narrators: ${narrators.length}`);
console.log(`fixtures written to ${OUT}`);
