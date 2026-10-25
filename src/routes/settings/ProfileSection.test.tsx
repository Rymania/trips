import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { profile, renderWithAccount } from '../../test/contexts';
import { ProfileSection } from './ProfileSection';

const BRIGHTON = { name: 'Brighton', lat: 50.8225, lng: -0.1372 };

function setup(over: Parameters<typeof renderWithAccount>[1] = {}) {
  const user = userEvent.setup();
  const view = renderWithAccount(<ProfileSection />, {
    profile: { profile: profile({ displayName: 'Sam' }) },
    ...over,
  });
  const details = within(screen.getByRole('form', { name: 'Your details' }));
  return { user, details, ...view };
}

describe('ProfileSection', () => {
  it('requires a name of 1 to 50 characters', async () => {
    const { user, details, profile: api } = setup();
    const name = details.getByLabelText('Display name');
    expect(name).toHaveValue('Sam');

    await user.clear(name);
    await user.type(name, '   ');
    await user.click(details.getByRole('button', { name: 'Save details' }));
    expect(details.getByText('Enter a name of 1 to 50 characters.')).toBeInTheDocument();
    expect(name).toHaveAttribute('aria-invalid', 'true');

    await user.clear(name);
    await user.type(name, 'x'.repeat(51));
    await user.click(details.getByRole('button', { name: 'Save details' }));
    expect(details.getByText('Enter a name of 1 to 50 characters.')).toBeInTheDocument();
    expect(api.save).not.toHaveBeenCalled();
  });

  it('saves a trimmed name and a home location from the place search', async () => {
    const { user, details, profile: api } = setup();
    await user.clear(details.getByLabelText('Display name'));
    await user.type(details.getByLabelText('Display name'), '  Sam R  ');
    await user.type(details.getByLabelText('Home location'), 'bright');
    await user.click(details.getByRole('button', { name: 'Save details' }));

    expect(api.save).toHaveBeenCalledWith({ displayName: 'Sam R', home: BRIGHTON });
    expect(details.getByRole('status')).toHaveTextContent('Details saved');
    expect(details.getByLabelText('Home location')).toHaveValue('Brighton');
  });

  it('suggests places while typing', async () => {
    const { user, details } = setup();
    await user.type(details.getByLabelText('Home location'), 'Bri');
    const options = document.querySelectorAll('datalist option');
    expect([...options].map((o) => o.getAttribute('value'))).toEqual(['Brighton', 'Bristol']);
  });

  it('rejects a place it cannot find, and can clear the home location', async () => {
    const {
      user,
      details,
      profile: api,
    } = setup({
      profile: { profile: profile({ displayName: 'Sam', home: BRIGHTON }) },
    });
    const home = details.getByLabelText('Home location');
    expect(home).toHaveValue('Brighton');

    await user.clear(home);
    await user.type(home, 'Atlantis');
    await user.click(details.getByRole('button', { name: 'Save details' }));
    expect(details.getByText(/Place not found/)).toBeInTheDocument();
    expect(api.save).not.toHaveBeenCalled();

    await user.clear(home);
    await user.click(details.getByRole('button', { name: 'Save details' }));
    expect(api.save).toHaveBeenCalledWith({ displayName: 'Sam', home: null });
  });

  it('keeps the saved home location when it is unchanged', async () => {
    const custom = { name: '51.5, -0.1', lat: 51.5, lng: -0.1 };
    const {
      user,
      details,
      profile: api,
    } = setup({
      profile: { profile: profile({ displayName: 'Sam', home: custom }) },
    });
    await user.click(details.getByRole('button', { name: 'Save details' }));
    expect(api.save).toHaveBeenCalledWith({ displayName: 'Sam', home: custom });
  });

  it('explains when saving fails', async () => {
    const { user, details } = setup({
      profile: { profile: profile({ displayName: 'Sam' }), save: vi.fn(async () => false) },
    });
    await user.click(details.getByRole('button', { name: 'Save details' }));
    expect(details.getByRole('alert')).toHaveTextContent('couldn’t save your details');
  });

  it('shows loading, and a retry when the profile fails to load', async () => {
    const user = userEvent.setup();
    const { profile: api, unmount } = renderWithAccount(<ProfileSection />, {
      profile: { status: 'loading', profile: null },
    });
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    unmount();

    const failed = renderWithAccount(<ProfileSection />, {
      profile: { status: 'error', profile: null },
    });
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(failed.profile.reload).toHaveBeenCalled();
    expect(api.reload).not.toHaveBeenCalled();
  });
});

describe('ProfileSection: email', () => {
  const emailForm = () => within(screen.getByRole('form', { name: 'Sign-in email' }));

  it('confirms a change from the new address', async () => {
    const { user, profile: api } = setup();
    const form = emailForm();
    expect(form.getByText('sam@trips.test')).toBeInTheDocument();

    await user.type(form.getByLabelText('New email address'), 'new@trips.test');
    await user.click(form.getByRole('button', { name: 'Change email' }));
    expect(api.changeEmail).toHaveBeenCalledWith('new@trips.test');
    expect(form.getByRole('status')).toHaveTextContent(
      'Check new@trips.test and follow the link to confirm',
    );
    expect(form.getByRole('status')).toHaveTextContent('sam@trips.test');
  });

  it('validates the new address', async () => {
    const { user, profile: api } = setup();
    const form = emailForm();
    const input = form.getByLabelText('New email address');

    await user.type(input, 'not-an-email');
    await user.click(form.getByRole('button', { name: 'Change email' }));
    expect(form.getByText(/Enter an email address like/)).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, 'SAM@trips.test');
    await user.click(form.getByRole('button', { name: 'Change email' }));
    expect(form.getByText('That’s already your email address.')).toBeInTheDocument();
    expect(api.changeEmail).not.toHaveBeenCalled();
  });

  it('explains a failed change', async () => {
    const { user } = setup({
      profile: {
        profile: profile(),
        changeEmail: vi.fn(async () => ({ ok: false as const, reason: 'rateLimited' as const })),
      },
    });
    const form = emailForm();
    await user.type(form.getByLabelText('New email address'), 'new@trips.test');
    await user.click(form.getByRole('button', { name: 'Change email' }));
    expect(form.getByRole('alert')).toHaveTextContent('Too many attempts');
  });
});
