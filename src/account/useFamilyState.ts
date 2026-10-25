import { useCallback, useMemo } from 'react';
import type { Repo } from './repo';
import type { FamilyMember, MemberInput } from './types';
import { useAccountData, type Accounts, type LoadStatus, type MakeRepo } from './useAccountData';

export interface FamilyApi {
  status: LoadStatus;
  /** In display order. */
  members: FamilyMember[];
  /** Each resolves false if the change didn't stick. */
  add: (member: MemberInput) => Promise<boolean>;
  update: (id: string, member: MemberInput) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  /** Swaps a member with the one before (-1) or after (1) it. */
  move: (id: string, by: -1 | 1) => Promise<boolean>;
  reload: () => void;
}

const loadFamily = (repo: Repo) => repo.listFamily();

const byOrder = (a: FamilyMember, b: FamilyMember) => a.sortOrder - b.sortOrder;

/** Renumbers the list 0, 1, 2… in its current order. */
const renumber = (list: FamilyMember[]) => list.map((m, i) => ({ ...m, sortOrder: i }));

export function useFamilyState(
  userId: string | null,
  accounts: Accounts,
  makeRepo: MakeRepo,
): FamilyApi {
  const { status, data, ready, reload, optimistic, setData } = useAccountData(
    userId,
    accounts,
    makeRepo,
    loadFamily,
  );
  const members = useMemo(() => [...(data ?? [])].sort(byOrder), [data]);

  // Adding waits for the database, which assigns the ID and enforces the limit of 20.
  const add = useCallback(
    async (m: MemberInput) => {
      const r = userId ? await ready() : null;
      if (!userId || !r) return false;
      const current = r.loaded ?? members;
      const next = Math.max(-1, ...current.map((x) => x.sortOrder)) + 1;
      try {
        const added = await r.repo.addMember(userId, m, next);
        setData((list) => [...list, added]);
        return true;
      } catch {
        return false;
      }
    },
    [userId, members, ready, setData],
  );

  const update = useCallback(
    async (id: string, m: MemberInput) => {
      const previous = members.find((x) => x.id === id);
      if (!previous) return false;
      const replace = (next: FamilyMember) => (list: FamilyMember[]) =>
        list.map((x) => (x.id === id ? next : x));
      return optimistic(replace({ ...previous, ...m }), replace(previous), (r) =>
        r.updateMember(id, m),
      );
    },
    [members, optimistic],
  );

  const remove = useCallback(
    async (id: string) => {
      const previous = members.find((x) => x.id === id);
      if (!previous) return false;
      return optimistic(
        (list) => list.filter((x) => x.id !== id),
        (list) => [...list.filter((x) => x.id !== id), previous],
        (r) => r.removeMember(id),
      );
    },
    [members, optimistic],
  );

  const move = useCallback(
    async (id: string, by: -1 | 1) => {
      const from = members.findIndex((x) => x.id === id);
      const to = from + by;
      if (from < 0 || to < 0 || to >= members.length) return false;
      const swapped = [...members];
      swapped.splice(to, 0, ...swapped.splice(from, 1)); // neighbours, so a swap
      const reordered = renumber(swapped);
      // Only write the members whose position number actually changed.
      const changes = reordered
        .filter((m) => members.find((x) => x.id === m.id)?.sortOrder !== m.sortOrder)
        .map(({ id: changed, sortOrder }) => ({ id: changed, sortOrder }));
      const before = members;
      return optimistic(
        () => reordered,
        () => before,
        (r) => r.reorderFamily(changes),
      );
    },
    [members, optimistic],
  );

  return useMemo(
    () => ({ status, members, add, update, remove, move, reload }),
    [status, members, add, update, remove, move, reload],
  );
}
