import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { accounts as defaultAccounts } from './client';
import { createRepo } from './repo';
import type { Accounts, MakeRepo } from './useAccountData';
import { useFamilyState, type FamilyApi } from './useFamilyState';
import { useProfileState, type ProfileApi } from './useProfileState';
import { useSavedTrips, type SavedApi } from './useSavedTrips';

export type { FamilyApi, ProfileApi, SavedApi };

export const ProfileContext = createContext<ProfileApi | null>(null);
export const FamilyContext = createContext<FamilyApi | null>(null);
export const SavedContext = createContext<SavedApi | null>(null);

export function useProfile(): ProfileApi {
  const api = useContext(ProfileContext);
  if (!api) throw new Error('useProfile must be used inside <ProfileProvider>');
  return api;
}

export function useFamily(): FamilyApi {
  const api = useContext(FamilyContext);
  if (!api) throw new Error('useFamily must be used inside <ProfileProvider>');
  return api;
}

export function useSaved(): SavedApi {
  const api = useContext(SavedContext);
  if (!api) throw new Error('useSaved must be used inside <ProfileProvider>');
  return api;
}

/** The signed-in user's account data: profile, family and saved trips. */
export function ProfileProvider({
  accounts = defaultAccounts,
  makeRepo = createRepo,
  children,
}: {
  accounts?: Accounts;
  makeRepo?: MakeRepo;
  children: ReactNode;
}) {
  const { state } = useAuth();
  const userId = state.status === 'signedIn' ? state.user.id : null;
  const profile = useProfileState(userId, accounts, makeRepo);
  const family = useFamilyState(userId, accounts, makeRepo);
  const saved = useSavedTrips(userId, accounts, makeRepo);
  return (
    <ProfileContext.Provider value={profile}>
      <FamilyContext.Provider value={family}>
        <SavedContext.Provider value={saved}>{children}</SavedContext.Provider>
      </FamilyContext.Provider>
    </ProfileContext.Provider>
  );
}
