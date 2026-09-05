export interface UnverifiedTeacherRow {
  user_id: number;
  email: string;
  full_name: string;
  institution: string | null;
  specialization: string | null;
  created_at: string;
}
