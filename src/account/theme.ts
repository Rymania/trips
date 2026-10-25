import type { ThemePreference } from './types';

/**
 * Theme preference on this device (spec 005 US5). The inline script in
 * index.html reads the same key before first paint (research R5), so keep the
 * two in step.
 */
export const THEME_KEY = 'trips.theme';

/** The browser UI colour for each theme: the Terra `--bg` token. */
const THEME_COLOR = { light: '#faf6f0', dark: '#1d1f1b' } as const;

const PREFERENCES: readonly string[] = ['system', 'light', 'dark'];
const isPreference = (v: unknown): v is ThemePreference =>
  typeof v === 'string' && PREFERENCES.includes(v);

export function resolveTheme(pref: ThemePreference, prefersDark: boolean): 'light' | 'dark' {
  if (pref !== 'system') return pref;
  return prefersDark ? 'dark' : 'light';
}

export function readStoredTheme(
  storage: Pick<Storage, 'getItem'> = window.localStorage,
): ThemePreference {
  try {
    const value = storage.getItem(THEME_KEY);
    return isPreference(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

export function storeTheme(
  pref: ThemePreference,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
) {
  try {
    storage.setItem(THEME_KEY, pref);
  } catch {
    /* storage unavailable: the choice lasts until the page closes */
  }
}

const deviceIsDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

/** Sets `data-theme` (or clears it for "system") and the browser UI colour. */
export function applyTheme(pref: ThemePreference, prefersDark = deviceIsDark()) {
  const root = document.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.dataset.theme = pref;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLOR[resolveTheme(pref, prefersDark)]);
}
