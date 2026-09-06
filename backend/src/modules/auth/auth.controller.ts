import type { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { IS_PRODUCTION, REFRESH_TOKEN_TTL_DAYS } from '../../config.js';
import { signAccessToken } from '../../lib/jwt.js';
import { verifyPassword } from '../../lib/password.js';
import { issueRefreshToken, consumeRefreshToken, revokeRefreshToken } from '../../lib/refreshToken.js';
import { UnauthenticatedError } from '../../lib/errors.js';
import { findMeById, findUserByEmail, registerUser } from './auth.model.js';

const REFRESH_COOKIE = 'refresh_token';
const REFRESH_COOKIE_MAX_AGE_MS = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

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

const DUMMY_PASSWORD_HASH = bcrypt.hashSync('dummy-password-for-timing-safety', 10);

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PRODUCTION,
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
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
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
