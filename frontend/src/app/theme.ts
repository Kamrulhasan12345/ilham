export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'ilham-theme';

export function getStoredTheme(): Theme | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === 'light' || raw === 'dark' ? raw : null;
  } catch {
    return null;
  }
}

export function setStoredTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Site data blocked or storage full — theme choice just won't persist.
  }
}

// Drives both systems while the rewrite is in flight: the `.dark` class for
// shadcn/Tailwind, and `data-theme` for the legacy tokens.css variables.
export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.dataset.theme = theme;
  try {
    document.documentElement.style.colorScheme = theme;
  } catch {
    // Headless DOM without style support — the class and attribute stand.
  }
}

export function detectSystemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
