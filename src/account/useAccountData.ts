import { useCallback, useEffect, useRef, useState } from 'react';
import type { TripsClient } from './client';
import type { Repo } from './repo';

export interface Accounts {
  getClient: () => Promise<TripsClient | null>;
}
export type MakeRepo = (client: TripsClient) => Repo;
export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

/** One load's result, tagged with the sign-in and attempt it belongs to. */
interface Loaded<T> {
  key: string;
  status: 'ready' | 'error';
  data: T | null;
}

/**
 * Loads one part of the signed-in user's data, once per sign-in and retry.
 * Results that arrive after sign-out or a newer attempt are ignored. `load`
 * must be stable (a module-level function).
 */
export function useAccountData<T>(
  userId: string | null,
  accounts: Accounts,
  makeRepo: MakeRepo,
  load: (repo: Repo, userId: string) => Promise<T>,
) {
  const [attempt, setAttempt] = useState(0);
  const key = userId && `${userId}#${attempt}`;
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null);
  const repo = useRef<Repo | null>(null);

  useEffect(() => {
    repo.current = null;
    if (!userId || !key) return;
    let live = true;
    const run = async () => {
      const client = await accounts.getClient();
      if (!client) throw new Error('Accounts unavailable');
      const r = makeRepo(client);
      return { r, data: await load(r, userId) };
    };
    run().then(
      ({ r, data }) => {
        if (!live) return;
        repo.current = r;
        setLoaded({ key, status: 'ready', data });
      },
      () => {
        if (live) setLoaded({ key, status: 'error', data: null });
      },
    );
    return () => {
      live = false;
    };
  }, [userId, key, accounts, makeRepo, load]);

  const current = key && loaded?.key === key ? loaded : null;
  const status: LoadStatus = !userId ? 'idle' : (current?.status ?? 'loading');
  const data = current?.status === 'ready' ? current.data : null;

  const setData = useCallback(
    (f: (d: T) => T) =>
      setLoaded((l) => (l?.status === 'ready' && l.data !== null ? { ...l, data: f(l.data) } : l)),
    [],
  );
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  /** Applies a change on screen, writes it, and undoes the change if the write fails. */
  const optimistic = useCallback(
    async (change: (d: T) => T, undo: (d: T) => T, write: (r: Repo) => Promise<void>) => {
      const r = repo.current;
      if (!r) return false;
      setData(change);
      try {
        await write(r);
        return true;
      } catch {
        setData(undo);
        return false;
      }
    },
    [setData],
  );

  return { status, data, repo, reload, optimistic };
}
