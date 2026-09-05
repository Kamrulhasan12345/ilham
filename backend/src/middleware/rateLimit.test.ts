import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { Context } from 'hono';
import { resolveClientKey } from './rateLimit.js';

// resolveClientKey only ever touches `c.req.header` and `c.env`, so a
// minimal fake stands in for a real Hono Context. `env` mirrors what
// @hono/node-server puts there for a live request: c.env.incoming.socket.
// Omitting `remoteAddress` reproduces what happens under Hono's in-process
// `app.request()` test helper, which never opens a real socket.
function fakeContext(opts: { remoteAddress?: string; xff?: string }): Context {
  return {
    req: {
      header: (name: string) => (name.toLowerCase() === 'x-forwarded-for' ? opts.xff : undefined),
    },
    env: opts.remoteAddress
      ? { incoming: { socket: { remoteAddress: opts.remoteAddress, remotePort: 0, remoteFamily: 'IPv4' } } }
      : undefined,
  } as unknown as Context;
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
      const keyA = resolveClientKey(fakeContext({ remoteAddress: '203.0.113.10' }));
      const keyB = resolveClientKey(fakeContext({ remoteAddress: '203.0.113.20' }));
      assert.notEqual(keyA, keyB);
    });
  });

  test('the same real connection address gets the same key twice', () => {
    withTrustProxy(undefined, () => {
      const keyA = resolveClientKey(fakeContext({ remoteAddress: '203.0.113.10' }));
      const keyB = resolveClientKey(fakeContext({ remoteAddress: '203.0.113.10' }));
      assert.equal(keyA, keyB);
    });
  });

  test('a spoofed X-Forwarded-For does not get a client its own bucket when TRUST_PROXY is off', () => {
    withTrustProxy(undefined, () => {
      // Same real connection, only the (untrusted) XFF header differs. If
      // XFF were honored here, an attacker could get a fresh bucket on every
      // request just by changing this header -- that is the original bug.
      const keyA = resolveClientKey(
        fakeContext({ remoteAddress: '203.0.113.10', xff: '1.1.1.1' }),
      );
      const keyB = resolveClientKey(
        fakeContext({ remoteAddress: '203.0.113.10', xff: '2.2.2.2' }),
      );
      assert.equal(keyA, keyB);
    });
  });

  test('when TRUST_PROXY is on, the rightmost XFF hop is used, not the client-supplied leftmost one', () => {
    withTrustProxy('1', () => {
      // "attacker-claimed, real-client-as-seen-by-our-proxy": our proxy
      // appends the right-hand entry itself, so a forged left-hand entry
      // must not change the key.
      const spoofedLeft = resolveClientKey(
        fakeContext({ remoteAddress: '203.0.113.10', xff: '9.9.9.9, 10.0.0.5' }),
      );
      const differentSpoofedLeft = resolveClientKey(
        fakeContext({ remoteAddress: '203.0.113.10', xff: '8.8.8.8, 10.0.0.5' }),
      );
      assert.equal(spoofedLeft, differentSpoofedLeft);

      const differentRealClient = resolveClientKey(
        fakeContext({ remoteAddress: '203.0.113.10', xff: '9.9.9.9, 10.0.0.6' }),
      );
      assert.notEqual(spoofedLeft, differentRealClient);
    });
  });

  test('with no determinable address at all, each call gets its own isolated key', () => {
    withTrustProxy(undefined, () => {
      const keyA = resolveClientKey(fakeContext({}));
      const keyB = resolveClientKey(fakeContext({}));
      // Never the same key: a shared constant fallback is exactly the bug
      // this replaces (one bucket that any client can exhaust for everyone).
      assert.notEqual(keyA, keyB);
    });
  });
});
