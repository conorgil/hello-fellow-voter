import { test, expect } from '@playwright/test';
import { resetApp, createProject, openAutomationForm, automationSelect, addVoter } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetApp(page);
  await createProject(page, 'Test Project');
});

test('"(Do not move current voter)" keeps the voter in place when Done is clicked', async ({ page }) => {
  // Writing is the column a TODO voter lands in once its postcard is opened.
  await openAutomationForm(page, 1);
  const doneSelect = automationSelect(page, 'When Done button is clicked', 'Move the current voter to');
  await doneSelect.selectOption({ label: '(Do not move current voter)' });
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.automation-panel')).toHaveCount(0);

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

  // The only voter: opening it bumps it into Writing, leaving TODO empty, so
  // no "Next voter" button is shown — just Done.
  await page.locator('.voter-card', { hasText: 'Jane Doe' }).click();
  await page.waitForSelector('.detail-panel', { state: 'visible' });
  await expect(page.getByRole('button', { name: 'Next voter' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Done', exact: true }).click();

  await expect(page.locator('.toast', { hasText: 'Written' })).toContainText('Moved Jane Doe to the Written column');
  const writtenColumn = page.locator('.column', { hasText: 'Written' });
  await expect(writtenColumn.locator('.voter-card', { hasText: 'Jane Doe' })).toBeVisible();
});
