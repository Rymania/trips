import { expect, test, type Page } from '@playwright/test';
import { latestSignInEmail, uniqueEmail } from './helpers/mailpit';

/** Starts sign-in from the header and returns the email that was sent. */
async function requestCode(page: Page, email: string) {
  const since = new Date();
  await page.getByRole('link', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  return latestSignInEmail(email, since);
}

test('signs up and signs in with an email code (US1)', async ({ page }) => {
  const email = uniqueEmail('signup');
  await page.goto('/?dog=1');
  await expect(page.getByText(/activities found/)).toBeVisible();

  const { code } = await requestCode(page, email);
  await page.getByLabel('6-digit code').fill(code);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  // Back where sign-in started, with the search intact and the account menu shown.
  await expect(page).toHaveURL(/\/\?dog=1$/);
  const menu = page.getByRole('button', { name: `Account menu for ${email}` });
  await expect(menu).toBeVisible();

  // The session survives a reload.
  await page.reload();
  await expect(menu).toBeVisible();

  // Sign out ends the session on this device.
  await menu.click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
});

test('signs in with the emailed link (US1)', async ({ page }) => {
  const email = uniqueEmail('link');
  await page.goto('/');
  const { link } = await requestCode(page, email);

  await page.goto(link);
  await expect(page.getByRole('button', { name: `Account menu for ${email}` })).toBeVisible();
  await expect(page).not.toHaveURL(/auth\/callback/);
});

test('explains a wrong code and allows a retry (US1)', async ({ page }) => {
  const email = uniqueEmail('wrong');
  await page.goto('/');
  const { code } = await requestCode(page, email);
  const wrong = code === '000000' ? '111111' : '000000';

  await page.getByLabel('6-digit code').fill(wrong);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('That code didn’t work');

  await page.getByLabel('6-digit code').fill(code);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: `Account menu for ${email}` })).toBeVisible();
});

test('a used sign-in link explains what to do (US1)', async ({ page }) => {
  await page.goto('/auth/callback?error=access_denied&error_code=otp_expired');
  await expect(page.getByRole('alert')).toContainText('expired or was already used');
  await page.getByRole('link', { name: 'Request a new code' }).click();
  await expect(page.getByLabel('Email address')).toBeVisible();
});
