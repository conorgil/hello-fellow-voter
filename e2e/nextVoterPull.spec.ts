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

test('pulling the next voter from the same column keeps it in that column, not the "move to" target', async ({
  page,
}) => {
  // Get both voters into Written: open (TODO -> Writing), Done (TODO's own
  // setting leaves it in Writing), reopen directly, Done again (Writing -> Written).
  for (const name of ['First Voter', 'Second Voter']) {
    await addVoter(page, { name, street: '1 Main St', city: 'Springfield', state: 'IL', zip: '62704' });
    await page.locator('.voter-card', { hasText: name }).click();
    await page.waitForSelector('.detail-panel', { state: 'visible' });
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.locator('.detail-panel')).toHaveCount(0);

    await page.locator('.voter-card', { hasText: name }).click();
    await page.waitForSelector('.detail-panel', { state: 'visible' });
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.locator('.detail-panel')).toHaveCount(0);
  }

  await page.locator('.voter-card', { hasText: 'First Voter' }).click();
  await page.waitForSelector('.detail-panel', { state: 'visible' });
  await page.getByRole('button', { name: 'Next voter' }).click();

  // Written's "Move the current voter to" target is Stamp Applied, but the
  // *pulled* voter should stay in Written (it hasn't been stamped yet) and
  // open with its own Done button, not get swept straight into Stamp Applied.
  await expect(page.locator('.postcard-address')).toContainText('Second Voter');
  await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeVisible();

  const writtenColumn = page.locator('.column', { hasText: 'Written' });
  await expect(writtenColumn.locator('.voter-card', { hasText: 'Second Voter' })).toBeVisible();
  const stampedColumn = page.locator('.column', { hasText: 'Stamp Applied' });
  await expect(stampedColumn.locator('.voter-card', { hasText: 'Second Voter' })).toHaveCount(0);
});

test('pulling the next voter in Stamp Applied keeps it there, not promoted to Mailed', async ({ page }) => {
  // Get both voters into Stamp Applied: TODO -> Writing (open), Done (TODO's
  // own setting leaves it in Writing), reopen, Writing -> Written (Done),
  // reopen, Written -> Stamp Applied (Done).
  for (const name of ['First Voter', 'Second Voter']) {
    await addVoter(page, { name, street: '1 Main St', city: 'Springfield', state: 'IL', zip: '62704' });
    await page.locator('.voter-card', { hasText: name }).click();
    await page.waitForSelector('.detail-panel', { state: 'visible' });
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.locator('.detail-panel')).toHaveCount(0);

    await page.locator('.voter-card', { hasText: name }).click();
    await page.waitForSelector('.detail-panel', { state: 'visible' });
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.locator('.detail-panel')).toHaveCount(0);

    await page.locator('.voter-card', { hasText: name }).click();
    await page.waitForSelector('.detail-panel', { state: 'visible' });
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.locator('.detail-panel')).toHaveCount(0);
  }

  await page.locator('.voter-card', { hasText: 'First Voter' }).click();
  await page.waitForSelector('.detail-panel', { state: 'visible' });
  await page.getByRole('button', { name: 'Next voter' }).click();

  // The address view should stay open, showing the other Stamp Applied voter,
  // not close with it silently promoted to Mailed. (Stamp Applied has no Done
  // button configured by default — only Next voter, which is now hidden since
  // Second Voter is the last one left — so just the postcard itself is checked.)
  await expect(page.locator('.detail-panel')).toBeVisible();
  await expect(page.locator('.postcard-address')).toContainText('Second Voter');

  const stampedColumn = page.locator('.column', { hasText: 'Stamp Applied' });
  await expect(stampedColumn.locator('.voter-card', { hasText: 'Second Voter' })).toBeVisible();
  const mailedColumn = page.locator('.column', { hasText: 'Mailed' });
  await expect(mailedColumn.locator('.voter-card', { hasText: 'Second Voter' })).toHaveCount(0);
});
