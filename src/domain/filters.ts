import { fuzzyMatches } from './fuzzy';
import { haversineKm } from './geo';
import { AGE_GROUPS, type Activity, type ActivityResult, type Filters } from './types';

export function formatCost(cost: Activity['cost']): string {
  if (!cost) return 'Price unknown';
  if (cost.max === 0) return 'Free';
  const fmt = (n: number) => `£${n.toFixed(2)}`;
  return cost.min === cost.max ? fmt(cost.min) : `${fmt(cost.min)}–${fmt(cost.max)}`;
}

export function estimateFamilyCost(cost: Activity['cost'], familySize: number) {
  return cost ? { min: cost.min * familySize, max: cost.max * familySize } : null;
}

function matchesAge(a: Activity, groups: Filters['ageGroups']): boolean {
  if (groups.length === 0) return true;
  if (!a.ageRange) return false;
  const range = a.ageRange;
  return AGE_GROUPS.some((g) => groups.includes(g.id) && range.min <= g.max && range.max >= g.min);
}

function matchesCost(a: Activity, f: Filters): boolean {
  if (f.minCost === null && f.maxCost === null) return true;
  if (!a.cost) return false;
  return a.cost.max >= (f.minCost ?? 0) && a.cost.min <= (f.maxCost ?? Infinity);
}

function matches(a: Activity, f: Filters, distanceKm: number): boolean {
  if (f.radiusKm !== null && distanceKm > f.radiusKm) return false;
  if (f.dogFriendly && a.dogFriendly !== true) return false;
  if (f.categories.length > 0 && !a.categories.some((c) => f.categories.includes(c))) return false;
  if (!matchesAge(a, f.ageGroups) || !matchesCost(a, f)) return false;
  return fuzzyMatches(f.query, [a.name, a.description, a.address, ...a.categories].join(' '));
}

/** Nulls sort last regardless of direction. */
const byNullable = (x: number | null, y: number | null, dir: 1 | -1) =>
  x === y ? 0 : x === null ? 1 : y === null ? -1 : (x - y) * dir;

const COMPARATORS: Record<Filters['sort'], (a: ActivityResult, b: ActivityResult) => number> = {
  distance: (a, b) => a.distanceKm - b.distanceKm,
  cost: (a, b) => byNullable(a.activity.cost?.min ?? null, b.activity.cost?.min ?? null, 1),
  rating: (a, b) => byNullable(a.activity.rating, b.activity.rating, -1),
  popularity: (a, b) => b.activity.reviewsCount - a.activity.reviewsCount,
  name: (a, b) => a.activity.name.localeCompare(b.activity.name),
};

/** AND-combines every active filter, then sorts. Pure and safe for 10k+ activities. */
export function applyFilters(activities: Activity[], f: Filters): ActivityResult[] {
  const results: ActivityResult[] = [];
  for (const activity of activities) {
    const distanceKm = haversineKm(f.origin, activity.location);
    if (matches(activity, f, distanceKm)) results.push({ activity, distanceKm });
  }
  return results.sort(
    (a, b) => COMPARATORS[f.sort](a, b) || a.activity.name.localeCompare(b.activity.name),
  );
}
