export interface StudySetRow {
  study_set_id: number;
  owner_id: number;
  name: string;
  created_at: string;
}

export interface StudySetItemRow {
  hadith_id: number;
  hadith_num: string;
  text_plain: string;
}
