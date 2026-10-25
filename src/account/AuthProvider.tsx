import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import {
  accountConfig,
  accounts as defaultAccounts,
  hasStoredSession as storedSessionExists,
  type TripsClient,
} from './client';

export type AuthState =
  | { status: 'disabled' }
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'signedIn'; user: { id: string; email: string } };

export type AuthFailure = 'expired' | 'rateLimited' | 'unavailable' | 'failed';
export type AuthResult = { ok: true } | { ok: false; reason: AuthFailure };

export interface AuthApi {
  state: AuthState;
  /** Loads the client and restores any session; pages like the auth callback need it. */
  connect: () => Promise<void>;
  sendCode: (email: string) => Promise<AuthResult>;
  verifyCode: (email: string, code: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthApi | null>(null);

export function useAuth(): AuthApi {
  const api = useContext(AuthContext);
  if (!api) throw new Error('useAuth must be used inside <AuthProvider>');
  return api;
}

interface Accounts {
  enabled: boolean;
  getClient: () => Promise<TripsClient | null>;
}

const ANONYMOUS: AuthState = { status: 'anonymous' };

function fromSession(session: Pick<Session, 'user'> | null): AuthState {
  return session?.user
    ? { status: 'signedIn', user: { id: session.user.id, email: session.user.email ?? '' } }
    : ANONYMOUS;
}

/** Maps supabase-js AuthError fields to the reasons the UI explains. */
export function reasonFor(error: unknown): AuthFailure {
  const { status, code } = error as { status?: number; code?: string };
  if (status === 429 || code?.includes('rate_limit')) return 'rateLimited';
  if (code === 'otp_expired') return 'expired';
  if (!status) return 'unavailable'; // network failure or service down
  return 'failed';
}

function initialState(enabled: boolean, stored: boolean): AuthState {
  if (!enabled) return { status: 'disabled' };
  return stored ? { status: 'loading' } : ANONYMOUS;
}

export function AuthProvider({
  accounts = defaultAccounts,
  hasStoredSession = storedSessionExists(accountConfig),
  children,
}: {
  accounts?: Accounts;
  hasStoredSession?: boolean;
  children: ReactNode;
}) {
  const [state, setState] = useState<AuthState>(() =>
    initialState(accounts.enabled, hasStoredSession),
  );
  const [client, setClient] = useState<TripsClient | null>(null);
  const loading = useRef<Promise<TripsClient | null> | null>(null);

  const ensureClient = useCallback((): Promise<TripsClient | null> => {
    loading.current ??= accounts.getClient().then(
      async (c) => {
        if (!c) return null;
        setClient(c);
        const { data } = await c.auth.getSession();
        setState(fromSession(data.session));
        return c;
      },
      () => {
        loading.current = null; // retry on the next attempt
        setState((s) => (s.status === 'loading' ? ANONYMOUS : s));
        return null;
      },
    );
    return loading.current;
  }, [accounts]);

  // Restore a stored session straight away; otherwise wait until it's needed.
  useEffect(() => {
    if (accounts.enabled && hasStoredSession) void ensureClient();
  }, [accounts.enabled, hasStoredSession, ensureClient]);

  // Follow sign-in/out from other tabs and token refreshes. Subscribing in an
  // effect keyed on the client keeps StrictMode's double-mount safe.
  useEffect(() => {
    if (!client) return;
    const { data } = client.auth.onAuthStateChange((_event, session) =>
      setState(fromSession(session)),
    );
    return () => data.subscription.unsubscribe();
  }, [client]);

  const api = useMemo<AuthApi>(
    () => ({
      state,
      connect: async () => {
        await ensureClient();
      },
      sendCode: async (rawEmail) => {
        const c = await ensureClient();
        if (!c) return { ok: false, reason: 'unavailable' };
        const { error } = await c.auth.signInWithOtp({
          email: rawEmail.trim().toLowerCase(),
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            shouldCreateUser: true,
          },
        });
        return error ? { ok: false, reason: reasonFor(error) } : { ok: true };
      },
      verifyCode: async (email, code) => {
        const c = await ensureClient();
        if (!c) return { ok: false, reason: 'unavailable' };
        const { data, error } = await c.auth.verifyOtp({ email, token: code, type: 'email' });
        if (error) return { ok: false, reason: reasonFor(error) };
        setState(fromSession(data.session));
        return { ok: true };
      },
      signOut: async () => {
        const c = await ensureClient();
        await c?.auth.signOut({ scope: 'local' });
        setState(ANONYMOUS);
      },
    }),
    [state, ensureClient],
  );

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}
