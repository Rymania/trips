import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Notice, showNotice, takeNotice } from './notice';

describe('Notice', () => {
  it('shows a message sent from anywhere until dismissed', async () => {
    const user = userEvent.setup();
    render(<Notice />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    act(() => showNotice('Your account has been deleted.'));
    expect(screen.getByRole('status')).toHaveTextContent('Your account has been deleted.');

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(takeNotice()).toBeNull();
  });
});
