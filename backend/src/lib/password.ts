import bcrypt from 'bcryptjs';

// Exported so auth.controller.ts's timing-safety dummy hash uses the same
// cost factor as a real one. Two hardcoded copies would let someone tune this
// number and silently weaken the login timing-oracle defence.
export const SALT_ROUNDS = 10;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
