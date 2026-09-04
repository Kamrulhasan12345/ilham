import { describe, expect, it } from 'vitest';
import { type AuthState, evaluateGuard } from './guards';

const signedOut: AuthState = { status: 'signed-out' };
const loading: AuthState = { status: 'loading' };
const student: AuthState = {
  status: 'signed-in',
  user: { userId: 1, role: 'student', name: 'Amina', email: 'amina@example.com' },
};
const unverifiedTeacher: AuthState = {
  status: 'signed-in',
  user: {
    userId: 2,
    role: 'teacher',
    name: 'Ustadh Kamrul',
    email: 'k@example.com',
    isVerified: false,
  },
};
const verifiedTeacher: AuthState = {
  status: 'signed-in',
  user: {
    userId: 3,
    role: 'teacher',
    name: 'Ustadha Fatima',
    email: 'f@example.com',
    isVerified: true,
  },
};
const admin: AuthState = {
  status: 'signed-in',
  user: { userId: 4, role: 'admin', name: 'Admin', email: 'admin@example.com' },
};

describe('evaluateGuard', () => {
  it('lets anybody through a public route, signed in or not', () => {
    expect(evaluateGuard(signedOut, 'public')).toBe('ok');
    expect(evaluateGuard(student, 'public')).toBe('ok');
  });

  it('sends a signed-out or still-loading visitor to /login for signedIn', () => {
    expect(evaluateGuard(signedOut, 'signedIn')).toBe('redirect-login');
    expect(evaluateGuard(loading, 'signedIn')).toBe('redirect-login');
    expect(evaluateGuard(student, 'signedIn')).toBe('ok');
  });

  it('lets a teacher or an admin through the teacher guard, refuses a student', () => {
    expect(evaluateGuard(unverifiedTeacher, 'teacher')).toBe('ok');
    expect(evaluateGuard(verifiedTeacher, 'teacher')).toBe('ok');
    expect(evaluateGuard(admin, 'teacher')).toBe('ok');
    expect(evaluateGuard(student, 'teacher')).toBe('redirect-forbidden');
    expect(evaluateGuard(signedOut, 'teacher')).toBe('redirect-login');
  });

  it('requires verification for verifiedTeacher, but waives it for admin', () => {
    expect(evaluateGuard(verifiedTeacher, 'verifiedTeacher')).toBe('ok');
    expect(evaluateGuard(unverifiedTeacher, 'verifiedTeacher')).toBe('redirect-forbidden');
    expect(evaluateGuard(admin, 'verifiedTeacher')).toBe('ok');
    expect(evaluateGuard(student, 'verifiedTeacher')).toBe('redirect-forbidden');
  });

  it('lets only an admin through the admin guard', () => {
    expect(evaluateGuard(admin, 'admin')).toBe('ok');
    expect(evaluateGuard(verifiedTeacher, 'admin')).toBe('redirect-forbidden');
    expect(evaluateGuard(student, 'admin')).toBe('redirect-forbidden');
  });
});
