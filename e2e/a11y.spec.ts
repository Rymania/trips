import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { signIn } from './helpers/auth';
import { uniqueEmail } from './helpers/mailpit';

/** WCAG 2.1 AA, as the constitution and spec 005 FR-014 require. */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const WIDTHS = [320, 768, 1024, 1440];

async function expectAccessible(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = violations.map(
    (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
  expect(summary, `axe violations on ${label}`).toEqual([]);
  // Mobile-first: nothing should scroll sideways, even at 320px.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `horizontal overflow on ${label}`).toBeLessThanOrEqual(0);
}

/** A signed-in user with something on every page, so the checks cover real content. */
async function populatedAccount(page: Page) {
  await page.goto('/');
  await signIn(page, uniqueEmail('a11y'));
  await page.getByRole('button', { name: 'Natural History Museum', exact: true }).click();
  const saved = page.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().includes('/rest/v1/saved_trips'),
  );
  await page.getByRole('button', { name: /Save for later/ }).click();
  await saved;
  await page.goto('/settings#family');
  const form = page.getByRole('form', { name: 'Add a family member' });
  await form.getByLabel('Nickname').fill('Robin');
  await form.getByRole('radio', { name: 'Child' }).check();
  await form.getByLabel('Birth month').selectOption('March');
  await form.getByLabel('Birth year').fill('2019');
  await form.getByRole('button', { name: 'Add member' }).click();
  await expect(page.getByRole('button', { name: 'Edit Robin' })).toBeVisible();
  const digest = page.getByRole('checkbox', { name: /New activities near home/ });
  await digest.check();
  await expect(page.getByRole('group', { name: 'How often' })).toBeVisible();
}

async function checkPages(page: Page, width: number, scheme: string) {
  const at = `${width}px ${scheme}`;

  await page.goto('/settings');
  await expect(
    page.getByRole('heading', { name: 'Robin', exact: false }).or(page.getByText('Robin')),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Delete my account…' }).click();
  await expectAccessible(page, `/settings at ${at}`);

  await page.goto('/saved');
  await expect(
    page.getByRole('heading', { level: 3, name: 'Natural History Museum' }),
  ).toBeVisible();
  await expectAccessible(page, `/saved at ${at}`);

  await page.getByRole('button', { name: /Account menu/ }).click();
  await expectAccessible(page, `account menu at ${at}`);
}

for (const width of WIDTHS) {
  test(`sign-in, saved trips and settings meet WCAG 2.1 AA at ${width}px (T053)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });

    await page.goto('/sign-in');
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expectAccessible(page, `/sign-in at ${width}px`);
    await page.getByRole('button', { name: 'Theme' }).click();
    await expectAccessible(page, `theme menu at ${width}px`);

    await populatedAccount(page);
    await checkPages(page, width, 'light');
  });
}

test('the dark theme meets WCAG 2.1 AA too (T053)', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/sign-in');
  await expectAccessible(page, '/sign-in at 1024px dark');
  await populatedAccount(page);
  await checkPages(page, 1024, 'dark');
});
