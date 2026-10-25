import type { TripsClient } from './client';
import type { Database } from './database.types';
import type { SavedPatch, SavedTrip, SessionSave } from './types';

/**
 * Typed data access for the signed-in user's rows. Row-level security limits
 * every query to the caller's own data (contracts/rls-policies.md); the
 * `profile_id` filters on writes just make the target explicit.
 */
type SavedRow = Pick<
  Database['public']['Tables']['saved_trips']['Row'],
  'activity_id' | 'activity_name' | 'saved_at' | 'planned_for' | 'note'
>;

const NAME_MAX = 200;

const toSavedTrip = (r: SavedRow): SavedTrip => ({
  activityId: r.activity_id,
  activityName: r.activity_name,
  savedAt: r.saved_at,
  plannedFor: r.planned_for,
  note: r.note,
});

/** supabase-js resolves with `{ error }` rather than rejecting; turn that into a throw. */
function check<T>({ data, error }: { data: T; error: unknown }): T {
  if (error) throw error;
  return data;
}

export function createRepo(client: TripsClient) {
  const saved = () => client.from('saved_trips');
  return {
    async listSaved(): Promise<SavedTrip[]> {
      const rows = check(
        await saved()
          .select('activity_id, activity_name, saved_at, planned_for, note')
          .order('planned_for', { ascending: true, nullsFirst: false })
          .order('saved_at', { ascending: false }),
      );
      return (rows ?? []).map(toSavedTrip);
    },

    /** Saves activities, leaving any already saved (with their notes) untouched. */
    async addSaved(profileId: string, items: SessionSave[]): Promise<void> {
      const rows = items.map((s) => ({
        profile_id: profileId,
        activity_id: s.activityId,
        activity_name: s.activityName.slice(0, NAME_MAX),
      }));
      check(
        await saved().upsert(rows, {
          onConflict: 'profile_id,activity_id',
          ignoreDuplicates: true,
        }),
      );
    },

    async updateSaved(profileId: string, activityId: string, patch: SavedPatch): Promise<void> {
      check(
        await saved()
          .update({ planned_for: patch.plannedFor, note: patch.note })
          .eq('profile_id', profileId)
          .eq('activity_id', activityId),
      );
    },

    async removeSaved(profileId: string, activityId: string): Promise<void> {
      check(await saved().delete().eq('profile_id', profileId).eq('activity_id', activityId));
    },
  };
}

export type Repo = ReturnType<typeof createRepo>;
