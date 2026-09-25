import type { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { COOKIE_SAMESITE, COOKIE_SECURE, REFRESH_TOKEN_TTL_DAYS } from '../../config.js';
import { signAccessToken } from '../../lib/jwt.js';
import { SALT_ROUNDS, verifyPassword } from '../../lib/password.js';
import { issueRefreshToken, consumeRefreshToken, revokeRefreshToken } from '../../lib/refreshToken.js';
import { UnauthenticatedError } from '../../lib/errors.js';
import { findMeById, findUserByEmail, registerUser, changePassword } from './auth.model.js';

const REFRESH_COOKIE = 'refresh_token';
const REFRESH_COOKIE_MAX_AGE_MS = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

// A well-formed bcrypt hash of an unguessable, unused password. Used as the
// compare target when the email doesn't exist, so login always pays the same
// bcrypt cost whether or not the account is real -- see the timing-oracle fix
// below in `login`.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('dummy-password-for-timing-safety', SALT_ROUNDS);

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(1),
  role: z.enum(['student', 'teacher']),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    // Both come from config, because a static-host deployment puts the frontend
    // on another site and a Lax cookie is then never sent. config.ts refuses to
    // start on a combination the browser would reject in silence.
    sameSite: COOKIE_SAMESITE.toLowerCase() as 'lax' | 'strict' | 'none',
    secure: COOKIE_SECURE,
    path: '/',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  });
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const body = registerSchema.parse(req.body);
    const { user_id } = await registerUser(body);
    const accessToken = signAccessToken(user_id, body.role);
    const refreshToken = await issueRefreshToken(user_id);
    setRefreshCookie(res, refreshToken);
    res.status(201).json({ data: { accessToken } });
  } catch (e) {
    next(e);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const body = loginSchema.parse(req.body);
    const user = await findUserByEmail(body.email);
    const passwordOk = await verifyPassword(body.password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
    if (!user || !passwordOk) {
      throw new UnauthenticatedError('invalid email or password');
    }
    const accessToken = signAccessToken(user.user_id, user.role);
    const refreshToken = await issueRefreshToken(user.user_id);
    setRefreshCookie(res, refreshToken);
    res.json({ data: { accessToken } });
  } catch (e) {
    next(e);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new UnauthenticatedError('no session');
    const userId = await consumeRefreshToken(token);
    if (!userId) throw new UnauthenticatedError('session expired');
    const me = await findMeById(userId);
    if (!me) throw new UnauthenticatedError('no session');
    const accessToken = signAccessToken(userId, me.role);
    res.json({ data: { accessToken } });
  } catch (e) {
    next(e);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) await revokeRefreshToken(token);
    // The same sameSite and secure as setRefreshCookie. A browser applies an
    // expiry only to a cookie whose attributes it accepts, and it drops a
    // SameSite=None cookie that carries no Secure -- so a mismatch here leaves
    // the cookie in place and logout does not clear it.
    res.clearCookie(REFRESH_COOKIE, {
      path: '/',
      sameSite: COOKIE_SAMESITE.toLowerCase() as 'lax' | 'strict' | 'none',
      secure: COOKIE_SECURE,
    });
    res.json({ data: null });
  } catch (e) {
    next(e);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const row = await findMeById(userId);
    if (!row) throw new UnauthenticatedError('unauthenticated');
    res.json({
      data: {
        user_id: row.user_id,
        role: row.role,
        full_name: row.full_name,
        email: row.email,
        is_verified: row.role === 'teacher' ? (row.is_verified ?? false) : undefined,
      },
    });
  } catch (e) {
    next(e);
  }
}

const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8),
});

export async function changePasswordHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const body = changePasswordSchema.parse(req.body);
    const { userId, role } = req.user!;
    const changed = await changePassword(userId, role, body.current_password, body.new_password);
    if (!changed) throw new UnauthenticatedError('current password is wrong');
    res.json({ data: null });
  } catch (e) {
    next(e);
  }
}
