import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { authError, fakeAccounts, fakeAuthClient, session } from '../test/fakeAuthClient';
import { AuthProvider, useAuth } from './AuthProvider';

function setup({
  stored = false,
  initial = null as ReturnType<typeof session> | null,
  enabled = true,
} = {}) {
  const fake = fakeAuthClient(initial);
  const accounts = fakeAccounts(fake.client, enabled);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider accounts={accounts} hasStoredSession={stored}>
      {children}
    </AuthProvider>
  );
  const hook = renderHook(() => useAuth(), { wrapper });
  return { ...fake, accounts, hook };
}

describe('AuthProvider', () => {
  it('is disabled and never loads the client when accounts are off', () => {
    const { hook, accounts } = setup({ enabled: false });
    expect(hook.result.current.state).toEqual({ status: 'disabled' });
    expect(accounts.getClient).not.toHaveBeenCalled();
  });

  it('starts anonymous without loading the client when no session is stored', () => {
    const { hook, accounts } = setup();
    expect(hook.result.current.state).toEqual({ status: 'anonymous' });
    expect(accounts.getClient).not.toHaveBeenCalled();
  });

  it('restores a stored session', async () => {
    const { hook } = setup({ stored: true, initial: session('a@trips.test', 'id-a') });
    expect(hook.result.current.state).toEqual({ status: 'loading' });
    await waitFor(() =>
      expect(hook.result.current.state).toEqual({
        status: 'signedIn',
        user: { id: 'id-a', email: 'a@trips.test' },
      }),
    );
  });

  it('falls back to anonymous when the stored session is no longer valid', async () => {
    const { hook } = setup({ stored: true, initial: null });
    await waitFor(() => expect(hook.result.current.state).toEqual({ status: 'anonymous' }));
  });

  it('falls back to anonymous when the client cannot load', async () => {
    const fake = fakeAuthClient(null);
    const accounts = { enabled: true, getClient: vi.fn().mockRejectedValue(new Error('offline')) };
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthProvider accounts={accounts} hasStoredSession>
          {children}
        </AuthProvider>
      ),
    });
    await waitFor(() => expect(result.current.state).toEqual({ status: 'anonymous' }));
    let res;
    await act(async () => {
      res = await result.current.sendCode('a@trips.test');
    });
    expect(res).toEqual({ ok: false, reason: 'unavailable' });
    expect(fake.auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('sends a code with a redirect back to the callback page', async () => {
    const { hook, auth } = setup();
    let res;
    await act(async () => {
      res = await hook.result.current.sendCode(' A@Trips.test ');
    });
    expect(res).toEqual({ ok: true });
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'a@trips.test',
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: true,
      },
    });
  });

  it.each([
    [authError(429, 'over_email_send_rate_limit'), 'rateLimited'],
    [authError(0, 'unexpected_failure'), 'unavailable'],
    [authError(400, 'validation_failed'), 'failed'],
  ])('maps send errors to a reason', async (error, reason) => {
    const { hook, auth } = setup();
    auth.signInWithOtp.mockResolvedValueOnce({ data: {}, error });
    let res;
    await act(async () => {
      res = await hook.result.current.sendCode('a@trips.test');
    });
    expect(res).toEqual({ ok: false, reason });
  });

  it('signs in with a valid code', async () => {
    const { hook, auth } = setup();
    let res;
    await act(async () => {
      res = await hook.result.current.verifyCode('a@trips.test', '123456');
    });
    expect(res).toEqual({ ok: true });
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: 'a@trips.test',
      token: '123456',
      type: 'email',
    });
    expect(hook.result.current.state).toMatchObject({
      status: 'signedIn',
      user: { email: 'a@trips.test' },
    });
  });

  it('reports an expired code', async () => {
    const { hook, auth } = setup();
    auth.verifyOtp.mockResolvedValueOnce({
      data: { session: null as never },
      error: authError(403, 'otp_expired'),
    });
    let res;
    await act(async () => {
      res = await hook.result.current.verifyCode('a@trips.test', '000000');
    });
    expect(res).toEqual({ ok: false, reason: 'expired' });
    expect(hook.result.current.state).toEqual({ status: 'anonymous' });
  });

  it('signs out on this device only', async () => {
    const { hook, auth } = setup({ stored: true, initial: session() });
    await waitFor(() => expect(hook.result.current.state.status).toBe('signedIn'));
    await act(() => hook.result.current.signOut());
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(hook.result.current.state).toEqual({ status: 'anonymous' });
  });

  it('follows sign-out from another tab', async () => {
    const { hook, emit } = setup({ stored: true, initial: session() });
    await waitFor(() => expect(hook.result.current.state.status).toBe('signedIn'));
    act(() => emit('SIGNED_OUT', null));
    expect(hook.result.current.state).toEqual({ status: 'anonymous' });
  });

  it('connect() loads the client once for pages that need it', async () => {
    const { hook, accounts } = setup();
    await act(() => hook.result.current.connect());
    await act(() => hook.result.current.connect());
    expect(accounts.getClient).toHaveBeenCalledTimes(1);
  });
});
