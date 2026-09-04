import { useState } from 'react';
import styles from './ThemeSwitch.module.css';
import { type Theme, applyTheme, detectSystemTheme, getStoredTheme, setStoredTheme } from './theme';

export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme() ?? detectSystemTheme());

  function choose(next: Theme) {
    setTheme(next);
    setStoredTheme(next);
    applyTheme(next);
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: Test requires role="group" for accessibility testing
    <div className={styles.seg} role="group" aria-label="Ground">
      <button type="button" aria-pressed={theme === 'light'} onClick={() => choose('light')}>
        1c
      </button>
      <button type="button" aria-pressed={theme === 'dark'} onClick={() => choose('dark')}>
        2a
      </button>
    </div>
  );
}
