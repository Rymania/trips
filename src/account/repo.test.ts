import { describe, expect, it, vi } from 'vitest';
import type { TripsClient } from './client';
import { createRepo } from './repo';

type Call = [method: string, args: unknown[]];

/** A chainable stand-in for supabase-js's query builder that records each call. */
function fakeClient(result: { data?: unknown; error?: unknown } = {}) {
  const calls: Call[] = [];
  const settled = { data: result.data ?? null, error: result.error ?? null };
  const builder: Record<string, unknown> = {
    then: (resolve: (v: typeof settled) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(settled).then(resolve, reject),
  };
  for (const m of ['select', 'order', 'upsert', 'update', 'delete', 'eq', 'single']) {
    builder[m] = (...args: unknown[]) => {
      calls.push([m, args]);
      return builder;
    };
  }
  const from = vi.fn(() => builder);
  const auth = { updateUser: vi.fn(async () => ({ data: {}, error: result.error ?? null })) };
  return { client: { from, auth } as unknown as TripsClient, from, auth, calls };
}

describe('repo: saved trips', () => {
  it('lists saved trips in display order, mapped to client types', async () => {
    const { client, from, calls } = fakeClient({
      data: [
        {
          activity_id: 'sample-1',
          activity_name: 'Natural History Museum',
          saved_at: '2026-10-24T10:00:00Z',
          planned_for: '2026-11-01',
          note: 'Bring wellies',
        },
      ],
    });
    const trips = await createRepo(client).listSaved();
    expect(from).toHaveBeenCalledWith('saved_trips');
    expect(calls).toEqual([
      ['select', ['activity_id, activity_name, saved_at, planned_for, note']],
      ['order', ['planned_for', { ascending: true, nullsFirst: false }]],
      ['order', ['saved_at', { ascending: false }]],
    ]);
    expect(trips).toEqual([
      {
        activityId: 'sample-1',
        activityName: 'Natural History Museum',
        savedAt: '2026-10-24T10:00:00Z',
        plannedFor: '2026-11-01',
        note: 'Bring wellies',
      },
    ]);
  });

  it('adds trips without overwriting ones already saved', async () => {
    const { client, calls } = fakeClient();
    await createRepo(client).addSaved('user-1', [
      { activityId: 'a', activityName: 'x'.repeat(250) },
    ]);
    expect(calls).toEqual([
      [
        'upsert',
        [
          [{ profile_id: 'user-1', activity_id: 'a', activity_name: 'x'.repeat(200) }],
          { onConflict: 'profile_id,activity_id', ignoreDuplicates: true },
        ],
      ],
    ]);
  });

  it('updates the planned date and note of one trip', async () => {
    const { client, calls } = fakeClient();
    await createRepo(client).updateSaved('user-1', 'a', { plannedFor: null, note: 'Hi' });
    expect(calls).toEqual([
      ['update', [{ planned_for: null, note: 'Hi' }]],
      ['eq', ['profile_id', 'user-1']],
      ['eq', ['activity_id', 'a']],
    ]);
  });

  it('removes one trip', async () => {
    const { client, calls } = fakeClient();
    await createRepo(client).removeSaved('user-1', 'a');
    expect(calls).toEqual([
      ['delete', []],
      ['eq', ['profile_id', 'user-1']],
      ['eq', ['activity_id', 'a']],
    ]);
  });

  it('throws database errors so callers can roll back', async () => {
    const error = { message: 'nope', code: '42501' };
    const repo = createRepo(fakeClient({ error }).client);
    await expect(repo.listSaved()).rejects.toBe(error);
    await expect(repo.addSaved('u', [{ activityId: 'a', activityName: 'A' }])).rejects.toBe(error);
    await expect(repo.updateSaved('u', 'a', { plannedFor: null, note: null })).rejects.toBe(error);
    await expect(repo.removeSaved('u', 'a')).rejects.toBe(error);
  });
});

describe('repo: profile', () => {
  const row = {
    id: 'user-1',
    display_name: 'Sam',
    home_place_name: 'Brighton',
    home_lat: 50.8225,
    home_lng: -0.1372,
    theme: 'dark',
  };

  it('reads the profile, mapping the home location', async () => {
    const { client, from, calls } = fakeClient({ data: row });
    expect(await createRepo(client).getProfile('user-1')).toEqual({
      id: 'user-1',
      displayName: 'Sam',
      home: { name: 'Brighton', lat: 50.8225, lng: -0.1372 },
      theme: 'dark',
    });
    expect(from).toHaveBeenCalledWith('profiles');
    expect(calls).toEqual([
      ['select', ['id, display_name, home_place_name, home_lat, home_lng, theme']],
      ['eq', ['id', 'user-1']],
      ['single', []],
    ]);
  });

  it('treats a partial home location as none', async () => {
    const { client } = fakeClient({ data: { ...row, home_lat: null, display_name: null } });
    expect(await createRepo(client).getProfile('user-1')).toMatchObject({
      displayName: null,
      home: null,
    });
  });

  it('updates the name and home location together', async () => {
    const { client, calls } = fakeClient();
    const repo = createRepo(client);
    await repo.updateProfile('user-1', {
      displayName: 'Sam',
      home: { name: 'Brighton', lat: 50.8, lng: -0.1 },
    });
    await repo.updateProfile('user-1', { displayName: 'Sam', home: null });
    expect(calls).toEqual([
      [
        'update',
        [{ display_name: 'Sam', home_place_name: 'Brighton', home_lat: 50.8, home_lng: -0.1 }],
      ],
      ['eq', ['id', 'user-1']],
      ['update', [{ display_name: 'Sam', home_place_name: null, home_lat: null, home_lng: null }]],
      ['eq', ['id', 'user-1']],
    ]);
  });

  it('asks Auth to change the email, confirming through the callback page', async () => {
    const { client, auth } = fakeClient();
    await createRepo(client).changeEmail('new@trips.test', 'https://trips.test/auth/callback');
    expect(auth.updateUser).toHaveBeenCalledWith(
      { email: 'new@trips.test' },
      { emailRedirectTo: 'https://trips.test/auth/callback' },
    );
  });

  it('throws profile and email errors', async () => {
    const error = { message: 'nope', status: 422, code: 'email_exists' };
    const repo = createRepo(fakeClient({ error }).client);
    await expect(repo.getProfile('u')).rejects.toBe(error);
    await expect(repo.updateProfile('u', { displayName: 'x', home: null })).rejects.toBe(error);
    await expect(repo.changeEmail('a@b.c', '/')).rejects.toBe(error);
  });
});
