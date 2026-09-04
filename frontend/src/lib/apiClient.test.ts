import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, apiFetch, getAccessToken, setAccessToken } from './apiClient';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const collectionSchema = z.object({ collection_id: z.number(), slug: z.string() });

describe('apiFetch', () => {
  beforeEach(() => {
    setAccessToken(null);
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses the data envelope through the given schema', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(200, { data: { collection_id: 1, slug: 'sahih-al-bukhari' } }),
    );
    const result = await apiFetch('/collections/1', collectionSchema);
    expect(result).toEqual({ collection_id: 1, slug: 'sahih-al-bukhari' });
  });

  it('sends the Authorization header when an access token is set', async () => {
    setAccessToken('abc123');
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(200, { data: { collection_id: 1, slug: 'x' } }),
    );
    await apiFetch('/collections/1', collectionSchema);
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer abc123');
  });

  it('throws ApiError with the server code and message on a non-2xx response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(404, { error: { code: 'not_found', message: 'hadith not found' } }),
    );
    await expect(apiFetch('/hadiths/999999', collectionSchema)).rejects.toMatchObject({
      status: 404,
      code: 'not_found',
      message: 'hadith not found',
    });
  });

  it('throws a contract_error ApiError when the payload does not match the schema', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, { data: { wrong: 'shape' } }));
    await expect(apiFetch('/collections/1', collectionSchema)).rejects.toMatchObject({
      code: 'contract_error',
    });
  });

  it('refreshes once and retries the original request on a 401', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse(401, { error: { code: 'unauthenticated', message: 'expired' } }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { data: { accessToken: 'new-token' } }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { collection_id: 1, slug: 'x' } }));

    const result = await apiFetch('/collections/1', collectionSchema);

    expect(result).toEqual({ collection_id: 1, slug: 'x' });
    expect(getAccessToken()).toBe('new-token');
    expect(fetch).toHaveBeenCalledTimes(3);
    const refreshCall = vi.mocked(fetch).mock.calls[1];
    expect(refreshCall[0]).toContain('/auth/refresh');
    expect(refreshCall[1]).toMatchObject({ credentials: 'include' });
  });

  it('never retries a 401 from /auth/refresh or /auth/login itself', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(401, { error: { code: 'unauthenticated', message: 'bad credentials' } }),
    );
    await expect(
      apiFetch('/auth/login', z.object({ accessToken: z.string() }), {
        method: 'POST',
        body: { email: 'a@example.com', password: 'wrong' },
      }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('runs exactly one refresh for two concurrent 401s (single-flight)', async () => {
    let refreshCalls = 0;
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) {
        refreshCalls += 1;
        return jsonResponse(200, { data: { accessToken: 'new-token' } });
      }
      if (url.includes('/one') || url.includes('/two')) {
        // Every call to these two paths 401s until the token is refreshed.
        return getAccessToken() === 'new-token'
          ? jsonResponse(200, { data: { collection_id: 1, slug: url } })
          : jsonResponse(401, { error: { code: 'unauthenticated', message: 'expired' } });
      }
      throw new Error(`unexpected fetch to ${url}`);
    });

    const [a, b] = await Promise.all([
      apiFetch('/one', collectionSchema),
      apiFetch('/two', collectionSchema),
    ]);

    expect(a.slug).toContain('/one');
    expect(b.slug).toContain('/two');
    expect(refreshCalls).toBe(1);
  });
});
