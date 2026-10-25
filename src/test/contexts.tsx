import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { AuthContext, type AuthApi, type AuthState } from '../account/AuthProvider';
import {
  ContactContext,
  FamilyContext,
  ProfileContext,
  SavedContext,
  ThemeContext,
  type ContactApi,
  type FamilyApi,
  type ProfileApi,
  type SavedApi,
  type ThemeApi,
} from '../account/ProfileProvider';
import type { ContactPreference, ContactTopic, FamilyMember, Profile } from '../account/types';

export const signedIn = (email = 'sam@trips.test', id = 'user-1'): AuthState => ({
  status: 'signedIn',
  user: { id, email },
});

export const profile = (over: Partial<Profile> = {}): Profile => ({
  id: 'user-1',
  displayName: null,
  home: null,
  theme: 'system',
  ...over,
});

export const member = (over: Partial<FamilyMember> = {}): FamilyMember => ({
  id: 'm1',
  nickname: 'Sam',
  kind: 'adult',
  birth: null,
  sortOrder: 0,
  ...over,
});

export function authApi(state: AuthState, over: Partial<AuthApi> = {}): AuthApi {
  return {
    state,
    connect: vi.fn(async () => {}),
    sendCode: vi.fn(async () => ({ ok: true as const })),
    verifyCode: vi.fn(async () => ({ ok: true as const })),
    signOut: vi.fn(async () => {}),
    ...over,
  };
}

export function savedApi(over: Partial<SavedApi> = {}): SavedApi {
  return {
    persistent: true,
    status: 'ready',
    items: [],
    isSaved: () => false,
    toggle: vi.fn(async () => true),
    update: vi.fn(async () => true),
    remove: vi.fn(async () => true),
    reload: vi.fn(),
    ...over,
  };
}

export function profileApi(over: Partial<ProfileApi> = {}): ProfileApi {
  return {
    status: 'ready',
    profile: profile(),
    save: vi.fn(async () => true),
    saveTheme: vi.fn(async () => true),
    exportData: vi.fn(async () => ({ ok: true as const, data: { exportedAt: 'now' } })),
    deleteAccount: vi.fn(async () => 'deleted' as const),
    changeEmail: vi.fn(async () => ({ ok: true as const })),
    reload: vi.fn(),
    ...over,
  };
}

export function familyApi(over: Partial<FamilyApi> = {}): FamilyApi {
  return {
    status: 'ready',
    members: [],
    add: vi.fn(async () => true),
    update: vi.fn(async () => true),
    remove: vi.fn(async () => true),
    move: vi.fn(async () => true),
    reload: vi.fn(),
    ...over,
  };
}

export function themeApi(over: Partial<ThemeApi> = {}): ThemeApi {
  return { preference: 'system', setPreference: vi.fn(async () => true), ...over };
}

const off = (topic: ContactTopic): ContactPreference => ({
  topic,
  optedIn: false,
  frequency: null,
  changedAt: null,
});

export function contactApi(
  over: Partial<ContactApi> & { prefs?: ContactPreference[] } = {},
): ContactApi {
  const { prefs = [], ...rest } = over;
  return {
    status: 'ready',
    get: (topic) => prefs.find((p) => p.topic === topic) ?? off(topic),
    set: vi.fn(async () => true),
    reload: vi.fn(),
    ...rest,
  };
}

/** Renders `ui` inside the account contexts, with fakes for anything not given. */
export function renderWithAccount(
  ui: ReactElement,
  {
    auth = signedIn(),
    saved = {},
    profile: prof = {},
    family = {},
    theme = {},
    contact = {},
  }: {
    auth?: AuthState;
    saved?: Partial<SavedApi>;
    profile?: Partial<ProfileApi>;
    family?: Partial<FamilyApi>;
    theme?: Partial<ThemeApi>;
    contact?: Parameters<typeof contactApi>[0];
  } = {},
) {
  const apis = {
    auth: authApi(auth),
    saved: savedApi(saved),
    profile: profileApi(prof),
    family: familyApi(family),
    theme: themeApi(theme),
    contact: contactApi(contact),
  };
  const view = render(
    <AuthContext.Provider value={apis.auth}>
      <ProfileContext.Provider value={apis.profile}>
        <FamilyContext.Provider value={apis.family}>
          <ThemeContext.Provider value={apis.theme}>
            <ContactContext.Provider value={apis.contact}>
              <SavedContext.Provider value={apis.saved}>{ui}</SavedContext.Provider>
            </ContactContext.Provider>
          </ThemeContext.Provider>
        </FamilyContext.Provider>
      </ProfileContext.Provider>
    </AuthContext.Provider>,
  );
  return { ...apis, ...view };
}
