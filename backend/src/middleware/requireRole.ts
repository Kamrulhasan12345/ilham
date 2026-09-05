import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Role } from '../lib/jwt.js';

export function requireRole(...roles: Role[]) {
  return async (c: Context, next: Next) => {
    const role = c.get('role') as Role;
    if (!roles.includes(role)) {
      throw new HTTPException(403, { message: 'forbidden' });
    }
    await next();
  };
}
