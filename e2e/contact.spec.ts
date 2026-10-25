import { expect, test, type Page } from '@playwright/test';
import { signIn } from './helpers/auth';
import { uniqueEmail } from './helpers/mailpit';
import { unsubscribeLink } from './helpers/unsubscribe';

/** The signed-in user's ID, from the session supabase-js keeps in localStorage. */
function userId(page: Page): Promise<string> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k)) ?? '';
    return (JSON.parse(localStorage.getItem(key) ?? '{}') as { user: { id: string } }).user.id;
  });
}

test('contact choices persist, and an emailed link unsubscribes without signing in (US6)', async ({
  page,
  browser,
  request,
}) => {
  await page.goto('/');
  await signIn(page, uniqueEmail('contact'));
  await page.goto('/settings#contact');

  const section = page.getByRole('region', { name: 'Email preferences' });
  const digest = section.getByRole('checkbox', { name: /New activities near home/ });
  const news = section.getByRole('checkbox', { name: /Product news/ });
  await expect(digest).not.toBeChecked();
  await expect(news).not.toBeChecked();

  await digest.check();
  await section.getByRole('radio', { name: 'Monthly' }).check();
  await expect(section.getByText(/Last changed/)).toBeVisible();
  await expect(async () => {
    await page.reload();
    await expect(section.getByRole('radio', { name: 'Monthly' })).toBeChecked({ timeout: 1_000 });
  }).toPass({ timeout: 10_000 });
  await expect(digest).toBeChecked();

  // A tampered link is refused.
  const link = unsubscribeLink(await userId(page), 'nearby_digest');
  const tampered = new URL(link);
  tampered.searchParams.set('s', '0'.repeat(64));
  expect((await request.get(tampered.toString())).status()).toBe(400);

  // The real one works in a browser with no session at all.
  const stranger = await (await browser.newContext()).newPage();
  await stranger.goto(link);
  await expect(stranger.getByRole('heading', { name: 'You’re unsubscribed' })).toBeVisible();

  await page.reload();
  await expect(digest).not.toBeChecked();
  await expect(news).not.toBeChecked();
});

test('the one-click POST unsubscribes too (US6)', async ({ page, request }) => {
  await page.goto('/');
  await signIn(page, uniqueEmail('oneclick'));
  await page.goto('/settings#contact');
  const news = page.getByRole('checkbox', { name: /Product news/ });
  await news.check();
  await expect(page.getByText(/Last changed/)).toBeVisible();

  const res = await request.post(unsubscribeLink(await userId(page), 'product_news'), {
    form: { 'List-Unsubscribe': 'One-Click' },
  });
  expect(res.status()).toBe(204);
  await page.reload();
  await expect(news).not.toBeChecked();
});
