import { describe, expect, it } from 'vitest';
import { haversineKm } from './geo';
import { applyFilters, estimateFamilyCost, formatCost } from './filters';
import { defaultFilters, filtersToSearch, searchToFilters } from './urlState';
import type { Activity } from './types';

const base: Activity = {
  id: 'a',
  sourceId: 'a',
  sourceName: 'Test',
  name: 'Alpha Park',
  description: 'Big green park',
  address: '1 Road',
  location: { lat: 51.5, lng: -0.12 },
  categories: ['Parks & Nature'],
  ageRange: { min: 0, max: 12 },
  dogFriendly: true,
  cost: { min: 0, max: 0 },
  images: [],
  rating: 4.5,
  reviewsCount: 100,
  lastUpdated: '2026-01-01',
};
const mk = (o: Partial<Activity>): Activity => ({ ...base, ...o });

describe('haversineKm', () => {
  it('is zero for identical points', () => {
    expect(haversineKm(base.location, base.location)).toBe(0);
  });
  it('London to Paris is about 344km', () => {
    const d = haversineKm({ lat: 51.5074, lng: -0.1278 }, { lat: 48.8566, lng: 2.3522 });
    expect(d).toBeGreaterThan(340);
    expect(d).toBeLessThan(348);
  });
});

describe('applyFilters', () => {
  const near = mk({
    id: 'near',
    name: 'Near Museum',
    categories: ['Museums'],
    dogFriendly: false,
    cost: { min: 8, max: 10 },
    ageRange: { min: 4, max: 10 },
    rating: 4,
  });
  const far = mk({
    id: 'far',
    name: 'Far Farm',
    location: { lat: 52.5, lng: -0.12 },
    cost: null,
    ageRange: null,
    dogFriendly: 'unknown',
    rating: 5,
  });
  const all = [near, far, mk({})];
  const f = defaultFilters();

  it('returns all with distance when no filters set', () => {
    expect(applyFilters(all, f)).toHaveLength(3);
  });
  it('filters by radius', () => {
    const r = applyFilters(all, { ...f, radiusKm: 25 });
    expect(r.map((x) => x.activity.id)).not.toContain('far');
  });
  it('filters by age group overlap, hiding activities without age data', () => {
    const r = applyFilters(all, { ...f, ageGroups: ['13-17'] });
    expect(r).toHaveLength(0);
    const r2 = applyFilters(all, { ...f, ageGroups: ['4-7'] });
    expect(r2.map((x) => x.activity.id).sort()).toEqual(['a', 'near']);
  });
  it('dog toggle only shows dog-friendly (explicit true)', () => {
    const r = applyFilters(all, { ...f, dogFriendly: true });
    expect(r.map((x) => x.activity.id)).toEqual(['a']);
  });
  it('filters by multiple categories (any match)', () => {
    const r = applyFilters(all, { ...f, categories: ['Museums', 'Sports'] });
    expect(r.map((x) => x.activity.id)).toEqual(['near']);
  });
  it('filters by cost range; unknown price excluded when a cost bound is set', () => {
    const r = applyFilters(all, { ...f, minCost: 5, maxCost: 15 });
    expect(r.map((x) => x.activity.id)).toEqual(['near']);
  });
  it('free filter (max 0) keeps free only', () => {
    const r = applyFilters(all, { ...f, maxCost: 0 });
    expect(r.map((x) => x.activity.id)).toEqual(['a']);
  });
  it('text search is case-insensitive and tolerates a typo', () => {
    expect(applyFilters(all, { ...f, query: 'MUSEUM' })).toHaveLength(1);
    expect(applyFilters(all, { ...f, query: 'musuem' }).map((x) => x.activity.id)).toEqual([
      'near',
    ]);
  });
  it('combines filters with AND logic', () => {
    const r = applyFilters(all, {
      ...f,
      dogFriendly: true,
      radiusKm: 10,
      ageGroups: ['0-3'],
      maxCost: 0,
    });
    expect(r.map((x) => x.activity.id)).toEqual(['a']);
  });
  it('sorts by distance, rating, cost, name', () => {
    expect(applyFilters(all, { ...f, sort: 'distance' })[2]?.activity.id).toBe('far');
    expect(applyFilters(all, { ...f, sort: 'rating' })[0]?.activity.id).toBe('far');
    expect(applyFilters(all, { ...f, sort: 'cost' })[0]?.activity.id).toBe('a');
    expect(applyFilters(all, { ...f, sort: 'cost' })[2]?.activity.id).toBe('far');
    expect(applyFilters(all, { ...f, sort: 'name' })[0]?.activity.name).toBe('Alpha Park');
  });
});

describe('cost helpers', () => {
  it('formats free, unknown, single and range', () => {
    expect(formatCost(null)).toBe('Price unknown');
    expect(formatCost({ min: 0, max: 0 })).toBe('Free');
    expect(formatCost({ min: 8, max: 8 })).toBe('£8.00');
    expect(formatCost({ min: 5, max: 10 })).toBe('£5.00–£10.00');
  });
  it('estimates family cost range', () => {
    expect(estimateFamilyCost({ min: 5, max: 10 }, 4)).toEqual({ min: 20, max: 40 });
    expect(estimateFamilyCost(null, 4)).toBeNull();
  });
});

describe('url state', () => {
  it('round-trips filters', () => {
    const f = {
      ...defaultFilters(),
      query: 'zoo',
      ageGroups: ['4-7' as const],
      radiusKm: 10,
      dogFriendly: true,
      categories: ['Outdoor' as const],
      minCost: 5,
      maxCost: 15,
      familySize: 3,
      sort: 'cost' as const,
      view: 'list' as const,
    };
    expect(searchToFilters(filtersToSearch(f))).toEqual(f);
  });
  it('omits defaults from the URL', () => {
    expect(filtersToSearch(defaultFilters())).toBe('');
  });
  it('ignores invalid/malicious params', () => {
    const f = searchToFilters(
      '?age=bogus&radius=-5&cat=Nope&sort=x&view=y&lat=abc&q=' + 'a'.repeat(500),
    );
    expect(f.ageGroups).toEqual([]);
    expect(f.radiusKm).toBeNull();
    expect(f.categories).toEqual([]);
    expect(f.sort).toBe('distance');
    expect(f.origin).toEqual(defaultFilters().origin);
    expect(f.query.length).toBeLessThanOrEqual(100);
  });
});
