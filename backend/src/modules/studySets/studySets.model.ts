import { pool } from '../../db/pool.js';
import { txQuery, withTransaction } from '../../lib/transaction.js';
import type { StudySetItemRow, StudySetRow } from './studySets.interface.js';

export async function listStudySetsForOwner(ownerId: number): Promise<StudySetRow[]> {
  const { rows } = await pool.query<StudySetRow>(
    `SELECT set_id AS study_set_id, owner_id, name, created_at
       FROM app.study_sets WHERE owner_id = $1 ORDER BY created_at DESC`,
    [ownerId],
  );
  return rows;
}

export async function getStudySetById(studySetId: number): Promise<StudySetRow | null> {
  const { rows } = await pool.query<StudySetRow>(
    `SELECT set_id AS study_set_id, owner_id, name, created_at FROM app.study_sets WHERE set_id = $1`,
    [studySetId],
  );
  return rows[0] ?? null;
}

// Read access for assignees: a set assigned to a circle the student is
// enrolled in. Writes stay owner-only; this function gates reads alone.
export async function isSetAssignedToStudent(
  studySetId: number,
  studentId: number,
): Promise<boolean> {
  const { rows } = await pool.query<{ ok: number }>(
    `SELECT 1 AS ok
       FROM app.assignments a
       JOIN app.enrollments e ON e.circle_id = a.circle_id
      WHERE a.set_id = $1 AND e.student_id = $2
      LIMIT 1`,
    [studySetId, studentId],
  );
  return rows.length > 0;
}

export async function createStudySet(input: { ownerId: number; name: string }): Promise<StudySetRow> {
  const { rows } = await txQuery<StudySetRow>(
    `INSERT INTO app.study_sets (owner_id, name) VALUES ($1, $2)
     RETURNING set_id AS study_set_id, owner_id, name, created_at`,
    [input.ownerId, input.name],
  );
  return rows[0];
}

export async function renameStudySet(studySetId: number, name: string): Promise<StudySetRow | null> {
  const { rows } = await txQuery<StudySetRow>(
    `UPDATE app.study_sets SET name = $2 WHERE set_id = $1
     RETURNING set_id AS study_set_id, owner_id, name, created_at`,
    [studySetId, name],
  );
  return rows[0] ?? null;
}

export async function deleteStudySet(studySetId: number): Promise<boolean> {
  const { rowCount } = await txQuery(`DELETE FROM app.study_sets WHERE set_id = $1`, [
    studySetId,
  ]);
  return (rowCount ?? 0) > 0;
}

export async function listStudySetItems(studySetId: number): Promise<StudySetItemRow[]> {
  const { rows } = await pool.query<StudySetItemRow>(
    `SELECT h.hadith_id, h.hadith_num, h.text_plain
       FROM app.set_items i
       JOIN corpus.hadiths h ON h.hadith_id = i.hadith_id
      WHERE i.set_id = $1
      ORDER BY i.hadith_id`,
    [studySetId],
  );
  return rows;
}

export async function addStudySetItem(studySetId: number, hadithId: number): Promise<void> {
  await txQuery(
    `INSERT INTO app.set_items (set_id, hadith_id) VALUES ($1, $2)`,
    [studySetId, hadithId],
  );
}

/**
 * Adds every hadith of a bab or a kitab. Hadiths already in the set are kept
 * as they are (ON CONFLICT DO NOTHING), so the call is safe to repeat.
 * Returns the number added, or null when the bab or kitab does not exist.
 */
export async function addStudySetItemsFrom(
  studySetId: number,
  from: { bab_id: number } | { kitab_id: number },
): Promise<number | null> {
  const [table, col, value] =
    'bab_id' in from ? ['babs', 'bab_id', from.bab_id] : ['kitabs', 'kitab_id', from.kitab_id];
  return withTransaction(async (client) => {
    const { rowCount: exists } = await client.query(
      `SELECT 1 FROM corpus.${table} WHERE ${col} = $1::integer`,
      [value],
    );
    if (!exists) return null;
    const { rowCount } = await client.query(
      `INSERT INTO app.set_items (set_id, hadith_id)
       SELECT $1, hadith_id FROM corpus.hadiths WHERE ${col} = $2::integer
       ON CONFLICT DO NOTHING`,
      [studySetId, value],
    );
    return rowCount ?? 0;
  });
}

export async function removeStudySetItem(studySetId: number, hadithId: number): Promise<boolean> {
  const { rowCount } = await txQuery(
    `DELETE FROM app.set_items WHERE set_id = $1 AND hadith_id = $2`,
    [studySetId, hadithId],
  );
  return (rowCount ?? 0) > 0;
}
