import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthApi, type AuthState } from '../account/AuthProvider';
import SignIn, { safeNext } from './SignIn';

function renderSignIn(
  overrides: Partial<AuthApi> = {},
  state: AuthState = { status: 'anonymous' },
) {
  const api: AuthApi = {
    state,
    connect: vi.fn(async () => {}),
    sendCode: vi.fn(async () => ({ ok: true as const })),
    verifyCode: vi.fn(async () => ({ ok: true as const })),
    signOut: vi.fn(async () => {}),
    ...overrides,
  };
  const view = render(
    <AuthContext.Provider value={api}>
      <SignIn />
    </AuthContext.Provider>,
  );
  return { api, ...view };
}

async function requestCode(email = 'sam@trips.test') {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email address'), email);
  await user.click(screen.getByRole('button', { name: 'Email me a code' }));
  return user;
}

beforeEach(() => window.history.replaceState(null, '', '/sign-in?next=%2Fsaved'));

describe('safeNext', () => {
  it('only allows same-site paths', () => {
    expect(safeNext('/saved')).toBe('/saved');
    expect(safeNext('/?dog=1')).toBe('/?dog=1');
    expect(safeNext(null)).toBe('/');
    expect(safeNext('https://evil.example')).toBe('/');
    expect(safeNext('//evil.example')).toBe('/');
    expect(safeNext('/\\evil.example')).toBe('/');
    expect(safeNext('/sign-in')).toBe('/');
  });
});

describe('SignIn', () => {
  it('rejects an invalid email without sending anything', async () => {
    const { api } = renderSignIn();
    await requestCode('not-an-email');
    expect(screen.getByText('Enter an email address like name@example.com.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toHaveAttribute('aria-invalid', 'true');
    expect(api.sendCode).not.toHaveBeenCalled();
  });

  it('sends a code, then asks for it', async () => {
    const { api } = renderSignIn();
    await requestCode();
    expect(api.sendCode).toHaveBeenCalledWith('sam@trips.test');
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toHaveFocus();
    expect(
      screen.getByText(/We sent a sign-in link and code to sam@trips.test/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('6-digit code')).toHaveAttribute('autocomplete', 'one-time-code');
  });

  it('validates the code before verifying', async () => {
    const { api } = renderSignIn();
    const user = await requestCode();
    await user.type(await screen.findByLabelText('6-digit code'), '12a');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter the 6 digits from the email.')).toBeInTheDocument();
    expect(api.verifyCode).not.toHaveBeenCalled();
  });

  it('signs in with the code and goes to the requested page', async () => {
    const { api } = renderSignIn();
    const user = await requestCode();
    await user.type(await screen.findByLabelText('6-digit code'), ' 123 456 ');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(api.verifyCode).toHaveBeenCalledWith('sam@trips.test', '123456');
    await waitFor(() => expect(window.location.pathname).toBe('/saved'));
  });

  it('explains an expired code and can send a new one', async () => {
    const { api } = renderSignIn({
      verifyCode: vi.fn(async () => ({ ok: false as const, reason: 'expired' as const })),
    });
    const user = await requestCode();
    await user.type(await screen.findByLabelText('6-digit code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That code didn’t work');
    await user.click(screen.getByRole('button', { name: 'Send a new code' }));
    expect(api.sendCode).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['rateLimited', 'Too many attempts'],
    ['unavailable', 'Accounts aren’t available right now'],
    ['failed', 'We couldn’t sign you in'],
  ] as const)('shows a message when sending fails (%s)', async (reason, text) => {
    renderSignIn({ sendCode: vi.fn(async () => ({ ok: false as const, reason })) });
    await requestCode();
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
  });

  it('lets the user go back and change the email', async () => {
    renderSignIn();
    const user = await requestCode();
    await user.click(await screen.findByRole('button', { name: 'Use a different email' }));
    expect(screen.getByLabelText('Email address')).toHaveValue('sam@trips.test');
  });

  it('says accounts are unavailable when they are switched off', () => {
    renderSignIn({}, { status: 'disabled' });
    expect(screen.getByText(/Accounts aren’t available right now/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Email address')).not.toBeInTheDocument();
  });

  it('sends a signed-in user straight on', async () => {
    renderSignIn({}, { status: 'signedIn', user: { id: 'u1', email: 'sam@trips.test' } });
    await waitFor(() => expect(window.location.pathname).toBe('/saved'));
  });
});
