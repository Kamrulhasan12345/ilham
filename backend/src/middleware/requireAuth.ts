import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { verifyAccessToken } from '../lib/jwt.js';

export async function requireAuth(c: Context, next: Next) {
  const header = c.req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'unauthenticated' });
  }
  try {
    const claims = verifyAccessToken(header.slice(7));
    c.set('userId', Number(claims.sub));
    c.set('role', claims.role);
  } catch {
    throw new HTTPException(401, { message: 'unauthenticated' });
  }
  await next();
}
