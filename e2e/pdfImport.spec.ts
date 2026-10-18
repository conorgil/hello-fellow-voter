import { test, expect } from '@playwright/test';
import { buildTwoColumnMultiLinePdf } from '../src/pdf/buildTestPdf';
import { generateFakeVoters } from '../src/pdf/fakeVoters';
import { resetApp, createProject } from './helpers';

test('imports a 2-column, multi-line voter PDF through the real upload UI', async ({ page }) => {
  const voters = generateFakeVoters(6);
  const buffer = Buffer.from(buildTwoColumnMultiLinePdf(voters));

  await resetApp(page);
  await createProject(page, 'PDF Import Test');

  await page.getByRole('button', { name: 'Import voter list...' }).click();
  await page.getByRole('button', { name: '...via PDF' }).click();
  await page.waitForSelector('.pdf-import-panel', { state: 'visible' });

  await page
    .locator('.pdf-drop-zone input[type="file"]')
    .setInputFiles({ name: 'generated.pdf', mimeType: 'application/pdf', buffer });

  // The modal stays open through a results screen instead of closing behind a toast.
  await expect(page.locator('.pdf-import-panel h2')).toHaveText('Import complete');
  await expect(page.locator('.import-result-summary')).toContainText('6');
  for (const voter of voters) {
    await expect(page.locator('.voter-card', { hasText: voter.name })).not.toBeVisible();
  }

  // Apply a label to the imported voters before leaving the results screen.
  await page.locator('.pdf-import-panel .form-actions button', { hasText: 'Add labels to new voters' }).click();
  await page.locator('.label-picker__search').fill('Door knocked');
  await page.locator('.label-picker__create-row').click();
  await page.locator('.label-picker__create-form button', { hasText: 'Create' }).click();
  // Click elsewhere inside the panel (not the overlay background) to close the
  // label picker's own dropdown without triggering the modal's Escape/outside-click
  // dismissal, which is equivalent to Done during the results phase.
  await page.locator('.import-result-summary').click();

  await page.getByRole('button', { name: 'Done' }).click();

  await expect(page.locator('.pdf-import-panel')).toHaveCount(0);
  for (const voter of voters) {
    const card = page.locator('.voter-card', { hasText: voter.name });
    await expect(card).toBeVisible();
    await expect(card.locator('.label-badge', { hasText: 'Door knocked' })).toBeVisible();
  }
});
