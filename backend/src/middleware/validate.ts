import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

export const validate =
  (schemas: { params?: ZodSchema; query?: ZodSchema; body?: ZodSchema }) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params);
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) res.locals.query = schemas.query.parse(req.query);
      next();
    } catch (e) {
      next(e);
    }
  };
