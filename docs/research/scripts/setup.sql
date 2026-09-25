DROP SCHEMA IF EXISTS research CASCADE; CREATE SCHEMA research;
CREATE FUNCTION research.mk(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(corpus.normalize_arabic(coalesce(t,'')),'[^ء-ي]','','g') $$;
CREATE FUNCTION research.anchor(p_text text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE WHEN p IS NULL OR p = 0 THEN p_text ELSE substr(p_text, p) END
    FROM (SELECT min(x) FILTER (WHERE x > 0) FROM unnest(ARRAY[
              position('حدثنا'  in p_text), position('حدثني'  in p_text),
              position('اخبرنا' in p_text), position('اخبرني' in p_text),
              position('انبانا' in p_text), position('سمعت'   in p_text)]) x) s(p) $$;
CREATE FUNCTION research.bk2(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
 SELECT replace(replace(regexp_replace(research.mk(regexp_replace(t,'<[^>]*>','','g')),'^باب',''),'صلىاللهعليهوسلم',''),'صلىاللهتعالىعليهوسلم','') $$;
CREATE TABLE research.sn (collection text, book_number text, bab_id numeric, en_bab_num text, ar_bab_num text,
  hadith_number text, our_hadith_number int, arabic_urn int, ar_bab_name text, ar_text text, ar_grade text,
  en_urn int, en_bab_name text, en_text text, en_grade text, last_updated text, xrefs text);
\copy research.sn FROM '/tmp/sn.csv' CSV NULL '\N'
DELETE FROM research.sn WHERE collection NOT IN ('bukhari','muslim');
ALTER TABLE research.sn ADD k int; UPDATE research.sn SET k=CASE WHEN book_number='introduction' THEN 0 ELSE book_number::int END;
CREATE TABLE research.lk (book text, file text, rn int, ch_num text, ch_en text, ch_ar text, sec_num text, sec_en text, sec_ar text,
  hnum text, en_text text, ar_text text, ar_matn text, en_grade text);
\copy research.lk FROM '/tmp/lk.csv' CSV
ALTER TABLE research.lk ADD lk_id serial PRIMARY KEY, ADD k int, ADD s numeric;
UPDATE research.lk SET k=ch_num::numeric::int, s=nullif(sec_num,'nan')::numeric;
CREATE TABLE research.fm (book text, id int, prev text, chapter text, text text);
\copy research.fm FROM '/tmp/fm.csv' CSV
CREATE TABLE research.snbab AS SELECT collection, k, bab_id, min(ar_bab_name) ar, min(en_bab_name) en, count(*) n FROM research.sn GROUP BY 1,2,3;
CREATE TABLE research.lksec AS SELECT book, k, s, min(sec_ar) ar, min(sec_en) en, count(*) n FROM research.lk WHERE s IS NOT NULL GROUP BY 1,2,3;
