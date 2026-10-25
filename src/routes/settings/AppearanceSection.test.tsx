import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithAccount } from '../../test/contexts';
import { AppearanceSection } from './AppearanceSection';

describe('AppearanceSection', () => {
  it('shows the current choice', () => {
    renderWithAccount(<AppearanceSection />, { theme: { preference: 'dark' } });
    expect(screen.getByRole('region', { name: 'Appearance' })).toHaveAttribute('id', 'appearance');
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Match my device' })).not.toBeChecked();
  });

  it('switches theme straight away', async () => {
    const user = userEvent.setup();
    const { theme } = renderWithAccount(<AppearanceSection />);
    expect(screen.getByRole('radio', { name: 'Match my device' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Light' }));
    expect(theme.setPreference).toHaveBeenCalledWith('light');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('explains when the choice could not be saved to the account', async () => {
    const user = userEvent.setup();
    renderWithAccount(<AppearanceSection />, {
      theme: { setPreference: vi.fn(async () => false) },
    });
    await user.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(screen.getByRole('alert')).toHaveTextContent('couldn’t save your theme');
  });
});
