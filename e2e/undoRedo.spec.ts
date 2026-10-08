import { test, expect } from '@playwright/test';
import { resetApp, createProject, addVoter } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetApp(page);
  await createProject(page, 'Test Project');
});

test('undo/redo buttons are disabled until there is history, and tooltips name the shortcut', async ({ page }) => {
  const undoBtn = page.getByRole('button', { name: 'Undo' });
  const redoBtn = page.getByRole('button', { name: 'Redo' });

  await expect(undoBtn).toBeDisabled();
  await expect(redoBtn).toBeDisabled();

  await undoBtn.hover({ force: true });
  await expect(undoBtn.locator('.tooltip')).toHaveText(/^Undo \((Ctrl\+Z|⌘Z)\)$/);
  await redoBtn.hover({ force: true });
  await expect(redoBtn.locator('.tooltip')).toHaveText(/^Redo \((Ctrl\+Y|⇧⌘Z)\)$/);
});

test('undo removes the last change and redo reapplies it', async ({ page }) => {
  await addVoter(page, { name: 'Jane Doe', street: '1 Main St', city: 'Springfield', state: 'IL', zip: '62704' });
  await expect(page.locator('.voter-card', { hasText: 'Jane Doe' })).toBeVisible();

  const undoBtn = page.getByRole('button', { name: 'Undo' });
  const redoBtn = page.getByRole('button', { name: 'Redo' });
  await expect(undoBtn).toBeEnabled();
  await expect(redoBtn).toBeDisabled();

  await undoBtn.click();
  await expect(page.locator('.voter-card', { hasText: 'Jane Doe' })).toHaveCount(0);
  await expect(redoBtn).toBeEnabled();

  await redoBtn.click();
  await expect(page.locator('.voter-card', { hasText: 'Jane Doe' })).toBeVisible();
});
