import { useCallback, useEffect, useMemo, useState } from 'react';
import { applyTheme, readStoredTheme, storeTheme } from './theme';
import type { ThemePreference } from './types';
import type { ProfileApi } from './useProfileState';

export interface ThemeApi {
  preference: ThemePreference;
  /** Applies at once; resolves false if it couldn't be saved to the account. */
  setPreference: (pref: ThemePreference) => Promise<boolean>;
}

/**
 * The theme: kept on this device, and on the account when signed in, where
 * the account's choice wins whenever the profile loads (spec 005 FR-010).
 */
export function useThemeState({ profile, saveTheme }: ProfileApi): ThemeApi {
  const [preference, setLocal] = useState<ThemePreference>(readStoredTheme);

  // Follow the account's theme when it loads or changes, including a rollback.
  const accountTheme = profile?.theme;
  const [seen, setSeen] = useState(accountTheme);
  if (accountTheme !== seen) {
    setSeen(accountTheme);
    if (accountTheme) setLocal(accountTheme);
  }

  // Writing to localStorage too means the next page load paints correctly at once.
  useEffect(() => {
    applyTheme(preference);
    storeTheme(preference);
  }, [preference]);

  const setPreference = useCallback(
    async (pref: ThemePreference) => {
      const previous = preference;
      setLocal(pref);
      if (!profile) return true;
      const ok = await saveTheme(pref);
      if (!ok) setLocal(previous);
      return ok;
    },
    [preference, profile, saveTheme],
  );

  return useMemo(() => ({ preference, setPreference }), [preference, setPreference]);
}
