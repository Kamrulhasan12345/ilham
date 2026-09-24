import type { NextFunction, Request, Response } from 'express';
import type { Role } from '../lib/jwt.js';
import { ForbiddenError } from '../lib/errors.js';

// Roles are disjoint but hierarchical: an admin does everything a teacher
// does (docs/frontend-prd.md §2), so an admin passes any role check. No
// endpoint excludes the admin, so there is no check to invert here.
export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) =>
    req.user && (req.user.role === 'admin' || roles.includes(req.user.role))
      ? next()
      : next(new ForbiddenError('forbidden'));
