export interface UserRow {
  user_id: number;
  email: string;
  password_hash: string;
  full_name: string;
  role: 'student' | 'teacher' | 'admin';
}

export interface MeRow {
  user_id: number;
  email: string;
  full_name: string;
  role: 'student' | 'teacher' | 'admin';
  is_verified: boolean | null;
}

export interface RegisterInput {
  email: string;
  password: string;
  full_name: string;
  role: 'student' | 'teacher';   // admin is never self-registered — see below
}
