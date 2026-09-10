import { pool } from '../../db/pool.js';
import type { CreateNoteInput, NoteRow } from './notes.interface.js';

// Every query here filters by the CALLING user's id -- this is the whole
// ownership guarantee. A caller can never pass another user's id in; it
// always comes from the verified JWT, never from a request parameter.
export async function listNotesForUser(userId: number): Promise<NoteRow[]> {
  const { rows } = await pool.query<NoteRow>(
    `SELECT note_id, user_id, hadith_id, body, created_at
       FROM app.notes WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  return rows;
}

export async function createNote(input: CreateNoteInput): Promise<NoteRow> {
  const { rows } = await pool.query<NoteRow>(
    `INSERT INTO app.notes (user_id, hadith_id, body)
     VALUES ($1, $2, $3)
     RETURNING note_id, user_id, hadith_id, body, created_at`,
    [input.userId, input.hadithId, input.body],
  );
  return rows[0];
}

// Returns null both when the note doesn't exist AND when it belongs to
// someone else -- the caller can't distinguish "not found" from "not yours"
// from the response, which is the point (see the controller's 404 comment).
export async function findOwnNote(noteId: number, userId: number): Promise<NoteRow | null> {
  const { rows } = await pool.query<NoteRow>(
    `SELECT note_id, user_id, hadith_id, body, created_at
       FROM app.notes WHERE note_id = $1 AND user_id = $2`,
    [noteId, userId],
  );
  return rows[0] ?? null;
}

export async function updateOwnNote(noteId: number, userId: number, body: string): Promise<NoteRow | null> {
  const { rows } = await pool.query<NoteRow>(
    `UPDATE app.notes SET body = $3
      WHERE note_id = $1 AND user_id = $2
     RETURNING note_id, user_id, hadith_id, body, created_at`,
    [noteId, userId, body],
  );
  return rows[0] ?? null;
}

export async function deleteOwnNote(noteId: number, userId: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM app.notes WHERE note_id = $1 AND user_id = $2`,
    [noteId, userId],
  );
  return (rowCount ?? 0) > 0;
}
