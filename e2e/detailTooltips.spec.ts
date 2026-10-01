import { test, expect } from '@playwright/test';
import { resetApp, createProject, addVoter } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetApp(page);
  await createProject(page, 'Test Project');
});

test('button tooltips describe what each button will do', async ({ page }) => {
  await addVoter(page, { name: 'First Voter', street: '1 Main St', city: 'Springfield', state: 'IL', zip: '62704' });
  await addVoter(page, { name: 'Second Voter', street: '2 Main St', city: 'Springfield', state: 'IL', zip: '62704' });

  // Opening "First Voter" bumps it from TODO into Writing; "Second Voter"
  // stays queued in TODO, so there's someone left for the pull automation.
  await page.locator('.voter-card', { hasText: 'First Voter' }).click();
  await page.waitForSelector('.detail-panel', { state: 'visible' });

  const closeBtn = page.locator('.detail-panel__close');
  await closeBtn.hover();
  await expect(closeBtn.locator('.tooltip')).toHaveText('Closes address view without any automations');
  // The visible close button's accessible name is unaffected by the tooltip.
  await expect(closeBtn).toHaveAttribute('aria-label', 'Close');

  const doneBtn = page.getByRole('button', { name: 'Done', exact: true });
  await doneBtn.hover();
  await expect(doneBtn.locator('.tooltip')).toHaveText('Closes address view without moving First Voter');

  const nextBtn = page.getByRole('button', { name: 'Next voter' });
  await nextBtn.hover();
  await expect(nextBtn.locator('.tooltip')).toHaveText(
    'Moves First Voter to Written and Second Voter from TODO to Writing',
  );
});

test('Done tooltip reflects "(Do not move current voter)" when the voter stays in place', async ({ page }) => {
  // TODO's own automation defaults to "(Do not move current voter)" for Done —
  // and since the button is governed by the column the voter was opened from,
  // that setting applies even though opening the voter bumps it into Writing.
  await addVoter(page, { name: 'Jane Doe', street: '123 Main St', city: 'Springfield', state: 'IL', zip: '62704' });
  await page.locator('.voter-card', { hasText: 'Jane Doe' }).click();
  await page.waitForSelector('.detail-panel', { state: 'visible' });

  const doneBtn = page.getByRole('button', { name: 'Done', exact: true });
  await doneBtn.hover();
  await expect(doneBtn.locator('.tooltip')).toHaveText('Closes address view without moving Jane Doe');
});
