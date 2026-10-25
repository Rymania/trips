import { readFile } from 'node:fs/promises';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { signIn } from './helpers/auth';
import { uniqueEmail } from './helpers/mailpit';

async function signedInPage(browser: Browser, email: string) {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await signIn(page, email);
  return page;
}

async function addAdult(page: Page, nickname: string) {
  await page.goto('/settings#family');
  const form = page.getByRole('form', { name: 'Add a family member' });
  await form.getByLabel('Nickname').fill(nickname);
  await form.getByRole('button', { name: 'Add member' }).click();
  await expect(page.getByRole('button', { name: `Edit ${nickname}` })).toBeVisible();
}

test('downloads only the signed-in user’s data (US7)', async ({ browser }) => {
  const other = await signedInPage(browser, uniqueEmail('other'));
  await addAdult(other, 'Someone Else');

  const email = uniqueEmail('export');
  const page = await signedInPage(browser, email);
  await addAdult(page, 'Robin');
  await page.goto('/');
  await page.getByRole('button', { name: 'Natural History Museum', exact: true }).click();
  const saved = page.waitForResponse((r) => r.url().includes('/rest/v1/saved_trips'));
  await page.getByRole('button', { name: /Save for later/ }).click();
  await saved;

  await page.goto('/settings#data');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download my data' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^family-day-planner-data-\d{4}-\d{2}-\d{2}\.json$/);

  const text = await readFile((await download.path()) ?? '', 'utf8');
  const data = JSON.parse(text) as {
    account: { email: string };
    profile: { id: string };
    familyMembers: { nickname: string }[];
    savedTrips: { activity_id: string }[];
    contactPreferences: unknown[];
  };
  expect(data.account.email).toBe(email);
  expect(data.familyMembers.map((m) => m.nickname)).toEqual(['Robin']);
  expect(data.savedTrips.map((s) => s.activity_id)).toEqual(['sample-1']);
  expect(data.contactPreferences).toEqual([]);
  expect(text).not.toContain('Someone Else');
});

test('deletes the account only after typing its email (US7)', async ({ browser }) => {
  const email = uniqueEmail('delete');
  const page = await signedInPage(browser, email);
  await addAdult(page, 'Robin');
  await page.goto('/settings#data');

  await page.getByRole('button', { name: 'Delete my account…' }).click();
  const form = page.getByRole('form', { name: 'Delete my account' });
  const input = form.getByLabel('Type your email address to confirm');
  await input.fill('someone@else.test');
  await form.getByRole('button', { name: 'Delete my account permanently' }).click();
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('button', { name: `Account menu for ${email}` })).toBeVisible();

  await input.fill(email);
  await form.getByRole('button', { name: 'Delete my account permanently' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'have been deleted' })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();

  // Signing in again with the same address starts a new, empty account.
  await signIn(page, email);
  await page.goto('/settings#family');
  await expect(page.getByText('No family members yet.')).toBeVisible();
});
