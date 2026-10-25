import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthState } from '../account/AuthProvider';
import type { SavedApi } from '../account/ProfileProvider';
import type { SavedTrip } from '../account/types';
import { profile, renderWithAccount } from '../test/contexts';
import SavedTrips from './SavedTrips';

const trip = (id: string, over: Partial<SavedTrip> = {}): SavedTrip => ({
  activityId: id,
  activityName: `Saved name ${id}`,
  savedAt: '2026-10-01T10:00:00.000Z',
  plannedFor: null,
  note: null,
  ...over,
});

const SIGNED_IN: AuthState = {
  status: 'signedIn',
  user: { id: 'user-1', email: 'sam@trips.test' },
};

function renderPage(saved: Partial<SavedApi> = {}, state: AuthState = SIGNED_IN) {
  return renderWithAccount(<SavedTrips />, { auth: state, saved }).saved;
}

const headings = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
const item = (name: string) =>
  screen.getByRole('heading', { level: 3, name }).closest('li') as HTMLElement;

beforeEach(() => window.history.replaceState(null, '', '/saved'));

describe('SavedTrips', () => {
  it('asks signed-out visitors to sign in, returning here', () => {
    renderPage({}, { status: 'anonymous' });
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/sign-in?next=%2Fsaved',
    );
  });

  it('explains when accounts are switched off', () => {
    renderPage({}, { status: 'disabled' });
    expect(screen.getByText(/Accounts aren’t available/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('shows an empty state', () => {
    renderPage({ items: [] });
    expect(screen.getByText(/haven’t saved any activities yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to search' })).toHaveAttribute('href', '/');
  });

  it('offers a retry when loading fails', async () => {
    const user = userEvent.setup();
    const api = renderPage({ status: 'error' });
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(api.reload).toHaveBeenCalled();
  });

  it('orders by soonest planned date, then most recently saved', async () => {
    renderPage({
      items: [
        trip('sample-3', { savedAt: '2026-09-01T00:00:00Z' }),
        trip('sample-2', { plannedFor: '2026-12-01' }),
        trip('sample-4', { savedAt: '2026-10-20T00:00:00Z' }),
        trip('sample-1', { plannedFor: '2026-11-01' }),
      ],
    });
    await screen.findByRole('heading', { level: 3, name: 'Natural History Museum' });
    expect(headings().slice(0, 2)).toEqual(['Natural History Museum', 'Science Museum']);
    expect(within(item('Natural History Museum')).getByText(/Planned for 1 Nov 2026/));
  });

  it('marks activities that are no longer available, and lets them be removed', async () => {
    const user = userEvent.setup();
    const api = renderPage({ items: [trip('gone-1', { activityName: 'Old Pier Show' })] });
    const gone = item('Old Pier Show');
    expect(await within(gone).findByText('No longer available')).toBeInTheDocument();
    expect(within(gone).queryByLabelText('Planned date')).not.toBeInTheDocument();

    await user.click(within(gone).getByRole('button', { name: 'Remove Old Pier Show' }));
    expect(api.remove).toHaveBeenCalledWith('gone-1');
    expect(screen.getByRole('heading', { level: 2, name: 'Saved trips' })).toHaveFocus();
  });

  it('edits the planned date and note', async () => {
    const user = userEvent.setup();
    const api = renderPage({ items: [trip('sample-1', { note: 'Old note' })] });
    const card = within(await screen.findByRole('listitem'));
    const save = card.getByRole('button', { name: 'Save changes' });
    expect(save).toBeDisabled();

    await user.type(card.getByLabelText('Planned date'), '2026-11-01');
    const note = card.getByLabelText('Note');
    expect(note).toHaveValue('Old note');
    expect(note).toHaveAttribute('maxlength', '500');
    await user.clear(note);
    await user.type(note, '  Bring wellies ');
    expect(card.getByText('16 of 500 characters')).toBeInTheDocument();
    await user.click(save);

    expect(api.update).toHaveBeenCalledWith('sample-1', {
      plannedFor: '2026-11-01',
      note: 'Bring wellies',
    });
    expect(card.getByRole('status')).toHaveTextContent('Changes saved');
  });

  it('saves an empty note and date as cleared', async () => {
    const user = userEvent.setup();
    const api = renderPage({ items: [trip('sample-1', { note: 'x', plannedFor: '2026-11-01' })] });
    const card = within(await screen.findByRole('listitem'));
    await user.clear(card.getByLabelText('Note'));
    await user.clear(card.getByLabelText('Planned date'));
    await user.click(card.getByRole('button', { name: 'Save changes' }));
    expect(api.update).toHaveBeenCalledWith('sample-1', { plannedFor: null, note: null });
  });

  it('explains when a change or removal could not be saved', async () => {
    const user = userEvent.setup();
    renderPage({
      items: [trip('sample-1')],
      update: vi.fn(async () => false),
      remove: vi.fn(async () => false),
    });
    const card = within(await screen.findByRole('listitem'));
    await user.type(card.getByLabelText('Note'), 'Hi');
    await user.click(card.getByRole('button', { name: 'Save changes' }));
    expect(card.getByRole('alert')).toHaveTextContent('couldn’t save your changes');

    await user.click(card.getByRole('button', { name: /^Remove/ }));
    expect(card.getByRole('alert')).toHaveTextContent('couldn’t remove');
  });

  it('shows the distance from the home location when there is one', async () => {
    renderWithAccount(<SavedTrips />, {
      saved: { items: [trip('sample-1')] },
      profile: { profile: profile({ home: { name: 'London', lat: 51.5074, lng: -0.1278 } }) },
    });
    const card = within(await screen.findByRole('listitem'));
    expect(await card.findByText(/km away/)).toHaveTextContent('Saved 1 Oct 2026 · 3.6 km away');
  });

  it('leaves out the distance without a home location', async () => {
    renderWithAccount(<SavedTrips />, { saved: { items: [trip('sample-1')] } });
    await screen.findByRole('heading', { level: 3, name: 'Natural History Museum' });
    expect(screen.queryByText(/km away/)).not.toBeInTheDocument();
  });
});
