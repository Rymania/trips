import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { matchRoute, navigate, useRoute } from './useRoute';

beforeEach(() => window.history.replaceState(null, '', '/'));

describe('matchRoute', () => {
  it('maps known paths, ignoring a trailing slash', () => {
    expect(matchRoute('/')).toBe('search');
    expect(matchRoute('/saved')).toBe('saved');
    expect(matchRoute('/settings/')).toBe('settings');
    expect(matchRoute('/sign-in')).toBe('signIn');
    expect(matchRoute('/auth/callback')).toBe('authCallback');
  });

  it('falls back to search for unknown paths', () => {
    expect(matchRoute('/nope')).toBe('search');
    expect(matchRoute('')).toBe('search');
  });
});

describe('useRoute', () => {
  it('follows navigate() and keeps the query string', () => {
    const { result } = renderHook(() => useRoute());
    expect(result.current).toBe('search');

    act(() => navigate('/settings?section=family'));
    expect(result.current).toBe('settings');
    expect(window.location.pathname).toBe('/settings');
    expect(window.location.search).toBe('?section=family');
  });

  it('replace does not add a history entry', () => {
    const { result } = renderHook(() => useRoute());
    const before = window.history.length;
    act(() => navigate('/saved', { replace: true }));
    expect(result.current).toBe('saved');
    expect(window.history.length).toBe(before);
  });

  it('updates on back and forward', () => {
    const { result } = renderHook(() => useRoute());
    act(() => navigate('/saved'));
    act(() => {
      window.history.replaceState(null, '', '/sign-in');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current).toBe('signIn');
  });

  it('scrolls to the top on a new page', () => {
    window.scrollTo = vi.fn();
    renderHook(() => useRoute());
    act(() => navigate('/saved'));
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });
});
