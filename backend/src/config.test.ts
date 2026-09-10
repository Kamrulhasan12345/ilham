import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

// config.ts reads process.env once, at import, and throws there when a
// combination cannot work. The guard is therefore about whether the PROCESS
// starts, so each case runs in a child process with its own environment.
// Re-importing the module in this one would only return the cached copy.
const CONFIG = fileURLToPath(new URL('./config.ts', import.meta.url));

const VALID_SECRET = 'x'.repeat(32);

interface LoadResult {
  ok: boolean;
  stderr: string;
}

function loadConfigWith(env: Record<string, string | undefined>): LoadResult {
  try {
    execFileSync(process.execPath, ['--import', 'tsx', '-e', `import(${JSON.stringify(CONFIG)})`], {
      env: { ...process.env, JWT_SECRET: VALID_SECRET, NODE_ENV: '', ...env },
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return { ok: true, stderr: '' };
  } catch (error) {
    const err = error as { stderr?: string };
    return { ok: false, stderr: err.stderr ?? '' };
  }
}

describe('config: the refresh cookie and the allowed origins', () => {
  test('the defaults load, and suit a same-origin deployment', () => {
    const result = loadConfigWith({});
    assert.equal(result.ok, true, result.stderr);
  });

  test('SameSite=None is refused over plain http, which a browser drops in silence', () => {
    // The trap this guards: a Secure cookie is never returned to an http://
    // origin, so login looks fine and the next refresh signs the user out with
    // nothing in the console to explain it.
    const result = loadConfigWith({
      COOKIE_SAMESITE: 'None',
      WEB_ORIGIN: 'http://app.example.com',
    });
    assert.equal(result.ok, false);
    assert.match(result.stderr, /Secure cookie/);
  });

  test('SameSite=None is accepted over https, which is the static-host case', () => {
    const result = loadConfigWith({
      COOKIE_SAMESITE: 'None',
      WEB_ORIGIN: 'https://app.example.com',
    });
    assert.equal(result.ok, true, result.stderr);
  });

  test('an unknown SameSite is refused rather than passed to the browser', () => {
    const result = loadConfigWith({ COOKIE_SAMESITE: 'Yes' });
    assert.equal(result.ok, false);
    assert.match(result.stderr, /COOKIE_SAMESITE must be/);
  });

  test('WEB_ORIGIN takes a comma-separated list, for preview deployments', () => {
    const result = loadConfigWith({
      WEB_ORIGIN: 'https://app.example.com, https://preview.example.com/',
    });
    assert.equal(result.ok, true, result.stderr);
  });

  test('an empty WEB_ORIGIN is refused, because it would allow no origin at all', () => {
    const result = loadConfigWith({ WEB_ORIGIN: ' , ' });
    assert.equal(result.ok, false);
    assert.match(result.stderr, /at least one browser origin/);
  });
});
