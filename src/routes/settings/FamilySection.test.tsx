import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { member, renderWithAccount } from '../../test/contexts';
import { FamilySection } from './FamilySection';

const SAM = member({ id: 'm1', nickname: 'Sam' });
const ROBIN = member({
  id: 'm2',
  nickname: 'Robin',
  kind: 'child',
  birth: { year: 2019, month: 3 },
  sortOrder: 1,
});
const REX = member({ id: 'm3', nickname: 'Rex', kind: 'dog', sortOrder: 2 });

function setup(family: NonNullable<Parameters<typeof renderWithAccount>[1]>['family'] = {}) {
  const user = userEvent.setup();
  const view = renderWithAccount(<FamilySection />, {
    family: { members: [SAM, ROBIN, REX], ...family },
  });
  return { user, ...view };
}
const addForm = () => within(screen.getByRole('form', { name: 'Add a family member' }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 25));
});
afterEach(() => vi.useRealTimers());

describe('FamilySection', () => {
  it('lists members with their details and the search defaults they give', () => {
    setup();
    const items = screen.getAllByRole('listitem');
    const [sam, robin, rex] = items as [HTMLElement, HTMLElement, HTMLElement];
    expect(items.map((i) => i.querySelector('.family-list__name')?.textContent)).toEqual([
      'Sam',
      'Robin',
      'Rex',
    ]);
    expect(within(sam).getByText('Adult')).toBeInTheDocument();
    expect(within(robin).getByText('Child · born Mar 2019 · age 7')).toBeInTheDocument();
    expect(within(rex).getByText('Dog')).toBeInTheDocument();
    expect(
      screen.getByText('New searches start with: ages 4–7 · family of 2 · dog-friendly'),
    ).toBeInTheDocument();
  });

  it('shows an empty state', () => {
    setup({ members: [] });
    expect(screen.getByText(/No family members yet/)).toBeInTheDocument();
    expect(screen.queryByText(/New searches start with:/)).not.toBeInTheDocument();
  });

  it('asks for a birth month and year only for children', async () => {
    const { user, family } = setup();
    const form = addForm();
    expect(form.getByRole('radio', { name: 'Adult' })).toBeChecked();
    expect(form.queryByLabelText('Birth month')).not.toBeInTheDocument();

    await user.type(form.getByLabelText('Nickname'), ' Robin ');
    await user.click(form.getByRole('radio', { name: 'Child' }));
    await user.click(form.getByRole('button', { name: 'Add member' }));
    expect(form.getByText('Choose a birth month and a year from 1900 to now.')).toBeInTheDocument();
    expect(family.add).not.toHaveBeenCalled();

    await user.selectOptions(form.getByLabelText('Birth month'), 'March');
    await user.type(form.getByLabelText('Birth year'), '2019');
    await user.click(form.getByRole('button', { name: 'Add member' }));
    expect(family.add).toHaveBeenCalledWith({
      nickname: 'Robin',
      kind: 'child',
      birth: { year: 2019, month: 3 },
    });
    expect(form.getByLabelText('Nickname')).toHaveValue('');
    expect(form.getByRole('radio', { name: 'Adult' })).toBeChecked();
  });

  it('adds an adult or a dog without a birth date', async () => {
    const { user, family } = setup();
    const form = addForm();
    await user.type(form.getByLabelText('Nickname'), 'Biscuit');
    await user.click(form.getByRole('radio', { name: 'Dog' }));
    await user.click(form.getByRole('button', { name: 'Add member' }));
    expect(family.add).toHaveBeenCalledWith({ nickname: 'Biscuit', kind: 'dog', birth: null });
  });

  it('rejects an empty nickname and a birth date in the future', async () => {
    const { user, family } = setup();
    const form = addForm();
    await user.click(form.getByRole('button', { name: 'Add member' }));
    expect(form.getByText('Enter a nickname of 1 to 30 characters.')).toBeInTheDocument();
    expect(form.getByLabelText('Nickname')).toHaveAttribute('aria-invalid', 'true');

    await user.type(form.getByLabelText('Nickname'), 'Soon');
    await user.click(form.getByRole('radio', { name: 'Child' }));
    await user.selectOptions(form.getByLabelText('Birth month'), 'December');
    await user.type(form.getByLabelText('Birth year'), '2026');
    await user.click(form.getByRole('button', { name: 'Add member' }));
    expect(form.getByText('Choose a birth month and a year from 1900 to now.')).toBeInTheDocument();
    expect(family.add).not.toHaveBeenCalled();
  });

  it('edits a member, dropping the birth date when they are no longer a child', async () => {
    const { user, family } = setup();
    await user.click(screen.getByRole('button', { name: 'Edit Robin' }));
    const form = within(screen.getByRole('form', { name: 'Edit Robin' }));
    expect(form.getByLabelText('Nickname')).toHaveValue('Robin');
    expect(form.getByLabelText('Birth month')).toHaveValue('3');
    expect(form.getByLabelText('Birth year')).toHaveValue(2019);

    await user.click(form.getByRole('radio', { name: 'Adult' }));
    expect(form.queryByLabelText('Birth month')).not.toBeInTheDocument();
    await user.click(form.getByRole('button', { name: 'Save' }));
    expect(family.update).toHaveBeenCalledWith('m2', {
      nickname: 'Robin',
      kind: 'adult',
      birth: null,
    });
    expect(screen.queryByRole('form', { name: 'Edit Robin' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Robin' })).toHaveFocus();
  });

  it('cancels an edit', async () => {
    const { user, family } = setup();
    await user.click(screen.getByRole('button', { name: 'Edit Sam' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('form', { name: 'Edit Sam' })).not.toBeInTheDocument();
    expect(family.update).not.toHaveBeenCalled();
  });

  it('removes and reorders members', async () => {
    const { user, family } = setup();
    expect(screen.getByRole('button', { name: 'Move Sam up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Rex down' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Move Robin up' }));
    expect(family.move).toHaveBeenCalledWith('m2', -1);
    await user.click(screen.getByRole('button', { name: 'Move Sam down' }));
    expect(family.move).toHaveBeenCalledWith('m1', 1);

    await user.click(screen.getByRole('button', { name: 'Remove Rex' }));
    expect(family.remove).toHaveBeenCalledWith('m3');
  });

  it('explains failures', async () => {
    const { user } = setup({
      add: vi.fn(async () => false),
      remove: vi.fn(async () => false),
      move: vi.fn(async () => false),
    });
    const form = addForm();
    await user.type(form.getByLabelText('Nickname'), 'Kim');
    await user.click(form.getByRole('button', { name: 'Add member' }));
    expect(form.getByRole('alert')).toHaveTextContent('couldn’t save this family member');
    expect(form.getByLabelText('Nickname')).toHaveValue('Kim');

    await user.click(screen.getByRole('button', { name: 'Remove Rex' }));
    expect(screen.getByText('We couldn’t update your family. Please try again.')).toHaveAttribute(
      'role',
      'alert',
    );
  });

  it('stops adding at 20 members', () => {
    setup({
      members: Array.from({ length: 20 }, (_, i) =>
        member({ id: `m${i}`, nickname: `Member ${i}`, sortOrder: i }),
      ),
    });
    expect(screen.queryByRole('form', { name: 'Add a family member' })).not.toBeInTheDocument();
    expect(screen.getByText('You can add up to 20 family members.')).toBeInTheDocument();
  });

  it('shows loading, and a retry when the family fails to load', async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithAccount(<FamilySection />, { family: { status: 'loading' } });
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    unmount();
    const { family } = renderWithAccount(<FamilySection />, { family: { status: 'error' } });
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(family.reload).toHaveBeenCalled();
  });
});
