import { describe, expect, it } from 'vitest';
import { mergeSaved, orderSaved } from './savedMerge';
import type { SavedTrip } from './types';

const trip = (id: string, over: Partial<SavedTrip> = {}): SavedTrip => ({
  activityId: id,
  activityName: `Activity ${id}`,
  savedAt: '2026-10-01T10:00:00.000Z',
  plannedFor: null,
  note: null,
  ...over,
});
const NOW = '2026-10-25T09:00:00.000Z';

describe('mergeSaved', () => {
  it('adds session saves the account does not have yet', () => {
    const { toAdd, items } = mergeSaved(
      [trip('a')],
      [{ activityId: 'b', activityName: 'Bee' }],
      NOW,
    );
    expect(toAdd).toEqual([{ activityId: 'b', activityName: 'Bee' }]);
    expect(items.map((i) => i.activityId)).toEqual(['a', 'b']);
    expect(items[1]).toEqual({
      activityId: 'b',
      activityName: 'Bee',
      savedAt: NOW,
      plannedFor: null,
      note: null,
    });
  });

  it('never duplicates, within the session or against the account', () => {
    const { toAdd, items } = mergeSaved(
      [trip('a')],
      [
        { activityId: 'a', activityName: 'Again' },
        { activityId: 'b', activityName: 'Bee' },
        { activityId: 'b', activityName: 'Bee twice' },
      ],
      NOW,
    );
    expect(toAdd.map((s) => s.activityId)).toEqual(['b']);
    expect(items.map((i) => i.activityId)).toEqual(['a', 'b']);
  });

  it('keeps existing notes, dates and names', () => {
    const existing = trip('a', { plannedFor: '2026-11-01', note: 'Bring wellies' });
    const { items } = mergeSaved([existing], [{ activityId: 'a', activityName: 'Renamed' }], NOW);
    expect(items).toEqual([existing]);
  });

  it('has nothing to add for an empty session', () => {
    expect(mergeSaved([trip('a')], [], NOW).toAdd).toEqual([]);
  });
});

describe('orderSaved', () => {
  it('puts the soonest planned date first, then the most recently saved', () => {
    const ordered = orderSaved([
      trip('old', { savedAt: '2026-09-01T00:00:00Z' }),
      trip('later', { plannedFor: '2026-12-01' }),
      trip('new', { savedAt: '2026-10-20T00:00:00Z' }),
      trip('soon', { plannedFor: '2026-11-01' }),
    ]);
    expect(ordered.map((i) => i.activityId)).toEqual(['soon', 'later', 'new', 'old']);
  });

  it('does not change the list it is given', () => {
    const list = [trip('b', { savedAt: '2026-01-01T00:00:00Z' }), trip('a')];
    orderSaved(list);
    expect(list.map((i) => i.activityId)).toEqual(['b', 'a']);
  });
});
