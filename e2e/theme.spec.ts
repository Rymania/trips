import { expect, test } from '@playwright/test';
import { signIn } from './helpers/auth';
import { uniqueEmail } from './helpers/mailpit';

const DARK_BG = '#1d1f1b';

test.use({ colorScheme: 'light' });

test('a dark theme persists across reloads with no flash (US5)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Theme' }).click();
  await page.getByRole('radio', { name: 'Dark' }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  // Record the theme as parsing ends (before the app's scripts run) and at
  // DOMContentLoaded, when the stylesheet has applied.
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    document.addEventListener('readystatechange', () => {
      if (document.readyState === 'interactive')
        w.beforeApp = document.documentElement.dataset.theme;
    });
    document.addEventListener('DOMContentLoaded', () => {
      w.bgAtLoad = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    });
  });
  await page.reload();
  const seen = await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    return { beforeApp: w.beforeApp, bgAtLoad: w.bgAtLoad };
  });
  expect(seen).toEqual({ beforeApp: 'dark', bgAtLoad: DARK_BG });
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', DARK_BG);

  // Back to following the device.
  await page.getByRole('button', { name: 'Theme' }).click();
  await page.getByRole('radio', { name: 'Match my device' }).check();
  await page.reload();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
});

test('a signed-in theme follows the account to another device (US5)', async ({ browser }) => {
  const email = uniqueEmail('theme');
  const first = await (await browser.newContext({ colorScheme: 'light' })).newPage();
  await first.goto('/');
  await signIn(first, email);
  await first.goto('/settings#appearance');
  await first
    .getByRole('region', { name: 'Appearance' })
    .getByRole('radio', { name: 'Dark' })
    .check();
  await expect(first.locator('html')).toHaveAttribute('data-theme', 'dark');

  const second = await (await browser.newContext({ colorScheme: 'light' })).newPage();
  await second.goto('/');
  await expect(second.locator('html')).not.toHaveAttribute('data-theme');
  await signIn(second, email);
  await expect(second.locator('html')).toHaveAttribute('data-theme', 'dark');
  // And it sticks there without waiting for the account next time.
  await second.reload();
  await expect(second.locator('html')).toHaveAttribute('data-theme', 'dark');
});
