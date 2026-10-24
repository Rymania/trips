import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { aggregate } from './data/sources';
import { searchPlaces } from './data/places';

beforeEach(() => window.history.replaceState(null, '', '/'));

describe('App', () => {
  it('lists activities and narrows with filters, showing removable tags', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(/activities found/);
    const before = screen.getByRole('status', { name: '', hidden: true });
    expect(before).toBeInTheDocument();

    await user.click(screen.getByLabelText('Dog-friendly only'));
    const tags = screen.getByRole('region', { name: 'Active filters' });
    expect(within(tags).getByText('Dog-friendly')).toBeInTheDocument();
    expect(window.location.search).toContain('dog=1');

    await user.click(screen.getByRole('button', { name: /Remove filter: Dog-friendly/ }));
    expect(window.location.search).not.toContain('dog=1');
  });

  it('opens the detail dialog for an activity', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Natural History Museum' }));
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 2, name: 'Natural History Museum' }),
      ).toBeInTheDocument(),
    );
  });
});

describe('aggregate', () => {
  it('tolerates a failing source and reports it', async () => {
    const ok = { name: 'ok', fetch: async () => [] };
    const bad = {
      name: 'bad',
      fetch: async () => {
        throw new Error('x');
      },
    };
    expect((await aggregate([ok, bad])).failedSources).toEqual(['bad']);
  });
});

describe('searchPlaces', () => {
  it('matches prefixes and coordinates, rejects out-of-range', () => {
    expect(searchPlaces('bri').map((p) => p.label)).toEqual(['Brighton', 'Bristol']);
    expect(searchPlaces('51.5,-0.1')[0]?.location).toEqual({ lat: 51.5, lng: -0.1 });
    expect(searchPlaces('99,0')).toEqual([]);
  });
});
