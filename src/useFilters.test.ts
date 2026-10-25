import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Filters } from './domain/types';
import { useFilters } from './useFilters';

const BRIGHTON: Partial<Filters> = {
  origin: { lat: 50.8225, lng: -0.1372 },
  originLabel: 'Brighton',
};

beforeEach(() => window.history.replaceState(null, '', '/'));

describe('useFilters defaults', () => {
  it('starts from the defaults when the URL has no location', () => {
    const { result } = renderHook(() => useFilters(BRIGHTON));
    expect(result.current[0].originLabel).toBe('Brighton');
    expect(result.current[0].origin).toEqual(BRIGHTON.origin);
  });

  it('lets a location in the URL win', () => {
    window.history.replaceState(null, '', '/?lat=51.752&lng=-1.2577&place=Oxford');
    const { result } = renderHook(() => useFilters(BRIGHTON));
    expect(result.current[0].originLabel).toBe('Oxford');
  });

  it('applies defaults that arrive after the first render', () => {
    window.history.replaceState(null, '', '/?dog=1');
    const { result, rerender } = renderHook(({ d }) => useFilters(d), {
      initialProps: { d: null as Partial<Filters> | null },
    });
    expect(result.current[0].originLabel).toBe('London');
    rerender({ d: BRIGHTON });
    expect(result.current[0].originLabel).toBe('Brighton');
    expect(result.current[0].dogFriendly).toBe(true);
  });

  it('does not undo a location the user already chose', () => {
    const { result, rerender } = renderHook(({ d }) => useFilters(d), {
      initialProps: { d: null as Partial<Filters> | null },
    });
    act(() =>
      result.current[1]({ origin: { lat: 51.4545, lng: -2.5879 }, originLabel: 'Bristol' }),
    );
    rerender({ d: BRIGHTON });
    expect(result.current[0].originLabel).toBe('Bristol');
  });

  it('works as before without defaults', () => {
    const { result } = renderHook(() => useFilters());
    expect(result.current[0].originLabel).toBe('London');
  });
});

describe('useFilters family defaults', () => {
  const FAMILY: Partial<Filters> = { ageGroups: ['4-7'], familySize: 3, dogFriendly: true };

  it('apply when the URL has no filters', () => {
    const { result } = renderHook(() => useFilters(FAMILY));
    expect(result.current[0]).toMatchObject(FAMILY);
    expect(window.location.search).toBe('?age=4-7&dog=1&fam=3');
  });

  it('apply alongside a location, sort or view in the URL', () => {
    window.history.replaceState(null, '', '/?lat=51.752&lng=-1.2577&place=Oxford&view=map');
    const { result } = renderHook(() => useFilters({ ...FAMILY, ...BRIGHTON }));
    expect(result.current[0]).toMatchObject({ ...FAMILY, originLabel: 'Oxford', view: 'map' });
  });

  it('are ignored entirely when the URL has any filter', () => {
    window.history.replaceState(null, '', '/?q=zoo');
    const { result } = renderHook(() => useFilters({ ...FAMILY, ...BRIGHTON }));
    expect(result.current[0]).toMatchObject({
      query: 'zoo',
      ageGroups: [],
      familySize: 4,
      dogFriendly: false,
      originLabel: 'Brighton',
    });
  });
});
