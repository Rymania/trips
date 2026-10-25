import type { SessionSave } from './types';

/** Anonymous saves last for the browser tab's session, as in spec 001. */
const KEY = 'saved';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function parse(entry: unknown): SessionSave | null {
  // Before accounts the list held bare activity IDs.
  if (typeof entry === 'string') return { activityId: entry, activityName: entry };
  if (typeof entry !== 'object' || entry === null) return null;
  const { activityId, activityName } = entry as Partial<SessionSave>;
  if (typeof activityId !== 'string') return null;
  return { activityId, activityName: typeof activityName === 'string' ? activityName : activityId };
}

export function loadSessionSaved(store: Store = sessionStorage): SessionSave[] {
  try {
    const raw: unknown = JSON.parse(store.getItem(KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.map(parse).filter((s): s is SessionSave => s !== null);
  } catch {
    return [];
  }
}

export function storeSessionSaved(list: SessionSave[], store: Store = sessionStorage) {
  try {
    store.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
}

export function clearSessionSaved(store: Store = sessionStorage) {
  try {
    store.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}
