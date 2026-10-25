/** Client-side shapes for account data (specs/005-user-settings/data-model.md). */

export interface SavedTrip {
  activityId: string;
  activityName: string;
  savedAt: string;
  plannedFor: string | null; // ISO date
  note: string | null;
}

/** A save made before signing in: just enough to add it to the account later. */
export interface SessionSave {
  activityId: string;
  activityName: string;
}

export type SavedPatch = Pick<SavedTrip, 'plannedFor' | 'note'>;
