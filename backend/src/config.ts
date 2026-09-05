import 'dotenv/config';

export const DB = {
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'ilham',
  user: process.env.PGUSER || 'ilham_app',
  password: process.env.PGPASSWORD,
};

export const PORT = Number(process.env.PORT || 3000);

export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Secrets that must never sign a real token.
 *
 * compose.yaml sets the first one as its default, so `compose up` works with no
 * setup — the same bargain as the committed `ilham` database password.
 *
 * ALLOW_DEV_SECRET, and not NODE_ENV, is what permits it. The Dockerfile sets
 * NODE_ENV=production for node's own sake, so every container carries it and it
 * says nothing about whether this is a real deployment. compose.yaml sets
 * ALLOW_DEV_SECRET deliberately, and a deployment that copies neither the
 * secret nor the flag refuses to start.
 */
export const DEV_JWT_SECRET = 'dev-only-insecure-secret-do-not-use-in-production';
const REJECTED_SECRETS = new Set([DEV_JWT_SECRET, 'change-me-before-deploying']);
const ALLOW_DEV_SECRET = process.env.ALLOW_DEV_SECRET === '1';

const _JWT_SECRET = process.env.JWT_SECRET;

if (!_JWT_SECRET || _JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set to a real value (at least 32 characters)');
}

if (REJECTED_SECRETS.has(_JWT_SECRET) && !ALLOW_DEV_SECRET) {
  throw new Error(
    'JWT_SECRET is a known development placeholder. Set ALLOW_DEV_SECRET=1 to accept it for local work, or generate a real one: openssl rand -base64 48',
  );
}

export const JWT_SECRET: string = _JWT_SECRET;
export const JWT_ACCESS_TTL = process.env.JWT_ACCESS_TTL || '15m';
export const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7);

/**
 * The browser origins that may send credentialed requests.
 *
 * A list, not one value: a static-host deployment usually has more than one
 * front door — the production domain, and a preview URL for each branch. Give
 * them comma separated. Every entry must match the browser's address exactly:
 * scheme, host and port, and no trailing slash.
 */
export const WEB_ORIGINS: string[] = (process.env.WEB_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

if (WEB_ORIGINS.length === 0) {
  throw new Error('WEB_ORIGIN must name at least one browser origin');
}

/**
 * SameSite for the refresh cookie.
 *
 * 'Lax' suits every same-origin deployment, which is what nginx and the Vite
 * dev proxy each give. Keep it there when you can.
 *
 * A static host with the API on another site is the case that needs 'None'.
 * SameSite is about the registrable domain, not the origin, so a different
 * PORT or subdomain is still 'Lax' territory: api.example.com and
 * app.example.com are one site, and the cookie flows. Genuinely different
 * sites — say a .pages.dev frontend against an API on your own domain — do not
 * send a Lax cookie at all, and the session ends when the access token expires
 * with nothing in the console to say why.
 */
const _COOKIE_SAMESITE = process.env.COOKIE_SAMESITE || 'Lax';

if (!['Lax', 'Strict', 'None'].includes(_COOKIE_SAMESITE)) {
  throw new Error(`COOKIE_SAMESITE must be Lax, Strict or None (got '${_COOKIE_SAMESITE}')`);
}

export const COOKIE_SAMESITE = _COOKIE_SAMESITE as 'Lax' | 'Strict' | 'None';

/**
 * Secure follows the scheme the BROWSER uses, which is what actually decides
 * whether a Secure cookie can come back.
 *
 * It used to follow NODE_ENV. The Dockerfile sets NODE_ENV=production for
 * node's own sake, so the container marked the cookie Secure while compose
 * serves it over plain HTTP. That survives on localhost only because browsers
 * treat localhost as a secure context, and it breaks the moment the stack is
 * reached by any other hostname.
 *
 * WEB_ORIGINS says how the browser reaches the app, so it is the honest signal.
 * COOKIE_SECURE overrides it for a deployment that terminates TLS upstream and
 * forwards plain HTTP.
 *
 * 'None' forces it on: every browser drops a `SameSite=None` cookie that has no
 * `Secure`, and it does so in silence — login looks fine and the next refresh
 * signs the user out.
 */
const _COOKIE_SECURE_OVERRIDE = process.env.COOKIE_SECURE;
const ALL_ORIGINS_HTTPS = WEB_ORIGINS.every((origin) => origin.startsWith('https://'));

export const COOKIE_SECURE =
  _COOKIE_SECURE_OVERRIDE !== undefined
    ? _COOKIE_SECURE_OVERRIDE === '1' || _COOKIE_SECURE_OVERRIDE === 'true'
    : ALL_ORIGINS_HTTPS || COOKIE_SAMESITE === 'None';

if (COOKIE_SAMESITE === 'None' && WEB_ORIGINS.some((origin) => origin.startsWith('http://'))) {
  throw new Error(
    `COOKIE_SAMESITE=None sends a Secure cookie, which a browser will not return to an http:// origin. WEB_ORIGIN has one: ${WEB_ORIGINS.filter((o) => o.startsWith('http://')).join(', ')}`,
  );
}
