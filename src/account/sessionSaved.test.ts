import { beforeEach, describe, expect, it } from 'vitest';
import { clearSessionSaved, loadSessionSaved, storeSessionSaved } from './sessionSaved';

beforeEach(() => sessionStorage.clear());

const throwing = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

describe('session saved list', () => {
  it('round-trips saves through sessionStorage', () => {
    storeSessionSaved([{ activityId: 'a', activityName: 'Aye' }]);
    expect(loadSessionSaved()).toEqual([{ activityId: 'a', activityName: 'Aye' }]);
    clearSessionSaved();
    expect(loadSessionSaved()).toEqual([]);
  });

  it('reads the older list of bare IDs', () => {
    sessionStorage.setItem('saved', JSON.stringify(['a', 'b']));
    expect(loadSessionSaved()).toEqual([
      { activityId: 'a', activityName: 'a' },
      { activityId: 'b', activityName: 'b' },
    ]);
  });

  it('ignores malformed data', () => {
    sessionStorage.setItem('saved', '{not json');
    expect(loadSessionSaved()).toEqual([]);
    sessionStorage.setItem('saved', JSON.stringify([1, null, { activityId: 'a' }, { x: 1 }]));
    expect(loadSessionSaved()).toEqual([{ activityId: 'a', activityName: 'a' }]);
  });

  it('copes with storage that throws', () => {
    expect(loadSessionSaved(throwing)).toEqual([]);
    expect(() => storeSessionSaved([], throwing)).not.toThrow();
    expect(() => clearSessionSaved(throwing)).not.toThrow();
  });
});
