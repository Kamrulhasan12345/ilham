export interface ProgressRow {
  progress_id: number;
  student_id: number;
  hadith_id: number;
  assignment_id: number | null;
  mastery: number;
  times_reviewed: number;
  last_reviewed: string | null;
}

export interface AuditLogRow {
  audit_id: number;
  progress_id: number;
  changed_by: number | null;
  old_mastery: number;
  new_mastery: number;
  changed_at: string;
}
