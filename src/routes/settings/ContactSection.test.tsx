import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ContactContext } from '../../account/ProfileProvider';
import type { ContactPreference } from '../../account/types';
import { contactApi, profile, renderWithAccount } from '../../test/contexts';
import { ContactSection } from './ContactSection';

const at = (d: number, h: number, m: number) => new Date(2026, 9, d, h, m).toISOString();
const DIGEST: ContactPreference = {
  topic: 'nearby_digest',
  optedIn: true,
  frequency: 'monthly',
  changedAt: at(1, 10, 0),
};
const HOME = { name: 'Brighton', lat: 50.8, lng: -0.1 };

const news = () => screen.getByRole('checkbox', { name: /Product news/ });
const digest = () => screen.getByRole('checkbox', { name: /New activities near home/ });

describe('ContactSection', () => {
  it('has every option off for a new account, and says account emails always go', () => {
    renderWithAccount(<ContactSection />);
    expect(screen.getByRole('region', { name: 'Email preferences' })).toHaveAttribute(
      'id',
      'contact',
    );
    expect(news()).not.toBeChecked();
    expect(digest()).not.toBeChecked();
    expect(screen.queryByRole('group', { name: 'How often' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Last changed/)).not.toBeInTheDocument();
    expect(screen.getByText(/sign-in codes.*always sent/)).toBeInTheDocument();
  });

  it('saves each choice as it changes', async () => {
    const user = userEvent.setup();
    const { contact } = renderWithAccount(<ContactSection />);
    await user.click(news());
    expect(contact.set).toHaveBeenCalledWith('product_news', { optedIn: true, frequency: null });
    await user.click(digest());
    expect(contact.set).toHaveBeenCalledWith('nearby_digest', {
      optedIn: true,
      frequency: 'weekly',
    });
  });

  it('asks how often only for the digest, once it is on', async () => {
    const user = userEvent.setup();
    const { contact } = renderWithAccount(<ContactSection />, {
      contact: { prefs: [DIGEST] },
      profile: { profile: profile({ home: HOME }) },
    });
    const often = screen.getByRole('group', { name: 'How often' });
    expect(screen.getByRole('radio', { name: 'Monthly' })).toBeChecked();
    expect(often).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Weekly' }));
    expect(contact.set).toHaveBeenCalledWith('nearby_digest', {
      optedIn: true,
      frequency: 'weekly',
    });

    // Turning it off keeps the frequency for next time.
    await user.click(digest());
    expect(contact.set).toHaveBeenLastCalledWith('nearby_digest', {
      optedIn: false,
      frequency: 'monthly',
    });
  });

  it('shows when each choice last changed, updating as it changes', async () => {
    const user = userEvent.setup();
    function Stateful() {
      const [prefs, setPrefs] = useState<ContactPreference[]>([DIGEST]);
      const api = contactApi({
        prefs,
        set: async (topic, c) => {
          setPrefs((p) => [
            ...p.filter((x) => x.topic !== topic),
            { topic, ...c, changedAt: at(25, 14, 5) },
          ]);
          return true;
        },
      });
      return (
        <ContactContext.Provider value={api}>
          <ContactSection />
        </ContactContext.Provider>
      );
    }
    renderWithAccount(<Stateful />, { profile: { profile: profile({ home: HOME }) } });
    expect(screen.getByText('Last changed 1 Oct 2026, 10:00')).toBeInTheDocument();

    await user.click(digest());
    expect(digest()).not.toBeChecked();
    expect(screen.getByText('Last changed 25 Oct 2026, 14:05')).toBeInTheDocument();
  });

  it('suggests a home location when the digest is on without one', () => {
    renderWithAccount(<ContactSection />, { contact: { prefs: [DIGEST] } });
    expect(screen.getByRole('link', { name: 'Add a home location' })).toHaveAttribute(
      'href',
      '#profile',
    );
  });

  it('explains a failed save', async () => {
    const user = userEvent.setup();
    renderWithAccount(<ContactSection />, { contact: { set: vi.fn(async () => false) } });
    await user.click(news());
    expect(screen.getByRole('alert')).toHaveTextContent('couldn’t save your email choices');
  });

  it('shows loading, and a retry when loading fails', async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithAccount(<ContactSection />, { contact: { status: 'loading' } });
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    unmount();
    const { contact } = renderWithAccount(<ContactSection />, { contact: { status: 'error' } });
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(contact.reload).toHaveBeenCalled();
  });
});
