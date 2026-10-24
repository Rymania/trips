import { vi } from 'vitest';
import type { TripsClient } from '../account/client';

type Listener = (event: string, session: FakeSession | null) => void;
export interface FakeSession {
  user: { id: string; email: string };
}

export const session = (email = 'parent@trips.test', id = 'user-1'): FakeSession => ({
  user: { id, email },
});

/** An auth error shaped like supabase-js's AuthError. */
export const authError = (status: number, code?: string) =>
  Object.assign(new Error(code ?? `status ${status}`), { status, code });

/** Just enough of supabase-js's auth client for the account UI. */
export function fakeAuthClient(initial: FakeSession | null = null) {
  let current = initial;
  const listeners = new Set<Listener>();
  const emit = (event: string, s: FakeSession | null) => {
    current = s;
    listeners.forEach((l) => l(event, s));
  };
  const auth = {
    getSession: vi.fn(async () => ({ data: { session: current }, error: null })),
    onAuthStateChange: vi.fn((cb: Listener) => {
      listeners.add(cb);
      return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
    }),
    signInWithOtp: vi.fn(async () => ({
      data: {},
      error: null as Error | null,
    })),
    verifyOtp: vi.fn(async ({ email }: { email: string; token: string; type: string }) => {
      const s = session(email);
      emit('SIGNED_IN', s);
      return { data: { session: s }, error: null as Error | null };
    }),
    signOut: vi.fn(async () => {
      emit('SIGNED_OUT', null);
      return { error: null };
    }),
  };
  return {
    client: { auth } as unknown as TripsClient,
    auth,
    /** Simulates an auth event arriving from supabase-js, e.g. from another tab. */
    emit,
  };
}

/** An `accounts` object (see createAccountClient) around a fake client. */
export function fakeAccounts(client: TripsClient | null, enabled = true) {
  return { enabled, getClient: vi.fn(async () => client) };
}
