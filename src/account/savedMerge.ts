import type { SavedTrip, SessionSave } from './types';

/**
 * Folds the saves made before signing in into the account's list (spec 005
 * FR-006). Trips already on the account keep their dates and notes; `toAdd`
 * is what still needs writing.
 */
export function mergeSaved(
  account: SavedTrip[],
  session: SessionSave[],
  now: string,
): { toAdd: SessionSave[]; items: SavedTrip[] } {
  const seen = new Set(account.map((t) => t.activityId));
  const toAdd: SessionSave[] = [];
  for (const s of session) {
    if (seen.has(s.activityId)) continue;
    seen.add(s.activityId);
    toAdd.push(s);
  }
  const added = toAdd.map((s): SavedTrip => ({ ...s, savedAt: now, plannedFor: null, note: null }));
  return { toAdd, items: [...account, ...added] };
}

/** Soonest planned date first, undated last, then most recently saved. */
export function orderSaved(items: SavedTrip[]): SavedTrip[] {
  return [...items].sort(
    (a, b) =>
      compareDates(a.plannedFor, b.plannedFor) || Date.parse(b.savedAt) - Date.parse(a.savedAt),
  );
}

function compareDates(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}
