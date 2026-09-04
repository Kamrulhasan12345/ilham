export type Role = 'student' | 'teacher' | 'admin';

export interface AuthUser {
  userId: number;
  role: Role;
  name: string;
  email: string;
  isVerified?: boolean;
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; user: AuthUser };

export type GuardRequirement = 'public' | 'signedIn' | 'teacher' | 'verifiedTeacher' | 'admin';
export type GuardResult = 'ok' | 'redirect-login' | 'redirect-forbidden';

/**
 * docs/frontend-prd.md §5.4. `public` never checks auth state. Every other
 * requirement sends a signed-out (or still-loading) visitor to /login first,
 * then applies the role rule to a signed-in user.
 */
export function evaluateGuard(state: AuthState, requirement: GuardRequirement): GuardResult {
  if (requirement === 'public') return 'ok';
  if (state.status !== 'signed-in') return 'redirect-login';

  const { role, isVerified } = state.user;
  switch (requirement) {
    case 'signedIn':
      return 'ok';
    case 'teacher':
      return role === 'teacher' || role === 'admin' ? 'ok' : 'redirect-forbidden';
    case 'verifiedTeacher':
      return role === 'admin' || (role === 'teacher' && isVerified === true)
        ? 'ok'
        : 'redirect-forbidden';
    case 'admin':
      return role === 'admin' ? 'ok' : 'redirect-forbidden';
  }
}
