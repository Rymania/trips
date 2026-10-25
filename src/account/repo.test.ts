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
  for (const m of ['select', 'order', 'upsert', 'update', 'delete', 'eq']) {
    builder[m] = (...args: unknown[]) => {
      calls.push([m, args]);
      return builder;
    };
  }
  const from = vi.fn(() => builder);
  return { client: { from } as unknown as TripsClient, from, calls };
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
