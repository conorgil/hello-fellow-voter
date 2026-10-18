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

  await expect(page.locator('.toast')).toContainText('6');
  for (const voter of voters) {
    await expect(page.locator('.voter-card', { hasText: voter.name })).toBeVisible();
  }
});
