import { pool } from '../../db/pool.js';
import type {
  ChainGroup,
  HadithDetail,
  HadithListParams,
  HadithRow,
  IsnadLinkRow,
} from './hadiths.interface.js';

interface HadithListRow {
  hadith_id: number;
  collection_id: number;
  chapter_id: number | null;
  hadith_num: string;
  text_plain: string;
  sanad_count: number;
}

export async function listHadiths(params: HadithListParams): Promise<HadithListRow[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (params.collectionId !== undefined) {
    values.push(params.collectionId);
    conditions.push(`collection_id = $${values.length}`);
  }
  if (params.chapterId !== undefined) {
    values.push(params.chapterId);
    conditions.push(`chapter_id = $${values.length}`);
  }
  if (params.q) {
    values.push(params.q);
    conditions.push(
      `corpus.normalize_arabic(text_plain) LIKE '%' || corpus.normalize_arabic($${values.length}) || '%'`,
    );
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  values.push(params.limit);
  const limitPh = `$${values.length}`;
  values.push(params.offset);
  const offsetPh = `$${values.length}`;

  const { rows } = await pool.query<HadithListRow>(
    `SELECT hadith_id, collection_id, chapter_id, hadith_num, text_plain, sanad_count
       FROM corpus.hadiths
       ${where}
      ORDER BY hadith_id
      LIMIT ${limitPh} OFFSET ${offsetPh}`,
    values,
  );
  return rows;
}

export async function countHadiths(params: Omit<HadithListParams, 'limit' | 'offset'>): Promise<number> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  if (params.collectionId !== undefined) {
    values.push(params.collectionId);
    conditions.push(`collection_id = $${values.length}`);
  }
  if (params.chapterId !== undefined) {
    values.push(params.chapterId);
    conditions.push(`chapter_id = $${values.length}`);
  }
  if (params.q) {
    values.push(params.q);
    conditions.push(
      `corpus.normalize_arabic(text_plain) LIKE '%' || corpus.normalize_arabic($${values.length}) || '%'`,
    );
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query<{ count: string }>(
    `SELECT count(*) FROM corpus.hadiths ${where}`,
    values,
  );
  return Number(rows[0].count);
}

export async function getHadithDetail(hadithId: number, lang = 'en'): Promise<HadithDetail | null> {
  const { rows: headRows } = await pool.query<{
    hadith_id: number;
    collection_id: number;
    chapter_id: number | null;
    hadith_num: string;
    text_plain: string;
    text_diac: string;
    matn_plain: string | null;
    sanad_count: number;
    col_slug: string | null;
    col_title_ar: string | null;
    col_title_en: string | null;
    chap_id: number | null;
    chap_seq: number | null;
    chap_title_ar: string | null;
    tr_lang: string | null;
    tr_text_full: string | null;
    tr_source: string | null;
    tr_match_via: string | null;
    chain_strength: string | null;
  }>(
    `SELECT h.hadith_id, h.collection_id, h.chapter_id, h.hadith_num, h.text_plain,
            h.text_diac, h.matn_plain, h.sanad_count,
            col.slug AS col_slug, col.title_ar AS col_title_ar, col.title_en AS col_title_en,
            chap.chapter_id AS chap_id, chap.seq AS chap_seq, chap.title_ar AS chap_title_ar,
            t.lang AS tr_lang, t.text_full AS tr_text_full, t.source AS tr_source,
            t.match_via AS tr_match_via,
            corpus.chain_strength(h.hadith_id) AS chain_strength
       FROM corpus.hadiths h
       LEFT JOIN corpus.collections col ON col.collection_id = h.collection_id
       LEFT JOIN corpus.chapters chap ON chap.chapter_id = h.chapter_id
       LEFT JOIN corpus.hadith_translations t ON t.hadith_id = h.hadith_id AND t.lang = $2
      WHERE h.hadith_id = $1`,
    [hadithId, lang],
  );
  const head = headRows[0];
  if (!head) return null;

  const { rows: linkRows } = await pool.query<IsnadLinkRow>(
    `SELECT l.sanad_no, l.position, l.narrator_id, n.display_name, n.name_en,
            l.raw_name, l.transmission_word, l.is_compiler, l.resolution,
            n.rank_ibn_hajar_raw, n.rank_ibn_hajar
       FROM corpus.isnad_links l
       LEFT JOIN corpus.narrators n ON n.narrator_id = l.narrator_id
      WHERE l.hadith_id = $1
      ORDER BY l.sanad_no, l.position`,
    [hadithId],
  );

  const bySanad = new Map<number, IsnadLinkRow[]>();
  for (const link of linkRows) {
    const group = bySanad.get(link.sanad_no);
    if (group) group.push(link);
    else bySanad.set(link.sanad_no, [link]);
  }
  const chains: ChainGroup[] = [...bySanad.entries()]
    .sort(([a], [b]) => a - b)
    .map(([sanad_no, links]) => ({ sanad_no, strength: null, links }));

  const hadith: HadithRow = {
    hadith_id: head.hadith_id,
    collection_id: head.collection_id,
    chapter_id: head.chapter_id,
    hadith_num: head.hadith_num,
    text_plain: head.text_plain,
    text_diac: head.text_diac,
    matn_plain: head.matn_plain,
    sanad_count: head.sanad_count,
  };

  return {
    hadith,
    collection: head.col_slug
      ? { slug: head.col_slug, title_ar: head.col_title_ar!, title_en: head.col_title_en }
      : null,
    chapter: head.chap_id
      ? { chapter_id: head.chap_id, seq: head.chap_seq!, title_ar: head.chap_title_ar! }
      : null,
    translation: head.tr_lang
      ? {
          lang: head.tr_lang,
          text_full: head.tr_text_full!,
          source: head.tr_source!,
          match_via: head.tr_match_via,
        }
      : null,
    chains,
    chain_strength: head.chain_strength != null ? Number(head.chain_strength) : null,
    chain_strength_basis: {
      words_aligned: head.sanad_count === 1,
      sanad_count: head.sanad_count,
    },
  };
}
