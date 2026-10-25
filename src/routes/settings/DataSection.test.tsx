import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithAccount } from '../../test/contexts';
import { takeNotice } from '../notice';
import { DataSection } from './DataSection';

let created: Blob[];
let clicked: HTMLAnchorElement[];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 25, 12));
  window.history.replaceState(null, '', '/settings');
  created = [];
  clicked = [];
  URL.createObjectURL = vi.fn((b: Blob) => {
    created.push(b);
    return 'blob:export';
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push(this);
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  takeNotice();
});

describe('DataSection: download', () => {
  it('downloads the export as a JSON file', async () => {
    const user = userEvent.setup();
    const { profile } = renderWithAccount(<DataSection />);
    expect(screen.getByRole('region', { name: 'Your data' })).toHaveAttribute('id', 'data');

    await user.click(screen.getByRole('button', { name: 'Download my data' }));
    expect(profile.exportData).toHaveBeenCalled();
    expect(clicked).toHaveLength(1);
    expect(clicked[0]?.download).toBe('family-day-planner-data-2026-10-25.json');
    expect(clicked[0]?.href).toBe('blob:export');
    expect(created[0]?.type).toBe('application/json');
    expect(JSON.parse(await created[0]!.text())).toEqual({ exportedAt: 'now' });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:export');
  });

  it('explains a failed download', async () => {
    const user = userEvent.setup();
    renderWithAccount(<DataSection />, {
      profile: { exportData: vi.fn(async () => ({ ok: false as const })) },
    });
    await user.click(screen.getByRole('button', { name: 'Download my data' }));
    expect(screen.getByRole('alert')).toHaveTextContent('couldn’t prepare your download');
    expect(clicked).toHaveLength(0);
  });
});

describe('DataSection: delete', () => {
  const open = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'Delete my account…' }));
    return within(screen.getByRole('form', { name: 'Delete my account' }));
  };

  it('requires typing the account’s email before deleting', async () => {
    const user = userEvent.setup();
    const { profile, auth } = renderWithAccount(<DataSection />);
    const form = await open(user);
    const input = form.getByLabelText('Type your email address to confirm');
    expect(input).toHaveFocus();

    await user.click(form.getByRole('button', { name: 'Delete my account permanently' }));
    expect(form.getByText('Type sam@trips.test exactly to confirm.')).toBeInTheDocument();
    await user.type(input, 'someone@else.test');
    await user.click(form.getByRole('button', { name: 'Delete my account permanently' }));
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(profile.deleteAccount).not.toHaveBeenCalled();

    await user.clear(input);
    await user.type(input, ' SAM@trips.test ');
    await user.click(form.getByRole('button', { name: 'Delete my account permanently' }));
    expect(profile.deleteAccount).toHaveBeenCalledWith('SAM@trips.test'); // email inputs trim
    expect(auth.signOut).toHaveBeenCalled();
    expect(window.location.pathname).toBe('/');
    expect(takeNotice()).toBe('Your account and everything in it have been deleted.');
  });

  it('can be cancelled', async () => {
    const user = userEvent.setup();
    renderWithAccount(<DataSection />);
    await open(user);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('form', { name: 'Delete my account' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete my account…' })).toHaveFocus();
  });

  it('explains when the server refuses or fails', async () => {
    const user = userEvent.setup();
    const deleteAccount = vi
      .fn<(email: string) => Promise<'deleted' | 'mismatch' | 'failed'>>()
      .mockResolvedValueOnce('mismatch')
      .mockResolvedValueOnce('failed');
    const { auth } = renderWithAccount(<DataSection />, { profile: { deleteAccount } });
    const form = await open(user);
    await user.type(form.getByLabelText('Type your email address to confirm'), 'sam@trips.test');
    await user.click(form.getByRole('button', { name: 'Delete my account permanently' }));
    expect(form.getByText('Type sam@trips.test exactly to confirm.')).toBeInTheDocument();
    await user.click(form.getByRole('button', { name: 'Delete my account permanently' }));
    expect(form.getByRole('alert')).toHaveTextContent('couldn’t delete your account');
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});
