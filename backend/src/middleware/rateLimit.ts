import { randomUUID } from 'node:crypto';
import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getConnInfo } from '@hono/node-server/conninfo';

interface Bucket {
  count: number;
  windowStart: number;
}

const WINDOW_MS = 60_000;

// Trust X-Forwarded-For only when a trusted reverse proxy sits in front of
// this service and sets that header itself. Nothing does that today --
// compose.yaml binds the API straight to 127.0.0.1:3000, with no proxy
// anywhere in the repo -- so this defaults to false, and a real client's raw
// connection address is used instead. A deployment that adds a reverse proxy
// sets TRUST_PROXY=1 to opt in. This is read directly from process.env,
// because config.ts is out of scope for this fix; it belongs there long term.
// Read per call, not cached at module load, so it can change without a
// restart (and so a test can toggle it).
function trustProxyEnabled(): boolean {
  return process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true';
}

// Work out the bucket key for one request. Exported so a test can drive it
// with a synthetic Context, without needing a real TCP connection.
export function resolveClientKey(c: Context): string {
  if (trustProxyEnabled()) {
    const xff = c.req.header('x-forwarded-for');
    if (xff) {
      // XFF reads "client, proxy1, proxy2, ...": the original client writes
      // the first entry, and each hop after that appends the address it saw
      // *to the right*. The client controls everything it sends, so every
      // entry it can reach is spoofable -- that includes the whole string
      // when there is no proxy, and the left-hand entries even when there is
      // one. Only the rightmost entry is one our own trusted proxy appended
      // itself, overwriting nothing the client wrote, so it is the only
      // entry safe to trust. Taking the leftmost value here would just
      // re-open the original vulnerability behind a config flag.
      const hops = xff.split(',').map((hop) => hop.trim()).filter(Boolean);
      const trustedHop = hops[hops.length - 1];
      if (trustedHop) return `xff:${trustedHop}`;
    }
  }
  try {
    // getConnInfo reads the real remote address off the underlying Node
    // socket (c.env.server.incoming.socket.remoteAddress). It throws when
    // that socket is not there -- for example under Hono's in-process
    // `app.request()` test helper, which calls `app.fetch()` directly and
    // never opens a TCP connection. A real deployment behind
    // @hono/node-server always has a live socket here.
    const info = getConnInfo(c);
    if (info.remote.address) return `ip:${info.remote.address}`;
  } catch {
    // handled by the fallback below
  }
  // No address could be determined. Do not fall back to a constant key: that
  // is the original bug -- every client with no address shares one bucket,
  // so 5 requests from anyone locks out everyone else. A fresh random key
  // keeps this request's count isolated from every other client's bucket
  // instead, which is the safe default when identity is unknown. This branch
  // does not fire in production, where every request has a real socket.
  return `anon:${randomUUID()}`;
}

export function rateLimit(maxRequests: number) {
  const buckets = new Map<string, Bucket>();
  return async (c: Context, next: Next) => {
    const key = resolveClientKey(c);
    const now = Date.now();
    // Evict every expired bucket on each call. Traffic through this
    // middleware is low -- it only guards /auth/register and /auth/login --
    // so an O(n) sweep here is cheap, and it keeps the map from growing
    // without bound (it used to just accumulate keys forever).
    for (const [bucketKey, bucket] of buckets) {
      if (now - bucket.windowStart > WINDOW_MS) buckets.delete(bucketKey);
    }
    const bucket = buckets.get(key);
    if (!bucket) {
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
