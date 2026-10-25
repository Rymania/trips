import { expect, type Page } from '@playwright/test';
import { latestSignInEmail } from './mailpit';

/** Signs in from the header with an emailed code, ending back on the starting page. */
export async function signIn(page: Page, email: string) {
  const since = new Date();
  await page.getByRole('link', { name: 'Sign in' }).click();
  await page.getByLabel('Email address').fill(email);
  // Auth allows one email per address per second, so a second device signing
  // in straight after the first can be told to wait; just try again.
  const send = page.getByRole('button', { name: 'Email me a code' });
  await expect(async () => {
    if (await send.isVisible()) await send.click();
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible({
      timeout: 2_000,
    });
  }).toPass({ intervals: [1_000], timeout: 15_000 });
  const { code } = await latestSignInEmail(email, since);
  await page.getByLabel('6-digit code').fill(code);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: `Account menu for ${email}` })).toBeVisible();
}
