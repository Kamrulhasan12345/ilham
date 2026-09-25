import { streamArray } from '/home/raidingshaman/Projects/web/ilham/etl/src/json-stream.js';
import fs from 'node:fs';
const out = fs.createWriteStream(process.argv[2]);
for (const [slug, f] of [['sahih-al-bukhari','raw/sahih-al-bukhari.json'],['sahih-muslim','raw/sahih-muslim.json']]) {
  let prevNum = null;
  for (const r of streamArray(f)) {
    const num = String(r.hadith_num ?? '').trim();
    if (num === '') out.write(JSON.stringify({slug, id: r.mainId, chapter: r.chapter, prev: prevNum, text: r.hadith_text})+'\n');
    else prevNum = num;
  }
}
out.end();
