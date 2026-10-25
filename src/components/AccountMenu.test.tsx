import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthApi, type AuthState } from '../account/AuthProvider';
import { profile, renderWithAccount } from '../test/contexts';
import { AccountMenu } from './AccountMenu';

function renderWith(state: AuthState, overrides: Partial<AuthApi> = {}) {
  const api: AuthApi = {
    state,
    connect: vi.fn(async () => {}),
    sendCode: vi.fn(),
    verifyCode: vi.fn(),
    signOut: vi.fn(async () => {}),
    ...overrides,
  };
  render(
    <AuthContext.Provider value={api}>
      <AccountMenu />
    </AuthContext.Provider>,
  );
  return api;
}

const signedIn: AuthState = { status: 'signedIn', user: { id: 'u1', email: 'sam@trips.test' } };

beforeEach(() => window.history.replaceState(null, '', '/?dog=1'));

describe('AccountMenu', () => {
  it('renders nothing when accounts are off', () => {
    const { container } = render(
      <AuthContext.Provider
        value={{
          state: { status: 'disabled' },
          connect: vi.fn(),
          sendCode: vi.fn(),
          verifyCode: vi.fn(),
          signOut: vi.fn(),
        }}
      >
        <AccountMenu />
      </AuthContext.Provider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('offers sign-in that returns to the current page', async () => {
    const user = userEvent.setup();
    renderWith({ status: 'anonymous' });
    const link = screen.getByRole('link', { name: 'Sign in' });
    expect(link).toHaveAttribute('href', '/sign-in?next=%2F%3Fdog%3D1');
    await user.click(link);
    expect(window.location.pathname).toBe('/sign-in');
  });

  it('shows a busy placeholder while the session loads', () => {
    renderWith({ status: 'loading' });
    expect(screen.getByText('Loading your account…')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('opens a menu of account links when signed in', async () => {
    const user = userEvent.setup();
    renderWith(signedIn);
    const toggle = screen.getByRole('button', { name: 'Account menu for sam@trips.test' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Signed in as sam@trips.test')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Saved trips' })).toHaveAttribute('href', '/saved');
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
  });

  it('closes on Escape and returns focus to the toggle', async () => {
    const user = userEvent.setup();
    renderWith(signedIn);
    const toggle = screen.getByRole('button', { name: /Account menu/ });
    await user.click(toggle);
    await user.keyboard('{Escape}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
  });

  it('closes when focus leaves the menu', async () => {
    const user = userEvent.setup();
    render(
      <>
        <AuthContext.Provider
          value={{
            state: signedIn,
            connect: vi.fn(),
            sendCode: vi.fn(),
            verifyCode: vi.fn(),
            signOut: vi.fn(),
          }}
        >
          <AccountMenu />
        </AuthContext.Provider>
        <button type="button">Elsewhere</button>
      </>,
    );
    await user.click(screen.getByRole('button', { name: /Account menu/ }));
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
  });

  it('signs out and goes back to search', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/settings');
    const api = renderWith(signedIn);
    await user.click(screen.getByRole('button', { name: /Account menu/ }));
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(api.signOut).toHaveBeenCalled();
    expect(window.location.pathname).toBe('/');
  });

  it('shows the display name once the profile has one', async () => {
    const user = userEvent.setup();
    renderWithAccount(<AccountMenu />, {
      profile: { profile: profile({ displayName: 'Sam Rivers' }) },
    });
    const toggle = screen.getByRole('button', { name: 'Account menu for Sam Rivers' });
    expect(toggle).toHaveTextContent('SSam Rivers');
    await user.click(toggle);
    expect(screen.getByText('Signed in as sam@trips.test')).toBeInTheDocument();
  });
});
