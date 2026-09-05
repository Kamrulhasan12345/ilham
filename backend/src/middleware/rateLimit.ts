import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';

interface Bucket {
  count: number;
  windowStart: number;
}

const WINDOW_MS = 60_000;

export function rateLimit(maxRequests: number) {
  const buckets = new Map<string, Bucket>();
  return async (c: Context, next: Next) => {
    const key = c.req.header('x-forwarded-for') ?? 'unknown';
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || now - bucket.windowStart > WINDOW_MS) {
      buckets.set(key, { count: 1, windowStart: now });
    } else {
      bucket.count += 1;
      if (bucket.count > maxRequests) {
        throw new HTTPException(429, { message: 'too many requests, try again later' });
      }
    }
    await next();
  };
}
