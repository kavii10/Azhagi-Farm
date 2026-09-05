import { useState, useEffect } from 'react';

export type Theme = 'light' | 'dark';

const THEME_KEY = 'azhagi_theme';

export function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  localStorage.setItem(THEME_KEY, theme);
}

export function initTheme() {
  const t = getInitialTheme();
  applyTheme(t);
  return t;
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return { theme, toggleTheme, isDark: theme === 'dark' };
}
