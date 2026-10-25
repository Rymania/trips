import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { accounts as defaultAccounts, type TripsClient } from './client';
import { createRepo, type Repo } from './repo';
import { mergeSaved } from './savedMerge';
import { clearSessionSaved, loadSessionSaved, storeSessionSaved } from './sessionSaved';
import type { SavedPatch, SavedTrip, SessionSave } from './types';

export interface SavedApi {
  /** True when saves go to the account rather than this browser tab. */
  persistent: boolean;
  /** The account's list: idle when signed out. */
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** The account's saved trips, in no particular order (see orderSaved). */
  items: SavedTrip[];
  isSaved: (activityId: string) => boolean;
  /** Saves or unsaves; resolves false if the change didn't stick. */
  toggle: (activity: { id: string; name: string }) => Promise<boolean>;
  update: (activityId: string, patch: SavedPatch) => Promise<boolean>;
  remove: (activityId: string) => Promise<boolean>;
  reload: () => void;
}

export const SavedContext = createContext<SavedApi | null>(null);

export function useSaved(): SavedApi {
  const api = useContext(SavedContext);
  if (!api) throw new Error('useSaved must be used inside <ProfileProvider>');
  return api;
}

interface Accounts {
  getClient: () => Promise<TripsClient | null>;
}

/** The account list for one sign-in (and retry attempt), so stale results are ignored. */
interface Loaded {
  key: string;
  status: 'ready' | 'error';
  items: SavedTrip[];
}

/** Loads the account list, first adding any saves made before signing in. */
async function loadAccountSaved(
  accounts: Accounts,
  makeRepo: (c: TripsClient) => Repo,
  userId: string,
) {
  const client = await accounts.getClient();
  if (!client) throw new Error('Accounts unavailable');
  const repo = makeRepo(client);
  const pending = loadSessionSaved();
  const { toAdd, items } = mergeSaved(await repo.listSaved(), pending, new Date().toISOString());
  if (toAdd.length > 0) await repo.addSaved(userId, toAdd);
  if (pending.length > 0) clearSessionSaved();
  return { repo, items };
}

/**
 * The signed-in user's account data. Changes show straight away and roll back
 * if the request fails (plan.md, "Saved trips").
 */
export function ProfileProvider({
  accounts = defaultAccounts,
  makeRepo = createRepo,
  children,
}: {
  accounts?: Accounts;
  makeRepo?: (client: TripsClient) => Repo;
  children: ReactNode;
}) {
  const { state } = useAuth();
  const userId = state.status === 'signedIn' ? state.user.id : null;
  const [attempt, setAttempt] = useState(0);
  const key = userId && `${userId}#${attempt}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [session, setSession] = useState<SessionSave[]>(loadSessionSaved);
  const repo = useRef<Repo | null>(null);

  useEffect(() => {
    repo.current = null;
    if (!userId || !key) return;
    let live = true;
    loadAccountSaved(accounts, makeRepo, userId).then(
      (r) => {
        if (!live) return;
        repo.current = r.repo;
        setSession([]);
        setLoaded({ key, status: 'ready', items: r.items });
      },
      () => {
        if (live) setLoaded({ key, status: 'error', items: [] });
      },
    );
    return () => {
      live = false;
    };
  }, [userId, key, accounts, makeRepo]);

  const current = key && loaded?.key === key ? loaded : null;
  const items = useMemo(() => current?.items ?? [], [current]);

  const setItems = useCallback(
    (f: (list: SavedTrip[]) => SavedTrip[]) =>
      setLoaded((l) => (l?.status === 'ready' ? { ...l, items: f(l.items) } : l)),
    [],
  );

  /** Applies a change on screen, writes it, and undoes the change if the write fails. */
  const optimistic = useCallback(
    async (
      change: (list: SavedTrip[]) => SavedTrip[],
      undo: (list: SavedTrip[]) => SavedTrip[],
      write: (r: Repo) => Promise<void>,
    ) => {
      const r = repo.current;
      if (!r) return false;
      setItems(change);
      try {
        await write(r);
        return true;
      } catch {
        setItems(undo);
        return false;
      }
    },
    [setItems],
  );

  const remove = useCallback(
    async (activityId: string) => {
      if (!userId) {
        const next = session.filter((s) => s.activityId !== activityId);
        setSession(next);
        storeSessionSaved(next);
        return true;
      }
      const previous = items.find((i) => i.activityId === activityId);
      if (!previous) return false;
      const without = (list: SavedTrip[]) => list.filter((i) => i.activityId !== activityId);
      return optimistic(
        without,
        (list) => [...without(list), previous],
        (r) => r.removeSaved(userId, activityId),
      );
    },
    [userId, session, items, optimistic],
  );

  const toggle = useCallback(
    async ({ id, name }: { id: string; name: string }) => {
      const saved = userId ? items : session;
      if (saved.some((s) => s.activityId === id)) return remove(id);
      const save: SessionSave = { activityId: id, activityName: name };
      if (!userId) {
        const next = [...session, save];
        setSession(next);
        storeSessionSaved(next);
        return true;
      }
      const trip: SavedTrip = {
        ...save,
        savedAt: new Date().toISOString(),
        plannedFor: null,
        note: null,
      };
      return optimistic(
        (list) => [...list, trip],
        (list) => list.filter((i) => i !== trip),
        (r) => r.addSaved(userId, [save]),
      );
    },
    [userId, items, session, remove, optimistic],
  );

  const update = useCallback(
    async (activityId: string, patch: SavedPatch) => {
      const previous = items.find((i) => i.activityId === activityId);
      if (!userId || !previous) return false;
      const replace = (next: SavedTrip) => (list: SavedTrip[]) =>
        list.map((i) => (i.activityId === activityId ? next : i));
      return optimistic(replace({ ...previous, ...patch }), replace(previous), (r) =>
        r.updateSaved(userId, activityId, patch),
      );
    },
    [userId, items, optimistic],
  );

  const api = useMemo<SavedApi>(() => {
    const ids = new Set((userId ? items : session).map((s) => s.activityId));
    return {
      persistent: userId !== null,
      status: !userId ? 'idle' : (current?.status ?? 'loading'),
      items,
      isSaved: (activityId) => ids.has(activityId),
      toggle,
      update,
      remove,
      reload: () => setAttempt((n) => n + 1),
    };
  }, [userId, current, items, session, toggle, update, remove]);

  return <SavedContext.Provider value={api}>{children}</SavedContext.Provider>;
}
