import { pool } from '../../db/pool.js';
import type {
  HadithDetail,
  HadithListParams,
  HadithRow,
  IsnadLinkRow,
  SanadChain,
  TranslationRow,
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
    conditions.push('collection_id = $' + values.length + '::integer');
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
    conditions.push('collection_id = $' + values.length + '::integer');
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
  const { rows: hadithRows } = await pool.query(
    `SELECT h.hadith_id, h.collection_id, h.chapter_id, h.hadith_num,
            h.text_plain, h.text_diac, h.matn_plain, h.sanad_count,
            c.slug AS collection_slug, c.title_ar AS collection_title_ar,
            c.title_en AS collection_title_en,
            ch.chapter_id AS chapter_chapter_id, ch.seq AS chapter_seq,
            ch.title_ar AS chapter_title_ar
       FROM corpus.hadiths h
       JOIN corpus.collections c ON c.collection_id = h.collection_id
       LEFT JOIN corpus.chapters ch ON ch.chapter_id = h.chapter_id
      WHERE h.hadith_id = $1`,
    [hadithId],
  );
  const detailRow = hadithRows[0];
  if (!detailRow) return null;
  const {
    collection_slug,
    collection_title_ar,
    collection_title_en,
    chapter_chapter_id,
    chapter_seq,
    chapter_title_ar,
    ...hadith
  } = detailRow;
  const collection = {
    slug: collection_slug,
    title_ar: collection_title_ar,
    title_en: collection_title_en,
  };
  const chapter =
    chapter_chapter_id == null
      ? null
      : { chapter_id: chapter_chapter_id, seq: chapter_seq, title_ar: chapter_title_ar };

  const { rows: translationRows } = await pool.query<TranslationRow>(
    `SELECT lang, text_full, source, match_via
       FROM corpus.hadith_translations
      WHERE hadith_id = $1 AND lang = $2`,
    [hadithId, lang],
  );

  const { rows: isnadRows } = await pool.query<IsnadLinkRow>(
    `SELECT l.sanad_no, l.position, l.narrator_id, l.raw_name, n.display_name,
            n.name_en, l.transmission_word, l.is_compiler, l.resolution,
            coalesce(n.is_placeholder, false) AS is_placeholder,
            n.rank_ibn_hajar, rlh.weight AS rank_ibn_hajar_weight,
            n.rank_dhahabi, rld.weight AS rank_dhahabi_weight
       FROM corpus.isnad_links l
       LEFT JOIN corpus.narrators n ON n.narrator_id = l.narrator_id
       LEFT JOIN corpus.rank_levels rlh ON rlh.rank_code = n.rank_ibn_hajar
       LEFT JOIN corpus.rank_levels rld ON rld.rank_code = n.rank_dhahabi
      WHERE l.hadith_id = $1
      ORDER BY l.sanad_no, l.position`,
    [hadithId],
  );

  const { rows: strengthRows } = await pool.query<{ chain_strength: string | null }>(
    `SELECT corpus.chain_strength($1) AS chain_strength`,
    [hadithId],
  );
  const rawStrength = strengthRows[0]?.chain_strength;

  // Per-sanad strength comes from the corpus view (§8.4), not a second
  // function duplicating the arithmetic. Links group in application code;
  // isnadChain stays flat so existing readers keep working.
  const { rows: sanadRows } = await pool.query<{ sanad_no: number; strength: string | null }>(
    `SELECT sanad_no, strength FROM corpus.sanad_strengths WHERE hadith_id = $1 ORDER BY sanad_no`,
    [hadithId],
  );
  const strengthBySanad = new Map(
    sanadRows.map((r) => [r.sanad_no, r.strength != null ? Number(r.strength) : null] as const),
  );
  const chains: SanadChain[] = [];
  for (const link of isnadRows) {
    const current = chains[chains.length - 1];
    if (current && current.sanad_no === link.sanad_no) {
      current.links.push(link);
    } else {
      chains.push({
        sanad_no: link.sanad_no,
        strength: strengthBySanad.get(link.sanad_no) ?? null,
        links: [link],
      });
    }
  }

  return {
    hadith: hadith as HadithRow,
    collection,
    chapter,
    translation: translationRows[0] ?? null,
    isnadChain: isnadRows,
    chains,
    chainStrength: rawStrength != null ? Number(rawStrength) : null,
  };
}
