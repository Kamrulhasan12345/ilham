import { type ZodSchema, z } from 'zod';

// '/api' is same-origin, which is the point: nginx (in the image) and the Vite
// dev server (locally) both proxy it to the backend, so the browser makes no
// cross-origin request and the httpOnly refresh cookie needs no SameSite=None.
//
// VITE_API_BASE overrides it for a static-host deployment, where no proxy
// exists and the API has its own absolute URL. Vite inlines the value at build
// time — see frontend/.env.example for what that costs.
const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

const refreshResponseSchema = z.object({ accessToken: z.string() });

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

type SessionLostListener = () => void;
// A set, not a single slot: AuthProvider clears its state and the app root
// invalidates the router, and both subscribe independently (each returns an
// unsubscribe for StrictMode-safe cleanup).
const sessionLostListeners = new Set<SessionLostListener>();

export function onSessionLost(listener: SessionLostListener): () => void {
  sessionLostListeners.add(listener);
  return () => {
    sessionLostListeners.delete(listener);
  };
}

function emitSessionLost(): void {
  for (const listener of sessionLostListeners) listener();
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

let refreshPromise: Promise<string> | null = null;

/**
 * Single-flight: many callers can await the same in-flight refresh instead of
 * each starting their own. docs/frontend-prd.md §5.3.
 */
export async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      setAccessToken(null);
      emitSessionLost();
      throw new ApiError(res.status, 'unauthenticated', 'session expired');
    }
    const json = await res.json().catch(() => null);
    const parsed = refreshResponseSchema.safeParse((json as { data?: unknown } | null)?.data);
    if (!parsed.success) {
      setAccessToken(null);
      emitSessionLost();
      throw new ApiError(
        res.status,
        'contract_error',
        'refresh response did not match the expected shape',
      );
    }
    setAccessToken(parsed.data.accessToken);
    return parsed.data.accessToken;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

// /auth/refresh and /auth/login are excluded because retrying them on a 401
// would either loop forever (refresh retrying itself) or paper over a
// genuine login failure. /auth/logout is excluded because there is nothing
// useful to retry it into — the session is ending either way.
const NO_RETRY_PATHS = new Set(['/auth/refresh', '/auth/login', '/auth/logout']);

export async function apiFetch<T>(
  path: string,
  schema: ZodSchema<T>,
  options: ApiFetchOptions = {},
): Promise<T> {
  const send = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      // Always, and not for each caller to remember. /auth/login and
      // /auth/register set the refresh cookie, and a cross-origin response only
      // stores one when the request asks to carry credentials — so those two
      // silently signed the user out on the next refresh, on a static-host
      // deployment, while working the whole time on one origin.
      //
      // This costs nothing same-origin: the cookie has path '/', so the browser
      // already sends it with every request there.
      credentials: 'include',
    });
  };

  let res = await send();

  if (res.status === 401 && !NO_RETRY_PATHS.has(path)) {
    await refreshAccessToken();
    res = await send();
  }

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const code = (json as { error?: { code?: string } } | null)?.error?.code ?? 'internal_error';
    const message =
      (json as { error?: { message?: string } } | null)?.error?.message ?? 'request failed';
    throw new ApiError(res.status, code, message);
  }

  const payload = (json as { data?: unknown } | null)?.data;
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(res.status, 'contract_error', 'response did not match the expected shape');
  }
  return parsed.data;
}
