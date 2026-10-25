import { expect, test } from '@playwright/test';
import { signIn } from './helpers/auth';
import { latestEmail, uniqueEmail } from './helpers/mailpit';

test('sets a display name and a home location that searches start from (US4)', async ({ page }) => {
  const email = uniqueEmail('profile');
  await page.goto('/');
  await signIn(page, email);
  await page.getByRole('button', { name: `Account menu for ${email}` }).click();
  await page.getByRole('link', { name: 'Settings' }).click();

  const details = page.getByRole('form', { name: 'Your details' });
  await details.getByLabel('Display name').fill('Sam Rivers');
  await details.getByLabel('Home location').fill('Brighton');
  await details.getByRole('button', { name: 'Save details' }).click();
  await expect(details.getByRole('status')).toHaveText('Details saved');

  // Kept after a reload, and shown in the account menu.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Account menu for Sam Rivers' })).toBeVisible();
  await expect(details.getByLabel('Home location')).toHaveValue('Brighton');

  // Searches with no location in the URL start from home...
  await page.goto('/');
  await expect(page.getByLabel('Location', { exact: true })).toHaveValue('Brighton');
  await expect(page).toHaveURL(/place=Brighton/);

  // ...but a shared link's location wins.
  await page.goto('/?lat=51.752&lng=-1.2577&place=Oxford');
  await expect(page.getByLabel('Location', { exact: true })).toHaveValue('Oxford');
});

test('changes the sign-in email once confirmed from the new address (US4)', async ({ page }) => {
  const oldEmail = uniqueEmail('old');
  const newEmail = uniqueEmail('new');
  await page.goto('/');
  await signIn(page, oldEmail);
  await page.goto('/settings');

  const since = new Date();
  const form = page.getByRole('form', { name: 'Sign-in email' });
  await form.getByLabel('New email address').fill(newEmail);
  await form.getByRole('button', { name: 'Change email' }).click();
  await expect(form.getByRole('status')).toContainText(`Check ${newEmail}`);
  // Nothing changes until the new address confirms.
  await page.reload();
  await expect(page.getByRole('button', { name: `Account menu for ${oldEmail}` })).toBeVisible();

  const { link } = await latestEmail(newEmail, since, 'Confirm your new');
  expect(link).toBeTruthy();
  await page.goto(link ?? '');
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole('button', { name: `Account menu for ${newEmail}` })).toBeVisible();

  // The old address is told about the change.
  const notice = await latestEmail(oldEmail, since, 'sign-in email has changed');
  expect(notice.text).toContain(newEmail);
});
