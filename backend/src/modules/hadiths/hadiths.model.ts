import { pool } from '../../db/pool.js';
import type {
  HadithDetail,
  HadithListParams,
  HadithRow,
  IsnadLinkRow,
  TranslationRow,
} from './hadiths.interface.js';

export async function listHadiths(params: HadithListParams): Promise<HadithRow[]> {
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

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  values.push(params.limit);
  const limitPlaceholder = `$${values.length}`;
  values.push(params.offset);
  const offsetPlaceholder = `$${values.length}`;

  const { rows } = await pool.query<HadithRow>(
    `SELECT hadith_id, collection_id, chapter_id, hadith_num, text_plain, text_diac, sanad_count
       FROM corpus.hadiths
       ${where}
      ORDER BY hadith_id
      LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
    values,
  );
  return rows;
}

export async function getHadithDetail(
  hadithId: number,
  lang = 'en',
): Promise<HadithDetail | null> {
  const { rows: hadithRows } = await pool.query<HadithRow>(
    `SELECT hadith_id, collection_id, chapter_id, hadith_num, text_plain, text_diac, sanad_count
       FROM corpus.hadiths
      WHERE hadith_id = $1`,
    [hadithId],
  );
  const hadith = hadithRows[0];
  if (!hadith) return null;

  const { rows: translationRows } = await pool.query<TranslationRow>(
    `SELECT lang, text_full, source
       FROM corpus.hadith_translations
      WHERE hadith_id = $1 AND lang = $2`,
    [hadithId, lang],
  );

  const { rows: isnadRows } = await pool.query<IsnadLinkRow>(
    `SELECT l.sanad_no, l.position, l.narrator_id, l.raw_name, n.display_name,
            l.transmission_word, l.is_compiler, l.resolution
       FROM corpus.isnad_links l
       LEFT JOIN corpus.narrators n ON n.narrator_id = l.narrator_id
      WHERE l.hadith_id = $1
      ORDER BY l.sanad_no, l.position`,
    [hadithId],
  );

  const { rows: strengthRows } = await pool.query<{ chain_strength: string | null }>(
    `SELECT corpus.chain_strength($1) AS chain_strength`,
    [hadithId],
  );
  const rawStrength = strengthRows[0]?.chain_strength;

  return {
    hadith,
    translation: translationRows[0] ?? null,
    isnadChain: isnadRows,
    chainStrength: rawStrength != null ? Number(rawStrength) : null,
  };
}
