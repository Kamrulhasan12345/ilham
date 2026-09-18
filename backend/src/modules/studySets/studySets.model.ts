import { pool } from '../../db/pool.js';
import type { StudySetItemRow, StudySetRow } from './studySets.interface.js';

export async function listStudySetsForOwner(ownerId: number): Promise<StudySetRow[]> {
  const { rows } = await pool.query<StudySetRow>(
    `SELECT study_set_id, owner_id, name, created_at
       FROM app.study_sets WHERE owner_id = $1 ORDER BY created_at DESC`,
    [ownerId],
  );
  return rows;
}

export async function getStudySetById(studySetId: number): Promise<StudySetRow | null> {
  const { rows } = await pool.query<StudySetRow>(
    `SELECT study_set_id, owner_id, name, created_at FROM app.study_sets WHERE study_set_id = $1`,
    [studySetId],
  );
  return rows[0] ?? null;
}

export async function createStudySet(input: { ownerId: number; name: string }): Promise<StudySetRow> {
  const { rows } = await pool.query<StudySetRow>(
    `INSERT INTO app.study_sets (owner_id, name) VALUES ($1, $2)
     RETURNING study_set_id, owner_id, name, created_at`,
    [input.ownerId, input.name],
  );
  return rows[0];
}

export async function renameStudySet(studySetId: number, name: string): Promise<StudySetRow | null> {
  const { rows } = await pool.query<StudySetRow>(
    `UPDATE app.study_sets SET name = $2 WHERE study_set_id = $1
     RETURNING study_set_id, owner_id, name, created_at`,
    [studySetId, name],
  );
  return rows[0] ?? null;
}

export async function deleteStudySet(studySetId: number): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM app.study_sets WHERE study_set_id = $1`, [
    studySetId,
  ]);
  return (rowCount ?? 0) > 0;
}

export async function listStudySetItems(studySetId: number): Promise<StudySetItemRow[]> {
  const { rows } = await pool.query<StudySetItemRow>(
    `SELECT h.hadith_id, h.hadith_num, h.text_plain
       FROM app.study_set_items i
       JOIN corpus.hadiths h ON h.hadith_id = i.hadith_id
      WHERE i.study_set_id = $1
      ORDER BY i.hadith_id`,
    [studySetId],
  );
  return rows;
}

export async function addStudySetItem(studySetId: number, hadithId: number): Promise<void> {
  await pool.query(
    `INSERT INTO app.study_set_items (study_set_id, hadith_id) VALUES ($1, $2)`,
    [studySetId, hadithId],
  );
}

export async function removeStudySetItem(studySetId: number, hadithId: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM app.study_set_items WHERE study_set_id = $1 AND hadith_id = $2`,
    [studySetId, hadithId],
  );
  return (rowCount ?? 0) > 0;
}
