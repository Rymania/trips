import { AGE_GROUPS, type AgeGroupId, type Filters } from './types';

/** What the filters need to know about a family member (see account/types FamilyMember). */
export interface FamilyMemberLike {
  kind: 'adult' | 'child' | 'dog';
  birth: { year: number; month: number } | null;
}

const MAX_FAMILY = 20; // the URL state's family size limit

/**
 * Whole years old on `today`, treating the birthday as the first of the birth
 * month (specs/005-user-settings research R6): only month and year are stored.
 */
export function ageInYears(birth: { year: number; month: number }, today: Date): number {
  const months = (today.getFullYear() - birth.year) * 12 + (today.getMonth() + 1 - birth.month);
  return Math.max(0, Math.floor(months / 12));
}

/**
 * Default filters for a family (spec 005 FR-008). Only what the family says
 * anything about is set: no children leaves ages alone, no people leaves the
 * family size alone, no dog leaves dog-friendly alone.
 */
export function familyDefaults(members: FamilyMemberLike[], today: Date): Partial<Filters> {
  const ages = members.flatMap((m) =>
    m.kind === 'child' && m.birth ? [ageInYears(m.birth, today)] : [],
  );
  const ageGroups: AgeGroupId[] = AGE_GROUPS.filter(
    (g) => g.id !== '18+' && ages.some((a) => a >= g.min && a <= g.max),
  ).map((g) => g.id);
  const people = members.filter((m) => m.kind !== 'dog').length;

  const defaults: Partial<Filters> = {};
  if (ageGroups.length > 0) defaults.ageGroups = ageGroups;
  if (people > 0) defaults.familySize = Math.min(people, MAX_FAMILY);
  if (members.some((m) => m.kind === 'dog')) defaults.dogFriendly = true;
  return defaults;
}
