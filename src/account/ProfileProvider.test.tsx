import { act, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeAccounts } from '../test/fakeAuthClient';
import { AuthContext, type AuthApi, type AuthState } from './AuthProvider';
import type { TripsClient } from './client';
import {
  ProfileProvider,
  useFamily,
  useProfile,
  useSaved,
  useTheme,
  type FamilyApi,
  type ProfileApi,
  type SavedApi,
  type ThemeApi,
} from './ProfileProvider';
import type { Repo } from './repo';
import type { FamilyMember, Profile, SavedTrip } from './types';

const trip = (id: string, over: Partial<SavedTrip> = {}): SavedTrip => ({
  activityId: id,
  activityName: `Activity ${id}`,
  savedAt: '2026-10-01T10:00:00.000Z',
  plannedFor: null,
  note: null,
  ...over,
});

const PROFILE: Profile = { id: 'user-1', displayName: 'Sam', home: null, theme: 'system' };

const member = (id: string, sortOrder: number, over: Partial<FamilyMember> = {}): FamilyMember => ({
  id,
  nickname: `Member ${id}`,
  kind: 'adult',
  birth: null,
  sortOrder,
  ...over,
});

function fakeRepo(
  initial: SavedTrip[] = [],
  profile: Profile = PROFILE,
  family: FamilyMember[] = [],
) {
  return {
    listFamily: vi.fn(async () => family),
    addMember: vi.fn(
      async (_p: string, m: Pick<FamilyMember, 'nickname' | 'kind' | 'birth'>, sortOrder: number) =>
        member('new', sortOrder, m),
    ),
    updateMember: vi.fn(async () => {}),
    removeMember: vi.fn(async () => {}),
    reorderFamily: vi.fn(async () => {}),
    getProfile: vi.fn(async () => profile),
    updateProfile: vi.fn(async () => {}),
    updateTheme: vi.fn(async () => {}),
    changeEmail: vi.fn(async () => {}),
    listSaved: vi.fn(async () => initial),
    addSaved: vi.fn(async () => {}),
    updateSaved: vi.fn(async () => {}),
    removeSaved: vi.fn(async () => {}),
  } satisfies Repo;
}

const ANON: AuthState = { status: 'anonymous' };
const SIGNED_IN: AuthState = {
  status: 'signedIn',
  user: { id: 'user-1', email: 'sam@trips.test' },
};

let api!: SavedApi;
let profileApi!: ProfileApi;
let familyApi!: FamilyApi;
let themeApi!: ThemeApi;
function Probe() {
  const value = useSaved();
  const prof = useProfile();
  const fam = useFamily();
  const theme = useTheme();
  useEffect(() => {
    api = value;
    profileApi = prof;
    familyApi = fam;
    themeApi = theme;
  });
  return null;
}

function setup(
  state: AuthState,
  repo = fakeRepo(),
  client: TripsClient | null = {} as TripsClient,
) {
  const accounts = fakeAccounts(client);
  const makeRepo = vi.fn(() => repo);
  const ui = (s: AuthState) => {
    const auth: AuthApi = {
      state: s,
      connect: vi.fn(),
      sendCode: vi.fn(),
      verifyCode: vi.fn(),
      signOut: vi.fn(),
    };
    return (
      <AuthContext.Provider value={auth}>
        <ProfileProvider accounts={accounts} makeRepo={makeRepo}>
          <Probe />
        </ProfileProvider>
      </AuthContext.Provider>
    );
  };
  const view = render(ui(state));
  return { repo, makeRepo, rerender: (s: AuthState) => view.rerender(ui(s)) };
}

const ids = () => api.items.map((i) => i.activityId).sort();

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe('ProfileProvider: saved trips', () => {
  it('keeps anonymous saves in sessionStorage', async () => {
    const { makeRepo } = setup(ANON);
    expect(api.persistent).toBe(false);
    expect(api.status).toBe('idle');

    await act(() => api.toggle({ id: 'a', name: 'Aye' }));
    expect(api.isSaved('a')).toBe(true);
    expect(JSON.parse(sessionStorage.getItem('saved') ?? '[]')).toEqual([
      { activityId: 'a', activityName: 'Aye' },
    ]);

    await act(() => api.toggle({ id: 'a', name: 'Aye' }));
    expect(api.isSaved('a')).toBe(false);
    expect(makeRepo).not.toHaveBeenCalled();
  });

  it('merges the session’s saves into the account on sign-in, then clears them', async () => {
    sessionStorage.setItem('saved', JSON.stringify([{ activityId: 'a', activityName: 'Aye' }]));
    const { repo } = setup(SIGNED_IN, fakeRepo([trip('b')]));
    expect(api.status).toBe('loading');

    await waitFor(() => expect(api.status).toBe('ready'));
    expect(repo.addSaved).toHaveBeenCalledWith('user-1', [
      { activityId: 'a', activityName: 'Aye' },
    ]);
    expect(ids()).toEqual(['a', 'b']);
    expect(api.persistent).toBe(true);
    expect(api.isSaved('a')).toBe(true);
    expect(sessionStorage.getItem('saved')).toBeNull();
  });

  it('keeps the session’s saves when merging fails, and retries on reload', async () => {
    sessionStorage.setItem('saved', JSON.stringify([{ activityId: 'a', activityName: 'Aye' }]));
    const repo = fakeRepo();
    repo.addSaved.mockRejectedValueOnce(new Error('offline'));
    setup(SIGNED_IN, repo);

    await waitFor(() => expect(api.status).toBe('error'));
    expect(sessionStorage.getItem('saved')).not.toBeNull();

    act(() => api.reload());
    await waitFor(() => expect(api.status).toBe('ready'));
    expect(repo.addSaved).toHaveBeenCalledTimes(2);
    expect(sessionStorage.getItem('saved')).toBeNull();
  });

  it('reports an error when accounts are unavailable', async () => {
    setup(SIGNED_IN, fakeRepo(), null);
    await waitFor(() => expect(api.status).toBe('error'));
  });

  it('saves to the account straight away and rolls back on failure', async () => {
    const { repo } = setup(SIGNED_IN);
    await waitFor(() => expect(api.status).toBe('ready'));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await api.toggle({ id: 'a', name: 'Aye' });
    });
    expect(ok).toBe(true);
    expect(repo.addSaved).toHaveBeenLastCalledWith('user-1', [
      expect.objectContaining({ activityId: 'a', activityName: 'Aye' }),
    ]);
    expect(api.isSaved('a')).toBe(true);

    repo.addSaved.mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      ok = await api.toggle({ id: 'b', name: 'Bee' });
    });
    expect(ok).toBe(false);
    expect(api.isSaved('b')).toBe(false);
  });

  it('saves made while the list is still loading wait for it, without duplicates', async () => {
    let finish!: (trips: SavedTrip[]) => void;
    const repo = fakeRepo();
    repo.listSaved.mockReturnValueOnce(new Promise((r) => (finish = r)));
    setup(SIGNED_IN, repo);
    expect(api.status).toBe('loading');

    let saving!: Promise<boolean>;
    act(() => {
      saving = api.toggle({ id: 'a', name: 'Aye' });
    });
    await act(async () => finish([trip('a')]));
    expect(await saving).toBe(true);
    expect(repo.addSaved).toHaveBeenCalledWith('user-1', [
      { activityId: 'a', activityName: 'Aye' },
    ]);
    expect(api.items.map((i) => i.activityId)).toEqual(['a']);
  });

  it('toggling a saved activity removes it from the account', async () => {
    const { repo } = setup(SIGNED_IN, fakeRepo([trip('a')]));
    await waitFor(() => expect(api.status).toBe('ready'));
    await act(() => api.toggle({ id: 'a', name: 'Aye' }));
    expect(repo.removeSaved).toHaveBeenCalledWith('user-1', 'a');
    expect(api.isSaved('a')).toBe(false);
  });

  it('updates and removes, restoring the previous version on failure', async () => {
    const original = trip('a', { note: 'Old' });
    const { repo } = setup(SIGNED_IN, fakeRepo([original, trip('b')]));
    await waitFor(() => expect(api.status).toBe('ready'));

    await act(() => api.update('a', { plannedFor: '2026-11-01', note: 'New' }));
    expect(repo.updateSaved).toHaveBeenCalledWith('user-1', 'a', {
      plannedFor: '2026-11-01',
      note: 'New',
    });
    expect(api.items.find((i) => i.activityId === 'a')).toMatchObject({
      plannedFor: '2026-11-01',
      note: 'New',
    });

    repo.updateSaved.mockRejectedValueOnce(new Error('offline'));
    let ok: boolean | undefined;
    await act(async () => {
      ok = await api.update('a', { plannedFor: null, note: 'Lost' });
    });
    expect(ok).toBe(false);
    expect(api.items.find((i) => i.activityId === 'a')?.note).toBe('New');

    repo.removeSaved.mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      ok = await api.remove('b');
    });
    expect(ok).toBe(false);
    expect(ids()).toEqual(['a', 'b']);

    await act(async () => {
      ok = await api.remove('b');
    });
    expect(ok).toBe(true);
    expect(ids()).toEqual(['a']);
    expect(await api.remove('missing')).toBe(false);
    expect(await api.update('missing', { plannedFor: null, note: null })).toBe(false);
  });

  it('forgets the account’s trips on sign-out', async () => {
    const { rerender } = setup(SIGNED_IN, fakeRepo([trip('a')]));
    await waitFor(() => expect(api.isSaved('a')).toBe(true));
    rerender(ANON);
    expect(api.status).toBe('idle');
    expect(api.isSaved('a')).toBe(false);
    expect(api.items).toEqual([]);
  });

  it('throws when used outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/inside <ProfileProvider>/);
  });

  it('shows saves made after a failed merge once signed out again', async () => {
    sessionStorage.setItem('saved', JSON.stringify([{ activityId: 'a', activityName: 'Aye' }]));
    const repo = fakeRepo();
    repo.addSaved.mockRejectedValue(new Error('offline'));
    const { rerender } = setup(SIGNED_IN, repo);
    await waitFor(() => expect(api.status).toBe('error'));
    rerender(ANON);
    expect(api.isSaved('a')).toBe(true);
  });
});

describe('ProfileProvider: profile', () => {
  it('is idle when signed out', () => {
    setup(ANON);
    expect(profileApi.status).toBe('idle');
    expect(profileApi.profile).toBeNull();
  });

  it('loads the profile once signed in', async () => {
    const { repo } = setup(SIGNED_IN);
    await waitFor(() => expect(profileApi.status).toBe('ready'));
    expect(repo.getProfile).toHaveBeenCalledWith('user-1');
    expect(profileApi.profile?.displayName).toBe('Sam');
  });

  it('saves straight away and rolls back on failure', async () => {
    const { repo } = setup(SIGNED_IN);
    await waitFor(() => expect(profileApi.status).toBe('ready'));
    const home = { name: 'Brighton', lat: 50.8225, lng: -0.1372 };

    let ok: boolean | undefined;
    await act(async () => {
      ok = await profileApi.save({ displayName: 'Sammy', home });
    });
    expect(ok).toBe(true);
    expect(repo.updateProfile).toHaveBeenCalledWith('user-1', { displayName: 'Sammy', home });
    expect(profileApi.profile).toMatchObject({ displayName: 'Sammy', home });

    repo.updateProfile.mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      ok = await profileApi.save({ displayName: 'Lost', home: null });
    });
    expect(ok).toBe(false);
    expect(profileApi.profile).toMatchObject({ displayName: 'Sammy', home });
  });

  it('reports a load failure and retries', async () => {
    const repo = fakeRepo();
    repo.getProfile.mockRejectedValueOnce(new Error('offline'));
    setup(SIGNED_IN, repo);
    await waitFor(() => expect(profileApi.status).toBe('error'));
    act(() => profileApi.reload());
    await waitFor(() => expect(profileApi.status).toBe('ready'));
  });

  it('changes the email, returning to settings after confirming', async () => {
    const { repo } = setup(SIGNED_IN);
    await waitFor(() => expect(profileApi.status).toBe('ready'));
    expect(await profileApi.changeEmail(' New@Trips.test ')).toEqual({ ok: true });
    expect(repo.changeEmail).toHaveBeenCalledWith(
      'new@trips.test',
      `${window.location.origin}/auth/callback`,
    );
    expect(localStorage.getItem('trips.signInNext')).toBe('/settings');

    repo.changeEmail.mockRejectedValueOnce({ status: 429, code: 'over_email_send_rate_limit' });
    expect(await profileApi.changeEmail('x@trips.test')).toEqual({
      ok: false,
      reason: 'rateLimited',
    });
  });

  it('cannot change the email before the profile loads', async () => {
    setup(ANON);
    expect(await profileApi.changeEmail('x@trips.test')).toEqual({
      ok: false,
      reason: 'unavailable',
    });
    expect(await profileApi.save({ displayName: 'x', home: null })).toBe(false);
  });
});

describe('ProfileProvider: family', () => {
  const names = () => familyApi.members.map((m) => m.id);
  const ready = async (family: FamilyMember[]) => {
    const view = setup(SIGNED_IN, fakeRepo([], PROFILE, family));
    await waitFor(() => expect(familyApi.status).toBe('ready'));
    return view;
  };

  it('is idle and empty when signed out', () => {
    setup(ANON);
    expect(familyApi.status).toBe('idle');
    expect(familyApi.members).toEqual([]);
  });

  it('lists members by sort order', async () => {
    await ready([member('b', 1), member('a', 0)]);
    expect(names()).toEqual(['a', 'b']);
  });

  it('adds a member at the end once stored', async () => {
    const { repo } = await ready([member('a', 0), member('b', 5)]);
    let ok: boolean | undefined;
    await act(async () => {
      ok = await familyApi.add({ nickname: 'Rex', kind: 'dog', birth: null });
    });
    expect(ok).toBe(true);
    expect(repo.addMember).toHaveBeenCalledWith(
      'user-1',
      { nickname: 'Rex', kind: 'dog', birth: null },
      6,
    );
    expect(names()).toEqual(['a', 'b', 'new']);

    repo.addMember.mockRejectedValueOnce(new Error('limit'));
    await act(async () => {
      ok = await familyApi.add({ nickname: 'Too many', kind: 'adult', birth: null });
    });
    expect(ok).toBe(false);
    expect(names()).toEqual(['a', 'b', 'new']);
  });

  it('updates and removes, undoing failures', async () => {
    const { repo } = await ready([member('a', 0), member('b', 1)]);
    const rex = { nickname: 'Rex', kind: 'dog' as const, birth: null };
    await act(() => familyApi.update('a', rex));
    expect(repo.updateMember).toHaveBeenCalledWith('a', rex);
    expect(familyApi.members[0]).toMatchObject(rex);

    repo.updateMember.mockRejectedValueOnce(new Error('offline'));
    let ok: boolean | undefined;
    await act(async () => {
      ok = await familyApi.update('a', { nickname: 'Lost', kind: 'adult', birth: null });
    });
    expect(ok).toBe(false);
    expect(familyApi.members[0]).toMatchObject(rex);

    repo.removeMember.mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      ok = await familyApi.remove('b');
    });
    expect(ok).toBe(false);
    expect(names()).toEqual(['a', 'b']);

    await act(() => familyApi.remove('b'));
    expect(repo.removeMember).toHaveBeenCalledWith('b');
    expect(names()).toEqual(['a']);
    expect(await familyApi.update('missing', rex)).toBe(false);
    expect(await familyApi.remove('missing')).toBe(false);
  });

  it('moves a member by swapping places with its neighbour', async () => {
    const { repo } = await ready([member('a', 0), member('b', 1), member('c', 2)]);
    await act(() => familyApi.move('c', -1));
    expect(names()).toEqual(['a', 'c', 'b']);
    expect(repo.reorderFamily).toHaveBeenCalledWith([
      { id: 'c', sortOrder: 1 },
      { id: 'b', sortOrder: 2 },
    ]);

    repo.reorderFamily.mockRejectedValueOnce(new Error('offline'));
    let ok: boolean | undefined;
    await act(async () => {
      ok = await familyApi.move('a', 1);
    });
    expect(ok).toBe(false);
    expect(names()).toEqual(['a', 'c', 'b']);

    expect(await familyApi.move('a', -1)).toBe(false); // already first
    expect(await familyApi.move('b', 1)).toBe(false); // already last
  });

  it('adds a member while the family is still loading, once it has loaded', async () => {
    let finish!: (members: FamilyMember[]) => void;
    const repo = fakeRepo();
    repo.listFamily.mockReturnValueOnce(new Promise((r) => (finish = r)));
    setup(SIGNED_IN, repo);

    let adding!: Promise<boolean>;
    act(() => {
      adding = familyApi.add({ nickname: 'Rex', kind: 'dog', birth: null });
    });
    await act(async () => finish([member('a', 0)]));
    expect(await adding).toBe(true);
    expect(repo.addMember).toHaveBeenCalledWith('user-1', expect.anything(), 1);
  });

  it('cannot change anything before the family loads', async () => {
    setup(ANON);
    expect(await familyApi.add({ nickname: 'x', kind: 'adult', birth: null })).toBe(false);
  });
});

describe('ProfileProvider: theme', () => {
  beforeEach(() => document.documentElement.removeAttribute('data-theme'));

  it('starts from the theme saved on this device', () => {
    localStorage.setItem('trips.theme', 'dark');
    setup(ANON);
    expect(themeApi.preference).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('applies and remembers an anonymous choice on this device only', async () => {
    const { repo } = setup(ANON);
    let ok: boolean | undefined;
    await act(async () => {
      ok = await themeApi.setPreference('dark');
    });
    expect(ok).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('trips.theme')).toBe('dark');
    expect(repo.updateTheme).not.toHaveBeenCalled();
  });

  it('switches to the account’s theme once the profile loads', async () => {
    localStorage.setItem('trips.theme', 'light');
    setup(SIGNED_IN, fakeRepo([], { ...PROFILE, theme: 'dark' }));
    await waitFor(() => expect(themeApi.preference).toBe('dark'));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('trips.theme')).toBe('dark');
  });

  it('saves a signed-in choice to the account, undoing it if that fails', async () => {
    const { repo } = setup(SIGNED_IN);
    await waitFor(() => expect(profileApi.status).toBe('ready'));

    await act(() => themeApi.setPreference('dark'));
    expect(repo.updateTheme).toHaveBeenCalledWith('user-1', 'dark');
    expect(profileApi.profile?.theme).toBe('dark');

    repo.updateTheme.mockRejectedValueOnce(new Error('offline'));
    let ok: boolean | undefined;
    await act(async () => {
      ok = await themeApi.setPreference('light');
    });
    expect(ok).toBe(false);
    expect(themeApi.preference).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
