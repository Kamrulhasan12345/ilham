import { pool } from '../../db/pool.js';
import type {
  ChainStrengthBasis,
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
  text_en: string | null;
  sanad_count: number;
  chain_strength: number | null;
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

  const { rows } = await pool.query<HadithListRow & { chain_strength: string | null }>(
    `SELECT h.hadith_id, h.collection_id, h.chapter_id, h.hadith_num, h.text_plain, h.sanad_count,
            t.text_full AS text_en,
            corpus.chain_strength(h.hadith_id) AS chain_strength
       FROM corpus.hadiths h
       LEFT JOIN corpus.hadith_translations t ON t.hadith_id = h.hadith_id AND t.lang = 'en'
       ${where}
      ORDER BY h.hadith_id
      LIMIT ${limitPh} OFFSET ${offsetPh}`,
    values,
  );
  // numeric comes back as text; the list contract carries numbers.
  return rows.map((r) => ({
    ...r,
    chain_strength: r.chain_strength != null ? Number(r.chain_strength) : null,
  }));
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

export interface StrengthBucket {
  bucket: number;
  count: number;
}

/**
 * The corpus distribution strip: 14 buckets over every scored hadith.
 * Reads the sanad_strengths view's own arithmetic — never a second copy
 * of it — so the strip and the scores cannot disagree. Empty buckets come
 * back as zero, because the strip draws all 14.
 */
export async function strengthDistribution(): Promise<StrengthBucket[]> {
  const { rows } = await pool.query<{ bucket: string; count: string }>(
    `SELECT width_bucket(s, 0, 1, 14) AS bucket, count(*) AS count
       FROM (SELECT max(strength) AS s FROM corpus.sanad_strengths GROUP BY hadith_id) t
      WHERE s IS NOT NULL
      GROUP BY 1 ORDER BY 1`,
  );
  const byBucket = new Map(rows.map((r) => [Number(r.bucket), Number(r.count)] as const));
  return Array.from({ length: 14 }, (_, i) => ({ bucket: i + 1, count: byBucket.get(i + 1) ?? 0 }));
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
    // weight repeats corpus.chain_strength's own per-link arithmetic inline
    // (same CASE, same anʿana penalty) so a reader never recomputes it and
    // the two cannot disagree. The ETL aligns transmission words for
    // single-sanad hadiths only, so the penalty fires exactly where the
    // function sees it fire.
    `SELECT l.sanad_no, l.position, l.narrator_id, l.raw_name, n.display_name,
            n.name_en, n.kunya, n.lineage, n.school, n.tabaqa_raw, n.generation,
            l.transmission_word, l.is_compiler, l.resolution,
            coalesce(n.is_placeholder, false) AS is_placeholder,
            n.rank_ibn_hajar_raw, n.rank_ibn_hajar, n.rank_ibn_hajar_via,
            rlh.weight AS rank_ibn_hajar_weight,
            n.rank_dhahabi_raw, n.rank_dhahabi, n.rank_dhahabi_via,
            rld.weight AS rank_dhahabi_weight,
            CASE
              WHEN l.narrator_id IS NULL OR n.is_placeholder THEN 0.15
              WHEN n.rank_ibn_hajar IS NULL AND n.rank_dhahabi IS NULL THEN 0.50
              ELSE least(coalesce(rlh.weight, 1), coalesce(rld.weight, 1))
            END
            - CASE WHEN l.transmission_norm IN ('عن', 'وعن') THEN 0.05 ELSE 0 END
            AS weight
       FROM corpus.isnad_links l
       LEFT JOIN corpus.narrators n ON n.narrator_id = l.narrator_id
       LEFT JOIN corpus.rank_levels rlh ON rlh.rank_code = n.rank_ibn_hajar
       LEFT JOIN corpus.rank_levels rld ON rld.rank_code = n.rank_dhahabi
      WHERE l.hadith_id = $1
      ORDER BY l.sanad_no, l.position`,
    [hadithId],
  );

  // numeric comes back as text; the detail contract carries numbers.
  for (const link of isnadRows) {
    link.weight = link.weight != null ? Number(link.weight) : null;
  }

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

  // The ETL aligns transmission words for single-sanad hadiths only, so the
  // anʿana penalty cannot fire on multi-sanad chains. The number is not
  // comparable across hadiths without this flag beside it.
  const basis: ChainStrengthBasis = {
    words_aligned: hadith.sanad_count === 1,
    sanad_count: hadith.sanad_count,
  };

  return {
    hadith: hadith as HadithRow,
    collection,
    chapter,
    translation: translationRows[0] ?? null,
    isnadChain: isnadRows,
    chains,
    chainStrength: rawStrength != null ? Number(rawStrength) : null,
    chainStrengthBasis: basis,
  };
}
