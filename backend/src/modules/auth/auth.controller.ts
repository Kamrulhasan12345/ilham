import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { REFRESH_TOKEN_TTL_DAYS } from '../../config.js';
import { signAccessToken } from '../../lib/jwt.js';
import { verifyPassword } from '../../lib/password.js';
import { issueRefreshToken, consumeRefreshToken, revokeRefreshToken } from '../../lib/refreshToken.js';
import { findMeById, findUserByEmail, registerUser } from './auth.model.js';

const REFRESH_COOKIE = 'refresh_token';
const REFRESH_COOKIE_MAX_AGE = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60;

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(1),
  role: z.enum(['student', 'teacher']),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function setRefreshCookie(c: Context, token: string): void {
  setCookie(c, REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: false, // dev over plain HTTP; flip to true once served over HTTPS
    path: '/',
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
}

export async function register(c: Context) {
  const parsed = registerSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    throw new HTTPException(400, { message: 'invalid registration payload' });
  }
  const existing = await findUserByEmail(parsed.data.email);
  if (existing) {
    throw new HTTPException(409, { message: 'email is already registered' });
  }
  const { user_id } = await registerUser(parsed.data);
  const accessToken = signAccessToken(user_id, parsed.data.role);
  const refreshToken = await issueRefreshToken(user_id);
  setRefreshCookie(c, refreshToken);
  return c.json({ data: { accessToken } }, 201);
}

export async function login(c: Context) {
  const parsed = loginSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    throw new HTTPException(400, { message: 'invalid login payload' });
  }
  const user = await findUserByEmail(parsed.data.email);
  if (!user || !(await verifyPassword(parsed.data.password, user.password_hash))) {
    throw new HTTPException(401, { message: 'invalid email or password' });
  }
  const accessToken = signAccessToken(user.user_id, user.role);
  const refreshToken = await issueRefreshToken(user.user_id);
  setRefreshCookie(c, refreshToken);
  return c.json({ data: { accessToken } });
}

export async function refresh(c: Context) {
  const token = getCookie(c, REFRESH_COOKIE);
  if (!token) {
    throw new HTTPException(401, { message: 'no session' });
  }
  const userId = await consumeRefreshToken(token);
  if (!userId) {
    throw new HTTPException(401, { message: 'session expired' });
  }
  const me = await findMeById(userId);
  if (!me) {
    throw new HTTPException(401, { message: 'no session' });
  }
  const accessToken = signAccessToken(userId, me.role);
  return c.json({ data: { accessToken } });
}

export async function logout(c: Context) {
  const token = getCookie(c, REFRESH_COOKIE);
  if (token) await revokeRefreshToken(token);
  deleteCookie(c, REFRESH_COOKIE, { path: '/' });
  return c.json({ data: null });
}

export async function me(c: Context) {
  const userId = c.get('userId') as number;
  const row = await findMeById(userId);
  if (!row) {
    throw new HTTPException(401, { message: 'unauthenticated' });
  }
  return c.json({
    data: {
      user_id: row.user_id,
      role: row.role,
      full_name: row.full_name,
      email: row.email,
      is_verified: row.role === 'teacher' ? (row.is_verified ?? false) : undefined,
    },
  });
}
