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

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Home {
  name: string;
  lat: number;
  lng: number;
}

export interface Profile {
  id: string;
  displayName: string | null;
  home: Home | null;
  theme: ThemePreference;
}

export type ProfilePatch = Pick<Profile, 'displayName' | 'home'>;

export type MemberKind = 'adult' | 'child' | 'dog';

export interface FamilyMember {
  id: string;
  nickname: string;
  kind: MemberKind;
  birth: { year: number; month: number } | null; // child only
  sortOrder: number;
}

/** What the family form edits. */
export type MemberInput = Pick<FamilyMember, 'nickname' | 'kind' | 'birth'>;

export type ContactTopic = 'product_news' | 'nearby_digest';
export type DigestFrequency = 'weekly' | 'monthly';

export interface ContactPreference {
  topic: ContactTopic;
  optedIn: boolean;
  frequency: DigestFrequency | null; // nearby_digest only
  /** When opted_in last changed; null when nothing has been stored (never opted in). */
  changedAt: string | null;
}

export type ContactChoice = Pick<ContactPreference, 'optedIn' | 'frequency'>;
