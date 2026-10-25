import { expect, test, type Browser, type Page } from '@playwright/test';
import { signIn } from './helpers/auth';
import { uniqueEmail } from './helpers/mailpit';

const MUSEUM = 'Natural History Museum';

async function openActivity(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
}

async function signedInPage(browser: Browser, email: string) {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await signIn(page, email);
  return page;
}

test('a saved trip appears on a second browser context (US2)', async ({ browser }) => {
  const email = uniqueEmail('saved');
  const first = await signedInPage(browser, email);
  await openActivity(first, MUSEUM);
  await first.getByRole('button', { name: /Save for later/ }).click();
  await expect(first.getByRole('button', { name: /Saved/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  const second = await signedInPage(browser, email);
  await second.goto('/saved');
  const item = second.getByRole('listitem').filter({ hasText: MUSEUM });
  await expect(item).toBeVisible();

  // Plan it on the second device, then check the first sees the change.
  await item.getByLabel('Planned date').fill('2030-06-01');
  await item.getByLabel('Note').fill('Bring the dinosaur book');
  await item.getByRole('button', { name: 'Save changes' }).click();
  await expect(item.getByRole('status')).toHaveText('Changes saved');

  await first.goto('/saved');
  const mirrored = first.getByRole('listitem').filter({ hasText: MUSEUM });
  await expect(mirrored.getByText('Planned for 1 Jun 2030')).toBeVisible();
  await expect(mirrored.getByLabel('Note')).toHaveValue('Bring the dinosaur book');

  // Removing it on one device removes it everywhere.
  const removed = first.waitForResponse(
    (r) => r.request().method() === 'DELETE' && r.url().includes('/rest/v1/saved_trips'),
  );
  await mirrored.getByRole('button', { name: `Remove ${MUSEUM}` }).click();
  await removed; // the screen updates before the database does
  await expect(first.getByText(/haven’t saved any activities yet/)).toBeVisible();
  await second.reload();
  await expect(second.getByText(/haven’t saved any activities yet/)).toBeVisible();
});

test('anonymous saves are kept when signing in (US1, US2)', async ({ page }) => {
  await page.goto('/');
  await openActivity(page, MUSEUM);
  await page.getByRole('button', { name: /Save for later/ }).click();
  await expect(page.getByText('Saved for this visit only.')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  await signIn(page, uniqueEmail('merge'));
  await page.goto('/saved');
  await expect(page.getByRole('heading', { level: 3, name: MUSEUM })).toBeVisible();
});
