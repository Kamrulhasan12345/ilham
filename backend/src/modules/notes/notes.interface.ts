export interface NoteRow {
  note_id: number;
  user_id: number;
  hadith_id: number;
  body: string;
  created_at: string;
}

export interface CreateNoteInput {
  userId: number;
  hadithId: number;
  body: string;
}
