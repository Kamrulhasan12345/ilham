import type { Role } from '../lib/jwt.js';

declare global {
  namespace Express {
    interface Request {
      user?: { userId: number; role: Role };
    }
  }
}
export {};
