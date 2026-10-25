import {
  AGE_GROUPS,
  CATEGORIES,
  type AgeGroupId,
  type Category,
  type Filters,
  type SortKey,
  type ViewMode,
} from './types';

const SORTS: SortKey[] = ['distance', 'cost', 'rating', 'popularity', 'name'];
const VIEWS: ViewMode[] = ['map', 'list'];
const MAX_QUERY = 100;

export function defaultFilters(): Filters {
  return {
    query: '',
    ageGroups: [],
    radiusKm: null,
    dogFriendly: false,
    categories: [],
    minCost: null,
    maxCost: null,
    origin: { lat: 51.5074, lng: -0.1278 },
    originLabel: 'London',
    familySize: 4,
    sort: 'distance',
    view: 'list',
  };
}

const num = (v: string | null, min: number, max: number): number | null => {
  if (v === null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

const pick = <T extends string>(raw: string | null, allowed: readonly T[]): T[] =>
  (raw?.split(',') ?? []).filter((x): x is T => (allowed as readonly string[]).includes(x));

/** Parses and validates a query string; invalid values fall back to defaults. */
export function searchToFilters(search: string): Filters {
  const d = defaultFilters();
  const p = new URLSearchParams(search);
  const lat = num(p.get('lat'), -90, 90);
  const lng = num(p.get('lng'), -180, 180);
  const hasOrigin = lat !== null && lng !== null;
  const sort = p.get('sort') as SortKey;
  const view = p.get('view') as ViewMode;
  return {
    query: (p.get('q') ?? '').slice(0, MAX_QUERY),
    ageGroups: pick<AgeGroupId>(
      p.get('age'),
      AGE_GROUPS.map((g) => g.id),
    ),
    radiusKm: num(p.get('radius'), 0.1, 20000),
    dogFriendly: p.get('dog') === '1',
    categories: pick<Category>(p.get('cat'), CATEGORIES),
    minCost: num(p.get('min'), 0, 100000),
    maxCost: num(p.get('max'), 0, 100000),
    origin: hasOrigin ? { lat, lng } : d.origin,
    originLabel: hasOrigin
      ? (p.get('place') ?? 'Custom location').slice(0, MAX_QUERY)
      : d.originLabel,
    familySize: num(p.get('fam'), 1, 20) ?? d.familySize,
    sort: SORTS.includes(sort) ? sort : d.sort,
    view: VIEWS.includes(view) ? view : d.view,
  };
}

const str = (n: number | null) => (n === null ? null : String(n));
const when = (cond: boolean, v: string) => (cond ? v : null);
const nonEmpty = (v: string) => v || null;

/** Serialises only non-default values, giving short shareable URLs. */
export function filtersToSearch(f: Filters): string {
  const d = defaultFilters();
  const moved = f.origin.lat !== d.origin.lat || f.origin.lng !== d.origin.lng;
  const entries: [string, string | null][] = [
    ['q', nonEmpty(f.query)],
    ['age', nonEmpty(f.ageGroups.join(','))],
    ['radius', str(f.radiusKm)],
    ['dog', when(f.dogFriendly, '1')],
    ['cat', nonEmpty(f.categories.join(','))],
    ['min', str(f.minCost)],
    ['max', str(f.maxCost)],
    ['lat', when(moved, f.origin.lat.toFixed(5))],
    ['lng', when(moved, f.origin.lng.toFixed(5))],
    ['place', when(moved, f.originLabel)],
    ['fam', when(f.familySize !== d.familySize, String(f.familySize))],
    ['sort', when(f.sort !== d.sort, f.sort)],
    ['view', when(f.view !== d.view, f.view)],
  ];
  const p = new URLSearchParams();
  entries.forEach(([k, v]) => v !== null && p.set(k, v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** The query parameters that set each filter, for deciding whether the URL chose it. */
const PARAMS: Partial<Record<keyof Filters, string[]>> = {
  query: ['q'],
  ageGroups: ['age'],
  radiusKm: ['radius'],
  dogFriendly: ['dog'],
  categories: ['cat'],
  minCost: ['min'],
  maxCost: ['max'],
  origin: ['lat', 'lng'],
  originLabel: ['lat', 'lng'],
  familySize: ['fam'],
  sort: ['sort'],
  view: ['view'],
};

/**
 * Applies per-user defaults (home location, family) to filters parsed from
 * `search`. A filter the URL sets, or one already changed from the app's
 * default, is left alone: links and the user's own choices always win.
 */
export function applyDefaults(f: Filters, defaults: Partial<Filters>, search: string): Filters {
  const p = new URLSearchParams(search);
  const d = defaultFilters();
  const next: Filters = { ...f };
  for (const key of Object.keys(defaults) as (keyof Filters)[]) {
    if ((PARAMS[key] ?? []).some((k) => p.has(k))) continue;
    if (JSON.stringify(f[key]) !== JSON.stringify(d[key])) continue;
    Object.assign(next, { [key]: defaults[key] });
  }
  return next;
}
