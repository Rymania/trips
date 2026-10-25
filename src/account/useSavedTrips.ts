import { useCallback, useMemo, useState } from 'react';
import type { Repo } from './repo';
import { mergeSaved } from './savedMerge';
import { clearSessionSaved, loadSessionSaved, storeSessionSaved } from './sessionSaved';
import type { SavedPatch, SavedTrip, SessionSave } from './types';
import { useAccountData, type Accounts, type LoadStatus, type MakeRepo } from './useAccountData';

export interface SavedApi {
  /** True when saves go to the account rather than this browser tab. */
  persistent: boolean;
  /** The account's list: idle when signed out. */
  status: LoadStatus;
  /** The account's saved trips, in no particular order (see orderSaved). */
  items: SavedTrip[];
  isSaved: (activityId: string) => boolean;
  /** Saves or unsaves; resolves false if the change didn't stick. */
  toggle: (activity: { id: string; name: string }) => Promise<boolean>;
  update: (activityId: string, patch: SavedPatch) => Promise<boolean>;
  remove: (activityId: string) => Promise<boolean>;
  reload: () => void;
}

/** Loads the account list, first adding any saves made before signing in. */
async function loadSaved(repo: Repo, userId: string): Promise<SavedTrip[]> {
  const pending = loadSessionSaved();
  const { toAdd, items } = mergeSaved(await repo.listSaved(), pending, new Date().toISOString());
  if (toAdd.length > 0) await repo.addSaved(userId, toAdd);
  if (pending.length > 0) clearSessionSaved();
  return items;
}

/**
 * Saved trips: in `sessionStorage` when anonymous, on the account when signed
 * in. Changes show straight away and roll back if the request fails.
 */
export function useSavedTrips(
  userId: string | null,
  accounts: Accounts,
  makeRepo: MakeRepo,
): SavedApi {
  const { status, data, reload, optimistic } = useAccountData(
    userId,
    accounts,
    makeRepo,
    loadSaved,
  );
  const items = useMemo(() => data ?? [], [data]);
  const [session, setSession] = useState<SessionSave[]>(loadSessionSaved);

  // On sign-out, re-read the tab's saves: empty after a merge, still there if it failed.
  const [prevUser, setPrevUser] = useState(userId);
  if (userId !== prevUser) {
    setPrevUser(userId);
    if (!userId) setSession(loadSessionSaved());
  }

  const setSessionSaved = useCallback((next: SessionSave[]) => {
    setSession(next);
    storeSessionSaved(next);
  }, []);

  const remove = useCallback(
    async (activityId: string) => {
      if (!userId) {
        setSessionSaved(session.filter((s) => s.activityId !== activityId));
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
    [userId, session, items, optimistic, setSessionSaved],
  );

  const toggle = useCallback(
    async ({ id, name }: { id: string; name: string }) => {
      const saved = userId ? items : session;
      if (saved.some((s) => s.activityId === id)) return remove(id);
      const save: SessionSave = { activityId: id, activityName: name };
      if (!userId) {
        setSessionSaved([...session, save]);
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
    [userId, items, session, remove, optimistic, setSessionSaved],
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

  return useMemo<SavedApi>(() => {
    const ids = new Set((userId ? items : session).map((s) => s.activityId));
    return {
      persistent: userId !== null,
      status,
      items,
      isSaved: (activityId) => ids.has(activityId),
      toggle,
      update,
      remove,
      reload,
    };
  }, [userId, status, items, session, toggle, update, remove, reload]);
}
