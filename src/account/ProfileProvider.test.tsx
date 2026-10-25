import { act, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeAccounts } from '../test/fakeAuthClient';
import { AuthContext, type AuthApi, type AuthState } from './AuthProvider';
import type { TripsClient } from './client';
import {
  ProfileProvider,
  useProfile,
  useSaved,
  type ProfileApi,
  type SavedApi,
} from './ProfileProvider';
import type { Repo } from './repo';
import type { Profile, SavedTrip } from './types';

const trip = (id: string, over: Partial<SavedTrip> = {}): SavedTrip => ({
  activityId: id,
  activityName: `Activity ${id}`,
  savedAt: '2026-10-01T10:00:00.000Z',
  plannedFor: null,
  note: null,
  ...over,
});

const PROFILE: Profile = { id: 'user-1', displayName: 'Sam', home: null, theme: 'system' };

function fakeRepo(initial: SavedTrip[] = [], profile: Profile = PROFILE) {
  return {
    getProfile: vi.fn(async () => profile),
    updateProfile: vi.fn(async () => {}),
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
function Probe() {
  const value = useSaved();
  const prof = useProfile();
  useEffect(() => {
    api = value;
    profileApi = prof;
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
