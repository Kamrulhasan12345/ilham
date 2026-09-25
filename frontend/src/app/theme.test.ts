import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyTheme, getStoredTheme, setStoredTheme } from './theme';

describe('theme storage', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
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

  it('applyTheme toggles the dark class on the document element', () => {
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
