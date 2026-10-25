import { useCallback, useMemo } from 'react';
import { rememberNext } from '../routes/next';
import { reasonFor, type AuthResult } from './AuthProvider';
import type { Repo } from './repo';
import { readStoredTheme } from './theme';
import type { Profile, ProfilePatch, ThemePreference } from './types';
import { useAccountData, type Accounts, type LoadStatus, type MakeRepo } from './useAccountData';

export interface ProfileApi {
  status: LoadStatus;
  profile: Profile | null;
  /** Saves the name and home location; resolves false if the change didn't stick. */
  save: (patch: ProfilePatch) => Promise<boolean>;
  saveTheme: (theme: ThemePreference) => Promise<boolean>;
  /** Emails a confirmation link to the new address (spec 005 US4 scenario 3). */
  changeEmail: (email: string) => Promise<AuthResult>;
  /** Everything stored about the user, as JSON (spec 005 US7). */
  exportData: () => Promise<{ ok: true; data: unknown } | { ok: false }>;
  /** Permanently deletes the account; the caller then signs out. */
  deleteAccount: (confirmEmail: string) => Promise<'deleted' | 'mismatch' | 'failed'>;
  reload: () => void;
}

/**
 * Loads the profile. An account still on the default theme takes this
 * device's explicit choice, so picking Dark and then signing up keeps Dark;
 * otherwise the account's theme wins (spec 005 US5 scenarios 3 and 5).
 */
async function loadProfile(repo: Repo, userId: string): Promise<Profile> {
  const profile = await repo.getProfile(userId);
  const device = readStoredTheme();
  if (profile.theme !== 'system' || device === 'system') return profile;
  try {
    await repo.updateTheme(userId, device);
    return { ...profile, theme: device };
  } catch {
    return profile;
  }
}

export function useProfileState(
  userId: string | null,
  accounts: Accounts,
  makeRepo: MakeRepo,
): ProfileApi {
  const { status, data, ready, reload, optimistic } = useAccountData(
    userId,
    accounts,
    makeRepo,
    loadProfile,
  );

  const save = useCallback(
    async (patch: ProfilePatch) => {
      if (!userId || !data) return false;
      const { displayName, home } = data;
      return optimistic(
        (p) => ({ ...p, ...patch }),
        (p) => ({ ...p, displayName, home }),
        (r) => r.updateProfile(userId, patch),
      );
    },
    [userId, data, optimistic],
  );

  const saveTheme = useCallback(
    async (theme: ThemePreference) => {
      if (!userId || !data) return false;
      const previous = data.theme;
      return optimistic(
        (p) => ({ ...p, theme }),
        (p) => ({ ...p, theme: previous }),
        (r) => r.updateTheme(userId, theme),
      );
    },
    [userId, data, optimistic],
  );

  const changeEmail = useCallback(
    async (email: string): Promise<AuthResult> => {
      const r = (await ready())?.repo;
      if (!r) return { ok: false, reason: 'unavailable' };
      rememberNext('/settings'); // the confirmation link lands on the auth callback
      try {
        await r.changeEmail(email.trim().toLowerCase(), `${window.location.origin}/auth/callback`);
        return { ok: true };
      } catch (error) {
        return { ok: false, reason: reasonFor(error) };
      }
    },
    [ready],
  );

  const exportData = useCallback(async () => {
    const r = (await ready())?.repo;
    if (!r) return { ok: false as const };
    try {
      return { ok: true as const, data: await r.exportData() };
    } catch {
      return { ok: false as const };
    }
  }, [ready]);

  const deleteAccount = useCallback(
    async (confirmEmail: string) => {
      const r = (await ready())?.repo;
      if (!r) return 'failed' as const;
      try {
        return await r.deleteAccount(confirmEmail);
      } catch {
        return 'failed' as const;
      }
    },
    [ready],
  );

  return useMemo(
    () => ({
      status,
      profile: data,
      save,
      saveTheme,
      changeEmail,
      exportData,
      deleteAccount,
      reload,
    }),
    [status, data, save, saveTheme, changeEmail, exportData, deleteAccount, reload],
  );
}
