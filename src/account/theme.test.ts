import { beforeEach, describe, expect, it } from 'vitest';
import { THEME_KEY, applyTheme, readStoredTheme, resolveTheme, storeTheme } from './theme';

const throwing = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.head.innerHTML = '<meta name="theme-color" content="#faf6f0" />';
});

const themeColor = () =>
  document.querySelector('meta[name="theme-color"]')?.getAttribute('content');

describe('resolveTheme', () => {
  it('follows the device only for "system"', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('stored theme', () => {
  it('defaults to "system"', () => {
    expect(readStoredTheme()).toBe('system');
  });

  it('saves and reads each preference', () => {
    for (const pref of ['light', 'dark', 'system'] as const) {
      storeTheme(pref);
      expect(localStorage.getItem(THEME_KEY)).toBe(pref);
      expect(readStoredTheme()).toBe(pref);
    }
  });

  it('ignores anything else in storage', () => {
    localStorage.setItem(THEME_KEY, 'purple');
    expect(readStoredTheme()).toBe('system');
  });

  it('copes with storage that throws', () => {
    expect(readStoredTheme(throwing)).toBe('system');
    expect(() => storeTheme('dark', throwing)).not.toThrow();
  });
});

describe('applyTheme', () => {
  it('sets data-theme for an explicit choice and the browser colour to match', () => {
    applyTheme('dark', false);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(themeColor()).toBe('#1d1f1b');

    applyTheme('light', true);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(themeColor()).toBe('#faf6f0');
  });

  it('removes data-theme for "system", leaving the CSS media query in charge', () => {
    applyTheme('dark', false);
    applyTheme('system', true);
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(themeColor()).toBe('#1d1f1b');
  });

  it('works without a theme-color meta tag', () => {
    document.head.innerHTML = '';
    expect(() => applyTheme('dark', false)).not.toThrow();
  });
});
