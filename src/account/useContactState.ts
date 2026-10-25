import { useCallback, useMemo } from 'react';
import type { Repo } from './repo';
import type { ContactChoice, ContactPreference, ContactTopic } from './types';
import { useAccountData, type Accounts, type LoadStatus, type MakeRepo } from './useAccountData';

export interface ContactApi {
  status: LoadStatus;
  /** A topic's choice; one never stored is off (spec 005 FR-011). */
  get: (topic: ContactTopic) => ContactPreference;
  /** Resolves false if the choice couldn't be saved. */
  set: (topic: ContactTopic, choice: ContactChoice) => Promise<boolean>;
  reload: () => void;
}

const loadContact = (repo: Repo) => repo.listContact();

const off = (topic: ContactTopic): ContactPreference => ({
  topic,
  optedIn: false,
  frequency: null,
  changedAt: null,
});

const replace = (next: ContactPreference) => (list: ContactPreference[]) => [
  ...list.filter((p) => p.topic !== next.topic),
  next,
];

export function useContactState(
  userId: string | null,
  accounts: Accounts,
  makeRepo: MakeRepo,
): ContactApi {
  const { status, data, reload, optimistic, setData } = useAccountData(
    userId,
    accounts,
    makeRepo,
    loadContact,
  );

  const get = useCallback(
    (topic: ContactTopic) => data?.find((p) => p.topic === topic) ?? off(topic),
    [data],
  );

  const set = useCallback(
    async (topic: ContactTopic, choice: ContactChoice) => {
      if (!userId) return false;
      const previous = get(topic);
      let stored: ContactPreference | null = null;
      const ok = await optimistic(
        replace({ ...previous, ...choice }),
        (list) =>
          previous.changedAt ? replace(previous)(list) : list.filter((p) => p.topic !== topic),
        async (r) => {
          stored = await r.saveContact(userId, topic, choice);
        },
      );
      // Show the time the database recorded rather than our guess.
      if (stored) setData(replace(stored));
      return ok;
    },
    [userId, get, optimistic, setData],
  );

  return useMemo(() => ({ status, get, set, reload }), [status, get, set, reload]);
}
