import { randomUUID } from 'node:crypto';
import type { Request } from 'express';

// Trust X-Forwarded-For only when a trusted reverse proxy sits in front of
// this service and sets that header itself. Nothing does that today --
// compose.yaml binds the API straight to 127.0.0.1:3000, with no proxy
// anywhere in the repo -- so this defaults to false, and a real client's raw
// connection address is used instead. A deployment that adds a reverse proxy
// sets TRUST_PROXY=1 to opt in. Read per call, not cached at module load, so
// it can change without a restart (and so a test can toggle it).
function trustProxyEnabled(): boolean {
  return process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true';
}

// Work out the rate-limit bucket key for one request. Exported so
// express-rate-limit's keyGenerator can use it, and so a test can drive it
// with a synthetic Request.
export function resolveClientKey(req: Request): string {
  if (trustProxyEnabled()) {
    const xff = req.get('x-forwarded-for');
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
  // req.socket.remoteAddress is the real TCP peer address -- unlike req.ip,
  // it is never influenced by X-Forwarded-For unless Express's own
  // `trust proxy` setting is on (this app never sets it), so it can't be
  // spoofed by a header.
  const remoteAddress = req.socket.remoteAddress;
  if (remoteAddress) return `ip:${remoteAddress}`;
  // No address could be determined (only plausible under a test harness with
  // no real socket). Do not fall back to a constant key: that is the original
  // bug -- every client with no address shares one bucket, so 5 requests from
  // anyone locks out everyone else. crypto.randomUUID() keeps this request's
  // count isolated from every other client's bucket instead.
  return `anon:${randomUUID()}`;
}
