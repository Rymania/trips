import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * The only module that knows about Supabase configuration. The library itself
 * is loaded on demand (specs/005-user-settings research R3) so anonymous
 * browsing doesn't pay for it.
 */
export type TripsClient = SupabaseClient<Database>;

export interface AccountConfig {
  url: string;
  key: string;
}

interface Env {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

/** Both settings are public; missing or blank means accounts are switched off. */
export function readConfig(env: Env): AccountConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  return url && key ? { url, key } : null;
}

type Loader = () => Promise<{
  createClient: (url: string, key: string, options: object) => unknown;
}>;

export function createAccountClient(config: AccountConfig | null, load: Loader) {
  let pending: Promise<TripsClient> | null = null;
  return {
    enabled: config !== null,
    /** Resolves to the shared client, or null when accounts are off. */
    getClient(): Promise<TripsClient | null> {
      if (!config) return Promise.resolve(null);
      pending ??= load().then(
        ({ createClient }) =>
          createClient(config.url, config.key, {
            auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true },
          }) as TripsClient,
        (err: unknown) => {
          pending = null; // let the next call retry, e.g. after going back online
          throw err;
        },
      );
      return pending;
    },
  };
}

/** Mirrors supabase-js's default storage key: `sb-<first host label>-auth-token`. */
export function storageKeyFor(url: string): string {
  return `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
}

/**
 * Whether a session is stored on this device, without loading supabase-js, so
 * the header can show the account placeholder straight away.
 */
export function hasStoredSession(
  config: AccountConfig | null,
  storage: Pick<Storage, 'getItem'> = window.localStorage,
): boolean {
  if (!config) return false;
  try {
    return storage.getItem(storageKeyFor(config.url)) !== null;
  } catch {
    return false;
  }
}

export const accountConfig = readConfig(import.meta.env as Env);
export const accounts = createAccountClient(accountConfig, () => import('@supabase/supabase-js'));
