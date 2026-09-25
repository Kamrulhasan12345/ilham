\timing off
DROP TABLE IF EXISTS research.ifta, research.side, research.hmatch;
CREATE TABLE research.ifta AS
SELECT h.hadith_id, c.slug book, h.hadith_num, h.chapter_id,
  research.anchor(CASE WHEN research.mk(ch.title_ar) <> '' AND research.mk(h.text_plain) LIKE research.mk(ch.title_ar)||'%'
       THEN substr(research.mk(h.text_plain), length(research.mk(ch.title_ar))+1) ELSE research.mk(h.text_plain) END) a,
  research.mk(h.matn_plain) m
FROM corpus.hadiths h JOIN corpus.collections c USING (collection_id) JOIN corpus.chapters ch ON ch.chapter_id=h.chapter_id;
-- one "side" table for both witnesses; sn text has [tags] stripped first
CREATE TABLE research.side AS
SELECT 'lk'::text src, lk_id rid, CASE book WHEN 'bukhari' THEN 'sahih-al-bukhari' ELSE 'sahih-muslim' END book,
  research.anchor(research.mk(ar_text)) a, nullif(research.mk(ar_matn),'') m, md5(en_text) he FROM research.lk
UNION ALL
SELECT 'sn', arabic_urn, CASE collection WHEN 'bukhari' THEN 'sahih-al-bukhari' ELSE 'sahih-muslim' END,
  research.anchor(research.mk(regexp_replace(ar_text,'\[[^]]*\]','','g'))),
  nullif(research.mk(substring(ar_text from '\[matn\](.*)\[/matn\]')),''), md5(arabic_urn::text) FROM research.sn;
CREATE INDEX ON research.side(src,book,md5(a)); CREATE INDEX ON research.side(src,book,left(a,100));
CREATE INDEX ON research.side(src,book,left(a,60)); CREATE INDEX ON research.side(src,book,left(a,40));
CREATE INDEX ON research.side(src,book,md5(m));
CREATE INDEX ON research.ifta(book,md5(a)); CREATE INDEX ON research.ifta(book,left(a,100));
CREATE INDEX ON research.ifta(book,left(a,60)); CREATE INDEX ON research.ifta(book,left(a,40)); CREATE INDEX ON research.ifta(book,md5(m));
ANALYZE research.ifta; ANALYZE research.side;
CREATE TABLE research.hmatch (src text, hadith_id int, rid int, via char(1), PRIMARY KEY (src,hadith_id));
DO $$ DECLARE s text; t record; BEGIN
FOREACH s IN ARRAY ARRAY['lk','sn'] LOOP
  INSERT INTO research.hmatch SELECT s, i.hadith_id, min(l.rid), 'E'
  FROM research.ifta i JOIN research.side l ON l.src=s AND l.book=i.book AND md5(l.a)=md5(i.a)
  WHERE length(i.a)>0 GROUP BY i.hadith_id HAVING count(DISTINCT l.he)=1;
  FOR t IN SELECT * FROM (VALUES (100,'P'),(60,'6'),(40,'4')) v(n,via) LOOP
    EXECUTE format($q$INSERT INTO research.hmatch
    WITH p AS (SELECT i.hadith_id, l.rid FROM research.ifta i JOIN research.side l
       ON l.src=%1$L AND l.book=i.book AND left(l.a,%2$s)=left(i.a,%2$s)
      WHERE length(i.a)>=%2$s AND length(l.a)>=%2$s
      AND NOT EXISTS (SELECT 1 FROM research.hmatch m WHERE m.src=%1$L AND m.hadith_id=i.hadith_id)
      AND NOT EXISTS (SELECT 1 FROM research.hmatch m WHERE m.src=%1$L AND m.rid=l.rid)),
    ic AS (SELECT hadith_id FROM p GROUP BY 1 HAVING count(*)=1), lc AS (SELECT rid FROM p GROUP BY 1 HAVING count(*)=1)
    SELECT %1$L, p.hadith_id, p.rid, %3$L FROM p JOIN ic USING (hadith_id) JOIN lc USING (rid)$q$, s, t.n, t.via);
  END LOOP;
  INSERT INTO research.hmatch
  WITH p AS (SELECT i.hadith_id, l.rid FROM research.ifta i JOIN research.side l
     ON l.src=s AND l.book=i.book AND md5(l.m)=md5(i.m)
    WHERE length(i.m)>=40 AND length(l.m)>=40
    AND NOT EXISTS (SELECT 1 FROM research.hmatch m WHERE m.src=s AND m.hadith_id=i.hadith_id)
    AND NOT EXISTS (SELECT 1 FROM research.hmatch m WHERE m.src=s AND m.rid=l.rid)),
  ic AS (SELECT hadith_id FROM p GROUP BY 1 HAVING count(*)=1), lc AS (SELECT rid FROM p GROUP BY 1 HAVING count(*)=1)
  SELECT s, p.hadith_id, p.rid, 'M' FROM p JOIN ic USING (hadith_id) JOIN lc USING (rid);
END LOOP; END $$;
SELECT src, i.book, via, count(*) FROM research.hmatch JOIN research.ifta i USING (hadith_id) GROUP BY ROLLUP(1,2,3) ORDER BY 1,2,3;
-- LK replica must reproduce the published translations exactly
SELECT count(*) replica, count(*) FILTER (WHERE t.hadith_id IS NOT NULL AND t.match_via=m.via) same_tier
FROM research.hmatch m LEFT JOIN corpus.hadith_translations t USING (hadith_id) WHERE m.src='lk';
SELECT count(*) published FROM corpus.hadith_translations;
