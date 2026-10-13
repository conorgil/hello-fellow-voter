import { test, expect } from '@playwright/test';
import { resetApp, createProject } from './helpers';

test('creates a project and shows the default board columns', async ({ page }) => {
  await resetApp(page);
  await createProject(page, 'Test Project');

  await expect(page.locator('.board-header__title-label')).toHaveText('Test Project');
  for (const label of ['TODO', 'Writing', 'Written', 'Stamp Applied', 'Mailed']) {
    await expect(page.locator('.column__title-label', { hasText: label })).toBeVisible();
  }
});
