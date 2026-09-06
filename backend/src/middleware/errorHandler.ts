import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthenticatedError,
  UnprocessableError,
} from '../lib/errors.js';

function send(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ error: { code, message } });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction, 
) {
  if (err instanceof ZodError) return send(res, 400, 'bad_request', 'invalid request');
  if (err instanceof BadRequestError) return send(res, 400, 'bad_request', err.message);
  if (err instanceof UnauthenticatedError) return send(res, 401, 'unauthenticated', err.message || 'sign in');
  if (err instanceof ForbiddenError) return send(res, 403, 'forbidden', err.message);
  if (err instanceof NotFoundError) return send(res, 404, 'not_found', err.message);
  if (err instanceof ConflictError) return send(res, 409, 'conflict', err.message);
  if (err instanceof UnprocessableError) return send(res, 422, 'unprocessable', err.message);

  const pgErr = err as { code?: string; message?: string };

  if (pgErr.code === '23505') {
    return send(res, 409, 'conflict', 'already exists');
  }
  if (pgErr.code === '23503') {
    return send(res, 422, 'unprocessable', 'referenced row is missing');
  }
  if (pgErr.code === '23514' && pgErr.message?.includes('is not verified')) {
    return send(res, 403, 'teacher_not_verified', pgErr.message);
  }
  if (pgErr.code === '42501') {
    console.error('CORPUS LOCKDOWN HIT — a write reached corpus.* it should never touch', err);
    return send(res, 500, 'internal_error', 'internal error');
  }

  console.error(err);
  return send(res, 500, 'internal_error', 'internal error');
}
