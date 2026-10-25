import { expect, test, type Page } from '@playwright/test';
import { signIn } from './helpers/auth';
import { uniqueEmail } from './helpers/mailpit';

async function addMember(page: Page, nickname: string, type: string, birthYear?: number) {
  const form = page.getByRole('form', { name: 'Add a family member' });
  await form.getByLabel('Nickname').fill(nickname);
  await form.getByRole('radio', { name: type }).check();
  if (birthYear) {
    await form.getByLabel('Birth month').selectOption('January');
    await form.getByLabel('Birth year').fill(String(birthYear));
  }
  await form.getByRole('button', { name: 'Add member' }).click();
  await expect(page.getByRole('button', { name: `Edit ${nickname}` })).toBeVisible();
}

test('family members set the search’s default filters (US3)', async ({ page }) => {
  await page.goto('/');
  await signIn(page, uniqueEmail('family'));
  await page.goto('/settings#family');

  // Born in January six years ago: 6 today, whatever the date.
  await addMember(page, 'Sam', 'Adult');
  await addMember(page, 'Robin', 'Child', new Date().getFullYear() - 6);
  await addMember(page, 'Rex', 'Dog');
  const summary = 'New searches start with: ages 4–7 · family of 2 · dog-friendly';
  await expect(page.getByText(summary)).toBeVisible();

  // Reorder, and it sticks.
  await page.getByRole('button', { name: 'Move Rex up' }).click();
  const names = page.locator('.family-list__name');
  await expect(names).toHaveText(['Sam', 'Rex', 'Robin']);
  // The screen updates before the database does, so reload until the write lands.
  await expect(async () => {
    await page.reload();
    await expect(names).toHaveText(['Sam', 'Rex', 'Robin'], { timeout: 1_000 });
  }).toPass({ timeout: 10_000 });

  // A search with no filters in the URL starts from the family.
  await page.goto('/');
  await expect(page.getByRole('checkbox', { name: '4–7' })).toBeChecked();
  await expect(page.getByLabel('Family size')).toHaveValue('2');
  const dog = page.getByLabel('Dog-friendly only');
  await expect(dog).toBeChecked();

  // Changing a filter for one search leaves the family alone.
  await dog.uncheck();
  await page.goto('/settings');
  await expect(page.getByText(summary)).toBeVisible();

  // A link with filters wins over the family.
  await page.goto('/?q=zoo');
  await expect(page.getByLabel('Family size')).toHaveValue('4');
  await expect(page.getByLabel('Dog-friendly only')).not.toBeChecked();

  // Editing and removing change the next search.
  await page.goto('/settings#family');
  await page.getByRole('button', { name: 'Remove Rex' }).click();
  await expect(page.getByRole('button', { name: 'Edit Rex' })).toHaveCount(0);
  await page.goto('/');
  await expect(page.getByRole('checkbox', { name: '4–7' })).toBeChecked();
  await expect(page.getByLabel('Dog-friendly only')).not.toBeChecked();
});
