import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('./check-token-literals.mjs', import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

let tempDir: string | undefined;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

function runAgainst(srcDir: string) {
  return execFileSync('node', [SCRIPT], {
    env: { ...process.env, TOKEN_CHECK_SRC_DIR: srcDir },
    encoding: 'utf8',
  });
}

describe('check-token-literals', () => {
  it('fails on a raw hex colour outside a border rule', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'token-check-'));
    const uiDir = join(tempDir, 'ui');
    mkdirSync(uiDir);
    writeFileSync(join(uiDir, 'Button.module.css'), '.button { color: #ff0000; }\n');

    expect(() => runAgainst(tempDir!)).toThrow();
  });

  it('fails on a raw px value outside a border rule', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'token-check-'));
    const domainDir = join(tempDir, 'domain');
    mkdirSync(domainDir);
    writeFileSync(join(domainDir, 'Chain.module.css'), '.row { padding: 12px; }\n');

    expect(() => runAgainst(tempDir!)).toThrow();
  });

  it('allows a literal border-width', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'token-check-'));
    const routesDir = join(tempDir, 'routes');
    mkdirSync(routesDir);
    writeFileSync(join(routesDir, 'page.module.css'), '.card { border: 1px solid var(--rule); }\n');

    expect(() => runAgainst(tempDir!)).not.toThrow();
  });

  it('allows a literal directional border', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'token-check-'));
    const appDir = join(tempDir, 'app');
    mkdirSync(appDir);
    writeFileSync(
      join(appDir, 'rulebox.module.css'),
      '.rulebox { border-inline-start: 2px solid var(--index); }\n',
    );

    expect(() => runAgainst(tempDir!)).not.toThrow();
  });
});
