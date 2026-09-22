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

  // index.css's :root block only ever defined the light values as static
  // CSS — every component styled with var(--surface) etc. had no way to
  // actually go dark no matter what this context computed. Pushing the
  // active Palette onto the root element's own inline custom properties
  // (which win over the static :root declaration) is what actually makes
  // the whole app's existing CSS respond, with no per-component changes.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand-400', colors.brand400);
    root.style.setProperty('--brand-500', colors.brand500);
    root.style.setProperty('--brand-600', colors.brand600);
    root.style.setProperty('--brand-700', colors.brand700);
    root.style.setProperty('--gold-500', colors.gold500);
    root.style.setProperty('--gold-600', colors.gold600);
    root.style.setProperty('--background', colors.background);
    root.style.setProperty('--surface', colors.surface);
    root.style.setProperty('--text-primary', colors.textPrimary);
    root.style.setProperty('--text-muted', colors.textMuted);
    root.style.setProperty('--hairline', colors.hairline);
    root.style.setProperty('--tint1', colors.tint1);
    root.style.setProperty('--tint2', colors.tint2);
    root.dataset.theme = scheme;
  }, [colors, scheme]);

  const value = useMemo<ThemeState>(() => ({ colors, scheme, preference, setPreference }), [colors, scheme, preference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
