import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyTheme, getStoredTheme, setStoredTheme } from './theme';

describe('theme storage', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('returns null when nothing is stored', () => {
    expect(getStoredTheme()).toBeNull();
  });

  it('round-trips a stored theme', () => {
    setStoredTheme('dark');
    expect(getStoredTheme()).toBe('dark');
  });

  it('ignores a corrupted stored value', () => {
    window.localStorage.setItem('ilham-theme', 'sepia');
    expect(getStoredTheme()).toBeNull();
  });

  it('applyTheme sets data-theme on the document element', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
