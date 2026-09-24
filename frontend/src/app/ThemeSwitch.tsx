import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { type Theme, applyTheme, detectSystemTheme, getStoredTheme, setStoredTheme } from './theme';

export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>(() => {
    const initial = getStoredTheme() ?? detectSystemTheme();
    applyTheme(initial);
    return initial;
  });

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setStoredTheme(next);
    applyTheme(next);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-pressed={theme === 'dark'}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  );
}
