import type { TripsClient } from './client';
import type { Database } from './database.types';
import type {
  FamilyMember,
  MemberInput,
  MemberKind,
  Profile,
  ProfilePatch,
  SavedPatch,
  SavedTrip,
  SessionSave,
  ThemePreference,
} from './types';

/**
 * Typed data access for the signed-in user's rows. Row-level security limits
 * every query to the caller's own data (contracts/rls-policies.md); the
 * `profile_id` filters on writes just make the target explicit.
 */
type SavedRow = Pick<
  Database['public']['Tables']['saved_trips']['Row'],
  'activity_id' | 'activity_name' | 'saved_at' | 'planned_for' | 'note'
>;

type ProfileRow = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'display_name' | 'home_place_name' | 'home_lat' | 'home_lng' | 'theme'
>;

type MemberRow = Pick<
  Database['public']['Tables']['family_members']['Row'],
  'id' | 'nickname' | 'kind' | 'birth_year' | 'birth_month' | 'sort_order'
>;

const NAME_MAX = 200;
const MEMBER_COLUMNS = 'id, nickname, kind, birth_year, birth_month, sort_order';

const toMember = (r: MemberRow): FamilyMember => ({
  id: r.id,
  nickname: r.nickname,
  kind: r.kind as MemberKind,
  birth:
    r.birth_year !== null && r.birth_month !== null
      ? { year: r.birth_year, month: r.birth_month }
      : null,
  sortOrder: r.sort_order,
});

const memberColumns = ({ nickname, kind, birth }: MemberInput) => ({
  nickname,
  kind,
  birth_year: birth?.year ?? null,
  birth_month: birth?.month ?? null,
});

const toProfile = (r: ProfileRow): Profile => ({
  id: r.id,
  displayName: r.display_name,
  home:
    r.home_place_name !== null && r.home_lat !== null && r.home_lng !== null
      ? { name: r.home_place_name, lat: r.home_lat, lng: r.home_lng }
      : null,
  theme: r.theme as ThemePreference,
});

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
  const family = () => client.from('family_members');
  return {
    async getProfile(id: string): Promise<Profile> {
      const row = check(
        await client
          .from('profiles')
          .select('id, display_name, home_place_name, home_lat, home_lng, theme')
          .eq('id', id)
          .single(),
      );
      if (!row) throw new Error('Profile not found');
      return toProfile(row);
    },

    async updateProfile(id: string, { displayName, home }: ProfilePatch): Promise<void> {
      check(
        await client
          .from('profiles')
          .update({
            display_name: displayName,
            home_place_name: home?.name ?? null,
            home_lat: home?.lat ?? null,
            home_lng: home?.lng ?? null,
          })
          .eq('id', id),
      );
    },

    /** Auth emails the new address; the change applies once that link is followed. */
    async changeEmail(email: string, redirectTo: string): Promise<void> {
      const { error } = await client.auth.updateUser({ email }, { emailRedirectTo: redirectTo });
      if (error) throw error;
    },

    async listFamily(): Promise<FamilyMember[]> {
      const rows = check(
        await family()
          .select(MEMBER_COLUMNS)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
      );
      return (rows ?? []).map(toMember);
    },

    /** Adds a member; the database caps a family at 20 (data-model.md). */
    async addMember(profileId: string, m: MemberInput, sortOrder: number): Promise<FamilyMember> {
      const row = check(
        await family()
          .insert({ profile_id: profileId, ...memberColumns(m), sort_order: sortOrder })
          .select(MEMBER_COLUMNS)
          .single(),
      );
      if (!row) throw new Error('Family member not returned');
      return toMember(row);
    },

    async updateMember(id: string, m: MemberInput): Promise<void> {
      check(await family().update(memberColumns(m)).eq('id', id));
    },

    async removeMember(id: string): Promise<void> {
      check(await family().delete().eq('id', id));
    },

    async reorderFamily(order: { id: string; sortOrder: number }[]): Promise<void> {
      const results = await Promise.all(
        order.map(({ id, sortOrder }) => family().update({ sort_order: sortOrder }).eq('id', id)),
      );
      results.forEach(check);
    },

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
