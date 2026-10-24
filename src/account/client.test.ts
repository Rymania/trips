import { describe, expect, it, vi } from 'vitest';
import { createAccountClient, hasStoredSession, readConfig, storageKeyFor } from './client';

const config = { url: 'https://abcd1234.supabase.co', key: 'sb_publishable_test' };

describe('readConfig', () => {
  it('returns null when either setting is missing or blank', () => {
    expect(readConfig({})).toBeNull();
    expect(readConfig({ VITE_SUPABASE_URL: config.url })).toBeNull();
    expect(readConfig({ VITE_SUPABASE_URL: ' ', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' })).toBeNull();
  });

  it('returns trimmed settings when both are present', () => {
    expect(
      readConfig({
        VITE_SUPABASE_URL: ` ${config.url} `,
        VITE_SUPABASE_PUBLISHABLE_KEY: config.key,
      }),
    ).toEqual(config);
  });
});

describe('createAccountClient', () => {
  it('reports accounts as disabled and never loads the library without config', async () => {
    const load = vi.fn();
    const accounts = createAccountClient(null, load);
    expect(accounts.enabled).toBe(false);
    expect(await accounts.getClient()).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it('loads the library lazily and only once', async () => {
    const client = { auth: {} };
    const createClient = vi.fn(() => client);
    const load = vi.fn(async () => ({ createClient }));
    const accounts = createAccountClient(config, load);

    expect(load).not.toHaveBeenCalled();
    const [first, second] = await Promise.all([accounts.getClient(), accounts.getClient()]);
    expect(first).toBe(client);
    expect(second).toBe(client);
    expect(load).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith(
      config.url,
      config.key,
      expect.objectContaining({ auth: expect.objectContaining({ flowType: 'pkce' }) }),
    );
  });

  it('lets a later call retry after the library fails to load', async () => {
    const client = { auth: {} };
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ createClient: () => client });
    const accounts = createAccountClient(config, load);
    await expect(accounts.getClient()).rejects.toThrow('offline');
    expect(await accounts.getClient()).toBe(client);
  });
});

describe('hasStoredSession', () => {
  it('uses the same storage key as supabase-js', () => {
    expect(storageKeyFor(config.url)).toBe('sb-abcd1234-auth-token');
    expect(storageKeyFor('http://127.0.0.1:54321')).toBe('sb-127-auth-token');
  });

  it('is true only when a session is stored', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null };
    expect(hasStoredSession(config, storage)).toBe(false);
    store.set('sb-abcd1234-auth-token', '{"access_token":"x"}');
    expect(hasStoredSession(config, storage)).toBe(true);
  });

  it('is false when accounts are off or storage throws', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
    };
    expect(hasStoredSession(null, throwing)).toBe(false);
    expect(hasStoredSession(config, throwing)).toBe(false);
  });
});
