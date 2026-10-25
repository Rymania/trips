import { useCallback, useMemo } from 'react';
import { rememberNext } from '../routes/next';
import { reasonFor, type AuthResult } from './AuthProvider';
import type { Repo } from './repo';
import type { Profile, ProfilePatch } from './types';
import { useAccountData, type Accounts, type LoadStatus, type MakeRepo } from './useAccountData';

export interface ProfileApi {
  status: LoadStatus;
  profile: Profile | null;
  /** Saves the name and home location; resolves false if the change didn't stick. */
  save: (patch: ProfilePatch) => Promise<boolean>;
  /** Emails a confirmation link to the new address (spec 005 US4 scenario 3). */
  changeEmail: (email: string) => Promise<AuthResult>;
  reload: () => void;
}

const loadProfile = (repo: Repo, userId: string) => repo.getProfile(userId);

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

  return useMemo(
    () => ({ status, profile: data, save, changeEmail, reload }),
    [status, data, save, changeEmail, reload],
  );
}
