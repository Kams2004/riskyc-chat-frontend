import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { darkPalette, lightPalette, type Palette } from './theme';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemeState = {
  colors: Palette;
  scheme: 'light' | 'dark';
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const PREFERENCE_KEY = 'riskyc.themePreference';
const ThemeContext = createContext<ThemeState | null>(null);

function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(PREFERENCE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // Storage may be unavailable (private mode, disabled cookies) — fall through to the default.
  }
  return 'system';
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [systemScheme, setSystemScheme] = useState<'light' | 'dark'>(() =>
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemScheme(media.matches ? 'dark' : 'light');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  function setPreference(next: ThemePreference) {
    setPreferenceState(next);
    try {
      localStorage.setItem(PREFERENCE_KEY, next);
    } catch {
      // Best-effort persistence only — a per-viewer convenience, not required for the app to function.
    }
  }

  const scheme: 'light' | 'dark' = preference === 'system' ? systemScheme : preference;
  const colors = scheme === 'dark' ? darkPalette : lightPalette;

  const value = useMemo<ThemeState>(() => ({ colors, scheme, preference, setPreference }), [colors, scheme, preference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
