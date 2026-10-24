import { useSyncExternalStore } from 'react';

/**
 * A deliberately tiny router (specs/005-user-settings research R4): five flat
 * routes don't justify a routing library. nginx already serves index.html for
 * unknown paths.
 */
const ROUTES = {
  '/': 'search',
  '/saved': 'saved',
  '/settings': 'settings',
  '/sign-in': 'signIn',
  '/auth/callback': 'authCallback',
} as const;

export type RouteName = (typeof ROUTES)[keyof typeof ROUTES];

const NAV_EVENT = 'trips:navigate';

export function matchRoute(pathname: string): RouteName {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return (ROUTES as Record<string, RouteName>)[path] ?? 'search';
}

/** Changes page without a reload. `to` may include a query string. */
export function navigate(to: string, { replace = false }: { replace?: boolean } = {}) {
  if (replace) window.history.replaceState(null, '', to);
  else window.history.pushState(null, '', to);
  window.dispatchEvent(new Event(NAV_EVENT));
  window.scrollTo?.(0, 0);
}

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  window.addEventListener(NAV_EVENT, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(NAV_EVENT, onChange);
  };
}

/** The current route, re-rendering on navigate() and back/forward. */
export function useRoute(): RouteName {
  return useSyncExternalStore(subscribe, () => matchRoute(window.location.pathname));
}
