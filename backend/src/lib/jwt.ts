import jwt from 'jsonwebtoken';
import { JWT_ACCESS_TTL, JWT_SECRET } from '../config.js';

export type Role = 'student' | 'teacher' | 'admin';

export interface AccessClaims {
  sub: string;
  role: Role;
  iat: number;
  exp: number;
}

export function signAccessToken(userId: number, role: Role): string {
  const options: jwt.SignOptions = { expiresIn: JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'] };
  return jwt.sign({ sub: String(userId), role }, JWT_SECRET as string, options);
}

export function verifyAccessToken(token: string): AccessClaims {
  return jwt.verify(token, JWT_SECRET as string) as AccessClaims;
}
