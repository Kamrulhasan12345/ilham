import { type ZodSchema, z } from 'zod';

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
      throw new ApiError(res.status, 'unauthenticated', 'session expired');
    }
    const json = await res.json().catch(() => null);
    const parsed = refreshResponseSchema.safeParse((json as { data?: unknown } | null)?.data);
    if (!parsed.success) {
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
  credentials?: 'include';
}

// Only these two routes read the refresh cookie; retrying them on a 401
// would either loop forever or paper over a genuine login failure.
const NO_RETRY_PATHS = new Set(['/auth/refresh', '/auth/login']);

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
      credentials: options.credentials,
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
