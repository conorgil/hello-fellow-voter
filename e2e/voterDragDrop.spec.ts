import { test, expect } from '@playwright/test';
import { resetApp, createProject, addVoter } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetApp(page);
  await createProject(page, 'Test Project');
});

// Regression test: the column-reordering drag-and-drop library attaches its
// own native dragstart listener to the enclosing .column element, which used
// to cancel a voter card's own drag before it could reach dragover/drop — the
// card greyed out but never moved. See src/board/dragDrop.ts for the fix.
test('dragging a voter card to another column actually moves it there', async ({ page }) => {
  await addVoter(page, { name: 'First Voter', street: '1 Main St', city: 'Springfield', state: 'IL', zip: '62704' });

  const card = page.locator('.voter-card', { hasText: 'First Voter' });
  const todoColumn = page.locator('.column', { hasText: 'TODO' });
  const writingColumnBody = page.locator('.column', { hasText: 'Writing' }).locator('.column__body');

  await card.dragTo(writingColumnBody);

  await expect(writingColumnBody.locator('.voter-card', { hasText: 'First Voter' })).toBeVisible();
  await expect(todoColumn.locator('.voter-card', { hasText: 'First Voter' })).toHaveCount(0);
  await expect(card).not.toHaveClass(/dragging/);
});
