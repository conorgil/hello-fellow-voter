import { test, expect } from '@playwright/test';
import { resetApp, createProject, addVoter } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetApp(page);
  await createProject(page, 'Test Project');
});

test('"(Do not move current voter)" keeps the voter in place when Done is clicked', async ({ page }) => {
  // TODO's Done button defaults to "(Do not move current voter)", and the
  // button is governed by the column the voter was opened from (TODO), not
  // the Writing column it gets auto-bumped into when its postcard is opened.
  await addVoter(page, { name: 'Jane Doe', street: '123 Main St', city: 'Springfield', state: 'IL', zip: '62704' });
  await page.locator('.voter-card', { hasText: 'Jane Doe' }).click();
  await page.waitForSelector('.detail-panel', { state: 'visible' });

  await page.getByRole('button', { name: 'Done', exact: true }).click();

  await expect(page.locator('.detail-panel')).toHaveCount(0);
  const writingColumn = page.locator('.column', { hasText: 'Writing' });
  await expect(writingColumn.locator('.voter-card', { hasText: 'Jane Doe' })).toBeVisible();
});

test('clicking Done shows a toast naming the column the voter moved to, even for the last voter', async ({ page }) => {
  await addVoter(page, { name: 'Jane Doe', street: '123 Main St', city: 'Springfield', state: 'IL', zip: '62704' });

  // Opening bumps TODO -> Writing; TODO's own Done setting leaves the voter in
  // place, so close without clicking it.
  await page.locator('.voter-card', { hasText: 'Jane Doe' }).click();
  await page.waitForSelector('.detail-panel', { state: 'visible' });
  await page.locator('.detail-panel__close').click();
  await expect(page.locator('.detail-panel')).toHaveCount(0);

  // Reopening a voter already sitting in Writing applies Writing's own
  // automation directly — no bump, nobody left in TODO, so no "Next voter".
  await page.locator('.voter-card', { hasText: 'Jane Doe' }).click();
  await page.waitForSelector('.detail-panel', { state: 'visible' });
  await expect(page.getByRole('button', { name: 'Next voter' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Done', exact: true }).click();

  await expect(page.locator('.toast', { hasText: 'Written' })).toContainText('Moved Jane Doe to the Written column');
  const writtenColumn = page.locator('.column', { hasText: 'Written' });
  await expect(writtenColumn.locator('.voter-card', { hasText: 'Jane Doe' })).toBeVisible();
});
