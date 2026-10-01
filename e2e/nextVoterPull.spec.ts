import { test, expect } from '@playwright/test';
import { resetApp, createProject, addVoter } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetApp(page);
  await createProject(page, 'Test Project');
});

test('hides the "Next voter" button when the pull-from column has no more voters', async ({ page }) => {
  await addVoter(page, { name: 'Solo Voter', street: '1 Main St', city: 'Springfield', state: 'IL', zip: '62704' });

  // Opening the only voter bumps it from TODO into Writing, leaving TODO (the
  // Writing column's pull-from source) empty.
  await page.locator('.voter-card', { hasText: 'Solo Voter' }).click();
  await page.waitForSelector('.detail-panel', { state: 'visible' });

  await expect(page.getByRole('button', { name: 'Next voter' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeVisible();
});

test('shows the "Next voter" button when the pull-from column still has a voter waiting', async ({ page }) => {
  await addVoter(page, { name: 'First Voter', street: '1 Main St', city: 'Springfield', state: 'IL', zip: '62704' });
  await addVoter(page, { name: 'Second Voter', street: '2 Main St', city: 'Springfield', state: 'IL', zip: '62704' });

  // Opening "First Voter" bumps it into Writing; "Second Voter" is still
  // waiting in TODO, so there's someone left to pull.
  await page.locator('.voter-card', { hasText: 'First Voter' }).click();
  await page.waitForSelector('.detail-panel', { state: 'visible' });

  await expect(page.getByRole('button', { name: 'Next voter' })).toBeVisible();
});
