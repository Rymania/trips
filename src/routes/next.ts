import { matchRoute } from './useRoute';

/** Where the sign-in flow returns to; the emailed link can't carry it, so it's stored. */
export const NEXT_KEY = 'trips.signInNext';

/** Only same-site paths, and never back to the sign-in flow itself (no open redirects). */
export function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  const route = matchRoute(new URL(raw, window.location.origin).pathname);
  return route === 'signIn' || route === 'authCallback' ? '/' : raw;
}

export function rememberNext(next: string) {
  try {
    window.localStorage.setItem(NEXT_KEY, next);
  } catch {
    /* storage unavailable: the callback falls back to search */
  }
}

export function takeNext(): string {
  try {
    const raw = window.localStorage.getItem(NEXT_KEY);
    window.localStorage.removeItem(NEXT_KEY);
    return safeNext(raw);
  } catch {
    return '/';
  }
}
