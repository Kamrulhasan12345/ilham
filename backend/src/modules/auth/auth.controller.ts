import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { COOKIE_SAMESITE, COOKIE_SECURE, REFRESH_TOKEN_TTL_DAYS } from '../../config.js';
import { signAccessToken } from '../../lib/jwt.js';
import { SALT_ROUNDS, verifyPassword } from '../../lib/password.js';
import { issueRefreshToken, consumeRefreshToken, revokeRefreshToken } from '../../lib/refreshToken.js';
import { findMeById, findUserByEmail, registerUser } from './auth.model.js';

const REFRESH_COOKIE = 'refresh_token';
const REFRESH_COOKIE_MAX_AGE = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60;

// A well-formed bcrypt hash of an unguessable, unused password. Used as the
// compare target when the email doesn't exist, so login always pays the same
// bcrypt cost whether or not the account is real -- see the timing-oracle fix
// below in `login`.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('dummy-password-for-timing-safety', SALT_ROUNDS);

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
    // Both come from config, because a static-host deployment puts the frontend
    // on another site and a Lax cookie is then never sent. config.ts refuses to
    // start on a combination the browser would reject in silence.
    sameSite: COOKIE_SAMESITE,
    secure: COOKIE_SECURE,
    path: '/',
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
}

export async function register(c: Context) {
  const body = await c.req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: 'invalid registration payload' });
  }
  // No pre-check for an existing email here: that read-then-write is a TOCTOU
  // race under concurrent registrations. app.assert_email_unique (the trigger)
  // is the single source of truth, and its 23505 is mapped to 409 in
  // app.ts's onError.
  const { user_id } = await registerUser(parsed.data);
  const accessToken = signAccessToken(user_id, parsed.data.role);
  const refreshToken = await issueRefreshToken(user_id);
  setRefreshCookie(c, refreshToken);
  return c.json({ data: { accessToken } }, 201);
}

export async function login(c: Context) {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: 'invalid login payload' });
  }
  const user = await findUserByEmail(parsed.data.email);
  // Always run a bcrypt compare, even when there's no such user, so a
  // nonexistent email and a wrong password cost the same time -- otherwise
  // the `||` short-circuit is a user-enumeration timing oracle.
  const passwordOk = await verifyPassword(parsed.data.password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
  if (!user || !passwordOk) {
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
  // The same sameSite and secure as setRefreshCookie. A browser applies an
  // expiry only to a cookie whose attributes it accepts, and it drops a
  // SameSite=None header that carries no Secure — so a mismatch here leaves the
  // cookie in place and logout does not clear it.
  deleteCookie(c, REFRESH_COOKIE, {
    path: '/',
    sameSite: COOKIE_SAMESITE,
    secure: COOKIE_SECURE,
  });
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
