import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthApi, type AuthState } from '../account/AuthProvider';
import AuthCallback from './AuthCallback';
import { NEXT_KEY } from './next';

function renderCallback(state: AuthState, connect = vi.fn(async () => {})) {
  const api: AuthApi = {
    state,
    connect,
    sendCode: vi.fn(),
    verifyCode: vi.fn(),
    signOut: vi.fn(),
  };
  const view = render(
    <AuthContext.Provider value={api}>
      <AuthCallback />
    </AuthContext.Provider>,
  );
  return {
    connect,
    rerender: (s: AuthState) =>
      view.rerender(
        <AuthContext.Provider value={{ ...api, state: s }}>
          <AuthCallback />
        </AuthContext.Provider>,
      ),
  };
}

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, '', '/auth/callback?code=abc');
});

describe('AuthCallback', () => {
  it('connects so supabase-js can exchange the code', () => {
    const { connect } = renderCallback({ status: 'loading' });
    expect(connect).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Signing you in…');
  });

  it('goes to the page sign-in started from once signed in', async () => {
    window.localStorage.setItem(NEXT_KEY, '/saved');
    const { rerender } = renderCallback({ status: 'loading' });
    rerender({ status: 'signedIn', user: { id: 'u1', email: 'sam@trips.test' } });
    await waitFor(() => expect(window.location.pathname).toBe('/saved'));
    expect(window.localStorage.getItem(NEXT_KEY)).toBeNull();
  });

  it('ignores an unsafe stored destination', async () => {
    window.localStorage.setItem(NEXT_KEY, '//evil.example');
    renderCallback({ status: 'signedIn', user: { id: 'u1', email: 'sam@trips.test' } });
    await waitFor(() => expect(window.location.pathname).toBe('/'));
  });

  it('explains an expired or used link', async () => {
    window.history.replaceState(
      null,
      '',
      '/auth/callback?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    );
    renderCallback({ status: 'anonymous' });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This sign-in link has expired or was already used.',
    );
    expect(screen.getByRole('link', { name: 'Request a new code' })).toHaveAttribute(
      'href',
      '/sign-in',
    );
  });

  it('fails when connecting leaves the visitor signed out', async () => {
    const { rerender } = renderCallback({ status: 'loading' });
    rerender({ status: 'anonymous' });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
