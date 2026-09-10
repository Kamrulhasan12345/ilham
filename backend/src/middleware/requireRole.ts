import type { NextFunction, Request, Response } from 'express';
import type { Role } from '../lib/jwt.js';
import { ForbiddenError } from '../lib/errors.js';

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) =>
    req.user && roles.includes(req.user.role) ? next() : next(new ForbiddenError('forbidden'));
