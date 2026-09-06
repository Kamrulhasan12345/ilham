import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../lib/jwt.js';
import { UnauthenticatedError } from '../lib/errors.js';

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.get('authorization');
  if (!header?.startsWith('Bearer ')) return next(new UnauthenticatedError('missing bearer token'));
  try {
    const claims = verifyAccessToken(header.slice(7));
    req.user = { userId: Number(claims.sub), role: claims.role };
    next();
  } catch {
    next(new UnauthenticatedError('invalid or expired token'));
  }
}
