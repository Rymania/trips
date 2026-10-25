import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderWithAccount } from '../../test/contexts';
import Settings from './Settings';

beforeEach(() => window.history.replaceState(null, '', '/settings'));

describe('Settings', () => {
  it('asks signed-out visitors to sign in, returning here', () => {
    renderWithAccount(<Settings />, { auth: { status: 'anonymous' } });
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/sign-in?next=%2Fsettings',
    );
    expect(screen.queryByRole('form', { name: 'Your details' })).not.toBeInTheDocument();
  });

  it('explains when accounts are switched off', () => {
    renderWithAccount(<Settings />, { auth: { status: 'disabled' } });
    expect(screen.getByText(/Accounts aren’t available/)).toBeInTheDocument();
  });

  it('waits while the session loads', () => {
    renderWithAccount(<Settings />, { auth: { status: 'loading' } });
    expect(screen.getByRole('status')).toHaveTextContent('Loading your account…');
  });

  it('links to each section', () => {
    renderWithAccount(<Settings />);
    expect(screen.getByRole('heading', { level: 2, name: 'Settings' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Settings sections' });
    expect(nav).toContainElement(screen.getByRole('link', { name: 'Profile' }));
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '#profile');
    expect(screen.getByRole('region', { name: 'Profile' })).toHaveAttribute('id', 'profile');
    expect(screen.getByRole('link', { name: 'Family' })).toHaveAttribute('href', '#family');
    expect(screen.getByRole('region', { name: 'Family' })).toHaveAttribute('id', 'family');
    expect(screen.getByRole('link', { name: 'Appearance' })).toHaveAttribute('href', '#appearance');
  });
});
