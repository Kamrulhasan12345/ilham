import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { Request } from 'express';
import { resolveClientKey } from './rateLimit.js';

// resolveClientKey only ever touches `req.get` and `req.socket.remoteAddress`,
// so a minimal fake stands in for a real Express Request. Omitting
// `remoteAddress` reproduces what happens under a test harness that never
// opens a real socket (e.g. supertest against an in-process app).
function fakeRequest(opts: { remoteAddress?: string; xff?: string }): Request {
  return {
    get: (name: string) => (name.toLowerCase() === 'x-forwarded-for' ? opts.xff : undefined),
    socket: { remoteAddress: opts.remoteAddress },
  } as unknown as Request;
}

function withTrustProxy<T>(value: string | undefined, fn: () => T): T {
  const previous = process.env.TRUST_PROXY;
  if (value === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = value;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = previous;
  }
}

describe('resolveClientKey', () => {
  test('two different real connection addresses get independent keys', () => {
    withTrustProxy(undefined, () => {
      const keyA = resolveClientKey(fakeRequest({ remoteAddress: '203.0.113.10' }));
      const keyB = resolveClientKey(fakeRequest({ remoteAddress: '203.0.113.20' }));
      assert.notEqual(keyA, keyB);
    });
  });

  test('the same real connection address gets the same key twice', () => {
    withTrustProxy(undefined, () => {
      const keyA = resolveClientKey(fakeRequest({ remoteAddress: '203.0.113.10' }));
      const keyB = resolveClientKey(fakeRequest({ remoteAddress: '203.0.113.10' }));
      assert.equal(keyA, keyB);
    });
  });

  test('a spoofed X-Forwarded-For does not get a client its own bucket when TRUST_PROXY is off', () => {
    withTrustProxy(undefined, () => {
      // Same real connection, only the (untrusted) XFF header differs. If
      // XFF were honored here, an attacker could get a fresh bucket on every
      // request just by changing this header -- that is the original bug.
      const keyA = resolveClientKey(fakeRequest({ remoteAddress: '203.0.113.10', xff: '1.1.1.1' }));
      const keyB = resolveClientKey(fakeRequest({ remoteAddress: '203.0.113.10', xff: '2.2.2.2' }));
      assert.equal(keyA, keyB);
    });
  });

  test('when TRUST_PROXY is on, the rightmost XFF hop is used, not the client-supplied leftmost one', () => {
    withTrustProxy('1', () => {
      // "attacker-claimed, real-client-as-seen-by-our-proxy": our proxy
      // appends the right-hand entry itself, so a forged left-hand entry
      // must not change the key.
      const spoofedLeft = resolveClientKey(
        fakeRequest({ remoteAddress: '203.0.113.10', xff: '9.9.9.9, 10.0.0.5' }),
      );
      const differentSpoofedLeft = resolveClientKey(
        fakeRequest({ remoteAddress: '203.0.113.10', xff: '8.8.8.8, 10.0.0.5' }),
      );
      assert.equal(spoofedLeft, differentSpoofedLeft);

      const differentRealClient = resolveClientKey(
        fakeRequest({ remoteAddress: '203.0.113.10', xff: '9.9.9.9, 10.0.0.6' }),
      );
      assert.notEqual(spoofedLeft, differentRealClient);
    });
  });

  test('with no determinable address at all, each call gets its own isolated key', () => {
    withTrustProxy(undefined, () => {
      const keyA = resolveClientKey(fakeRequest({}));
      const keyB = resolveClientKey(fakeRequest({}));
      // Never the same key: a shared constant fallback is exactly the bug
      // this replaces (one bucket that any client can exhaust for everyone).
      assert.notEqual(keyA, keyB);
    });
  });
});
