export const CATEGORIES = [
  'Outdoor',
  'Sports',
  'Museums',
  'Entertainment',
  'Food & Dining',
  'Shopping',
  'Water Activities',
  'Parks & Nature',
  'Historical Sites',
  'Educational',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const AGE_GROUPS = [
  { id: '0-3', label: '0–3', min: 0, max: 3 },
  { id: '4-7', label: '4–7', min: 4, max: 7 },
  { id: '8-12', label: '8–12', min: 8, max: 12 },
  { id: '13-17', label: '13–17', min: 13, max: 17 },
  { id: '18+', label: '18+', min: 18, max: 120 },
] as const;
export type AgeGroupId = (typeof AGE_GROUPS)[number]['id'];

export interface LatLng {
  lat: number;
  lng: number;
}

/** Normalised activity, independent of the originating source. */
export interface Activity {
  id: string;
  sourceId: string;
  sourceName: string;
  name: string;
  description: string;
  address: string;
  location: LatLng;
  categories: Category[];
  /** null when the source gives no age guidance. */
  ageRange: { min: number; max: number } | null;
  /** 'unknown' when not verified. */
  dogFriendly: boolean | 'unknown';
  /** Per-person cost in GBP; null when unknown. */
  cost: { min: number; max: number } | null;
  website?: string;
  phone?: string;
  hours?: string;
  images: { url: string; alt: string }[];
  rating: number | null;
  reviewsCount: number;
  lastUpdated: string;
}

export type SortKey = 'distance' | 'cost' | 'rating' | 'popularity' | 'name';
export type ViewMode = 'map' | 'list';

export interface Filters {
  query: string;
  ageGroups: AgeGroupId[];
  radiusKm: number | null;
  dogFriendly: boolean;
  categories: Category[];
  minCost: number | null;
  maxCost: number | null;
  origin: LatLng;
  originLabel: string;
  familySize: number;
  sort: SortKey;
  view: ViewMode;
}

export interface ActivityResult {
  activity: Activity;
  distanceKm: number;
}
