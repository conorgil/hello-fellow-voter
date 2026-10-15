import { expect, test } from '@playwright/test';
import {
  addVoter,
  automationSelect,
  createLabel,
  createProject,
  openAutomationForm,
  openLabelManager,
  openVoterDetail,
  resetApp,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await resetApp(page);
  await createProject(page, 'Labels Project');
});

test('creates a label with a preset color and shows it as a badge once assigned', async ({ page }) => {
  await addVoter(page, { name: 'Alice Voter', street: '1 Main St', city: 'Town', state: 'TX', zip: '75000' });

  await openVoterDetail(page, 'Alice Voter');
  await openLabelManager(page);
  await createLabel(page, 'Batch 1');
  await expect(page.locator('.label-manager__row')).toHaveCount(1);
  await page.locator('.label-manager-panel').getByRole('button', { name: 'Close' }).click();

  await page.locator('.detail-panel__labels button', { hasText: '+ Label' }).click();
  await page.locator('.detail-panel__labels .label-picker__item', { hasText: 'Batch 1' }).click();
  await expect(page.locator('.detail-panel__labels .label-badge')).toHaveCount(1);
  await page.locator('.detail-panel__close').click();

  await expect(
    page.locator('.voter-card', { hasText: 'Alice Voter' }).locator('.label-badge', { hasText: 'Batch 1' }),
  ).toBeVisible();
});

test('creates a label with a custom color', async ({ page }) => {
  await addVoter(page, { name: 'Alice Voter', street: '1 Main St', city: 'Town', state: 'TX', zip: '75000' });

  await openVoterDetail(page, 'Alice Voter');
  await openLabelManager(page);
  await page.getByRole('button', { name: '+ New label' }).click();
  await page.locator('.label-manager__add-form input[type="text"]').fill('Custom Color');
  await page.locator('.label-manager__add-form .color-swatch--custom').click();
  await page.locator('.label-manager__add-form input[type="color"]').fill('#123456');
  await page.locator('.label-manager__add-form button[type="submit"]').click();

  const row = page.locator('.label-manager__row', { hasText: 'Custom Color' });
  await expect(row.locator('.label-badge')).toHaveCSS('background-color', 'rgb(18, 52, 86)');
});

test('creates and applies a label inline from the voter detail picker', async ({ page }) => {
  await addVoter(page, { name: 'Alice Voter', street: '1 Main St', city: 'Town', state: 'TX', zip: '75000' });

  await openVoterDetail(page, 'Alice Voter');
  await page.locator('.detail-panel__labels button', { hasText: '+ Label' }).click();
  await page.locator('.label-picker__search').fill('Batch 1');
  await page.locator('.label-picker__create-row', { hasText: 'Batch 1' }).click();

  const createForm = page.locator('.label-picker__create-form');
  await expect(createForm).toBeVisible();
  await createForm.locator('.color-swatch').first().click();
  await createForm.locator('button', { hasText: 'Create' }).click();

  await expect(page.locator('.detail-panel__labels .label-badge', { hasText: 'Batch 1' })).toBeVisible();
  await page.locator('.detail-panel__close').click();

  await expect(
    page.locator('.voter-card', { hasText: 'Alice Voter' }).locator('.label-badge', { hasText: 'Batch 1' }),
  ).toBeVisible();
});

test('edits and deletes a label, updating card badges accordingly', async ({ page }) => {
  await addVoter(page, { name: 'Alice Voter', street: '1 Main St', city: 'Town', state: 'TX', zip: '75000' });

  await openVoterDetail(page, 'Alice Voter');
  await openLabelManager(page);
  await createLabel(page, 'Batch 1');
  await page.locator('.label-manager-panel').getByRole('button', { name: 'Close' }).click();

  await page.locator('.detail-panel__labels button', { hasText: '+ Label' }).click();
  await page.locator('.detail-panel__labels .label-picker__item', { hasText: 'Batch 1' }).click();
  await page.locator('.detail-panel__close').click();

  await openVoterDetail(page, 'Alice Voter');
  await openLabelManager(page);
  await page.locator('.label-manager__row', { hasText: 'Batch 1' }).getByLabel('Edit Batch 1').click();
  await page.locator('.label-manager__edit-form input[type="text"]').fill('Batch One');
  await page.locator('.label-manager__edit-form button[type="submit"]').click();
  await expect(page.locator('.label-manager__row')).toContainText('Batch One');
  await page.locator('.label-manager-panel').getByRole('button', { name: 'Close' }).click();
  await page.locator('.detail-panel__close').click();

  await expect(
    page.locator('.voter-card', { hasText: 'Alice Voter' }).locator('.label-badge', { hasText: 'Batch One' }),
  ).toBeVisible();

  await openVoterDetail(page, 'Alice Voter');
  await openLabelManager(page);
  await page.locator('.label-manager__row', { hasText: 'Batch One' }).getByLabel('Delete Batch One').click();
  await page.locator('.confirm-dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('.label-manager__row')).toHaveCount(0);
  await page.locator('.label-manager-panel').getByRole('button', { name: 'Close' }).click();
  await page.locator('.detail-panel__close').click();

  await expect(page.locator('.voter-card', { hasText: 'Alice Voter' }).locator('.label-badge')).toHaveCount(0);
});

test('Escape closes only the label manager when opened on top of the detail view', async ({ page }) => {
  await addVoter(page, { name: 'Alice Voter', street: '1 Main St', city: 'Town', state: 'TX', zip: '75000' });

  await openVoterDetail(page, 'Alice Voter');
  await openLabelManager(page);

  await page.keyboard.press('Escape');
  await expect(page.locator('.label-manager-panel')).toHaveCount(0);
  await expect(page.locator('.detail-panel')).toBeVisible();
});

test('batch-assigns a label to a multi-selection via the batch toolbar', async ({ page }) => {
  await addVoter(page, { name: 'Alice Voter', street: '1 Main St', city: 'Town', state: 'TX', zip: '75000' });
  await addVoter(page, { name: 'Bob Voter', street: '2 Main St', city: 'Town', state: 'TX', zip: '75000' });

  await openVoterDetail(page, 'Alice Voter');
  await openLabelManager(page);
  await createLabel(page, 'Batch 1');
  await page.locator('.label-manager-panel').getByRole('button', { name: 'Close' }).click();
  await page.locator('.detail-panel__close').click();

  await page.locator('.voter-card', { hasText: 'Alice Voter' }).locator('.voter-card__select').click();
  await page.locator('.voter-card', { hasText: 'Bob Voter' }).locator('.voter-card__select').click();

  await page.locator('.board-batch-bar button', { hasText: 'Add/remove labels' }).click();
  await page.locator('.board-batch-bar .label-picker__item', { hasText: 'Batch 1' }).click();
  await expect(page.locator('.toast', { hasText: 'Labeled 2 voters' })).toBeVisible();
  await page.locator('.board-batch-bar button', { hasText: 'Clear selection' }).click();

  await expect(
    page.locator('.voter-card', { hasText: 'Alice Voter' }).locator('.label-badge', { hasText: 'Batch 1' }),
  ).toBeVisible();
  await expect(
    page.locator('.voter-card', { hasText: 'Bob Voter' }).locator('.label-badge', { hasText: 'Batch 1' }),
  ).toBeVisible();
});

test('shows the batch toolbar and creates a label inline when none exist yet', async ({ page }) => {
  await addVoter(page, { name: 'Alice Voter', street: '1 Main St', city: 'Town', state: 'TX', zip: '75000' });
  await addVoter(page, { name: 'Bob Voter', street: '2 Main St', city: 'Town', state: 'TX', zip: '75000' });

  await page.locator('.voter-card', { hasText: 'Alice Voter' }).locator('.voter-card__select').click();
  await page.locator('.voter-card', { hasText: 'Bob Voter' }).locator('.voter-card__select').click();

  const batchBar = page.locator('.board-batch-bar');
  await expect(batchBar).toBeVisible();
  await expect(batchBar).toContainText('2 selected');

  await batchBar.getByRole('button', { name: 'Add/remove labels' }).click();
  await page.locator('.board-batch-bar .label-picker__search').fill('Batch 1');
  await page.locator('.board-batch-bar .label-picker__create-row', { hasText: 'Batch 1' }).click();
  await page.locator('.board-batch-bar .label-picker__create-form .color-swatch').first().click();
  await page.locator('.board-batch-bar .label-picker__create-form button', { hasText: 'Create' }).click();

  await expect(page.locator('.toast', { hasText: 'Labeled 2 voters' })).toBeVisible();
  await page.locator('.board-batch-bar button', { hasText: 'Clear selection' }).click();

  await expect(
    page.locator('.voter-card', { hasText: 'Alice Voter' }).locator('.label-badge', { hasText: 'Batch 1' }),
  ).toBeVisible();
  await expect(
    page.locator('.voter-card', { hasText: 'Bob Voter' }).locator('.label-badge', { hasText: 'Batch 1' }),
  ).toBeVisible();
});

test('auto-assigns a label on column entry via drag-and-keyboard move, and via the automation form', async ({
  page,
}) => {
  await addVoter(page, { name: 'Bob Voter', street: '2 Main St', city: 'Town', state: 'TX', zip: '75000' });

  await openVoterDetail(page, 'Bob Voter');
  await openLabelManager(page);
  await createLabel(page, 'Batch 1');
  await page.locator('.label-manager-panel').getByRole('button', { name: 'Close' }).click();
  await page.locator('.detail-panel__close').click();

  // Opening the detail view above already auto-advanced Bob from TODO into Writing
  // (this project's existing onOpen automation, unrelated to labels) — move him back
  // to TODO so the ArrowRight below freshly enters Writing and triggers the label
  // automation being configured next.
  const bobCard = page.locator('.voter-card', { hasText: 'Bob Voter' });
  await bobCard.focus();
  await bobCard.press('ArrowLeft');

  await openAutomationForm(page, 1);
  await automationSelect(page, 'Whenever a voter enters this column', 'Assign the label').selectOption({
    label: 'Batch 1',
  });
  await page.locator('.automation-panel button[type="submit"]').click();

  await bobCard.focus();
  await bobCard.press('ArrowRight');

  await expect(bobCard.locator('.label-badge', { hasText: 'Batch 1' })).toBeVisible();
});

test('creates a label inline from the column automation form', async ({ page }) => {
  await addVoter(page, { name: 'Bob Voter', street: '2 Main St', city: 'Town', state: 'TX', zip: '75000' });

  await openAutomationForm(page, 1);
  const labelSelect = automationSelect(page, 'Whenever a voter enters this column', 'Assign the label');
  await labelSelect.selectOption({ label: '+ Create new label...' });

  const createForm = page.locator('.automation-label-create');
  await expect(createForm).toBeVisible();
  await createForm.locator('input[type="text"]').fill('Batch 1');
  await createForm.locator('.color-swatch').first().click();
  await createForm.locator('button', { hasText: 'Add' }).click();

  await expect(createForm).toBeHidden();
  await expect(labelSelect).toHaveValue(/.+/);
  await expect(labelSelect.locator('option', { hasText: 'Batch 1' })).toHaveCount(1);

  await page.locator('.automation-panel button[type="submit"]').click();

  const bobCard = page.locator('.voter-card', { hasText: 'Bob Voter' });
  await bobCard.focus();
  await bobCard.press('ArrowRight');

  await expect(bobCard.locator('.label-badge', { hasText: 'Batch 1' })).toBeVisible();
});

test('clicking a label badge filters the board, and clicking it again restores it', async ({ page }) => {
  await addVoter(page, { name: 'Alice Voter', street: '1 Main St', city: 'Town', state: 'TX', zip: '75000' });
  await addVoter(page, { name: 'Bob Voter', street: '2 Main St', city: 'Town', state: 'TX', zip: '75000' });

  await openVoterDetail(page, 'Alice Voter');
  await openLabelManager(page);
  await createLabel(page, 'Batch 1');
  await page.locator('.label-manager-panel').getByRole('button', { name: 'Close' }).click();
  await page.locator('.detail-panel__close').click();

  await page.locator('.voter-card', { hasText: 'Alice Voter' }).locator('.voter-card__select').click();
  await page.locator('.board-batch-bar button', { hasText: 'Add/remove labels' }).click();
  await page.locator('.board-batch-bar .label-picker__item', { hasText: 'Batch 1' }).click();
  await page.locator('.board-batch-bar button', { hasText: 'Clear selection' }).click();

  const aliceBadge = page.locator('.voter-card', { hasText: 'Alice Voter' }).locator('.label-badge', {
    hasText: 'Batch 1',
  });
  await aliceBadge.click();

  await expect(page.locator('.voter-card', { hasText: 'Bob Voter' })).toHaveCount(0);
  await expect(aliceBadge).toHaveClass(/label-badge--active-filter/);

  await aliceBadge.click();
  await expect(page.locator('.voter-card', { hasText: 'Bob Voter' })).toBeVisible();
});

test('clicking label badges on different cards combines active filters with OR semantics', async ({ page }) => {
  await addVoter(page, { name: 'Alice Voter', street: '1 Main St', city: 'Town', state: 'TX', zip: '75000' });
  await addVoter(page, { name: 'Bob Voter', street: '2 Main St', city: 'Town', state: 'TX', zip: '75000' });
  await addVoter(page, { name: 'Cara Voter', street: '3 Main St', city: 'Town', state: 'TX', zip: '75000' });

  await openVoterDetail(page, 'Alice Voter');
  await openLabelManager(page);
  await createLabel(page, 'Batch 1');
  await createLabel(page, 'Batch 2');
  await page.locator('.label-manager-panel').getByRole('button', { name: 'Close' }).click();
  await page.locator('.detail-panel__close').click();

  // Alice gets both labels so her card (and its badges) stays visible and
  // clickable no matter which of the two filters is currently active — a card
  // that's been filtered out can't have its own badges clicked to add a second
  // filter, so the OR-combination has to be driven from a card matching both.
  await page.locator('.voter-card', { hasText: 'Alice Voter' }).locator('.voter-card__select').click();
  await page.locator('.board-batch-bar button', { hasText: 'Add/remove labels' }).click();
  await page.locator('.board-batch-bar .label-picker__item', { hasText: 'Batch 1' }).click();
  await page.locator('.board-batch-bar .label-picker__item', { hasText: 'Batch 2' }).click();
  await page.locator('.board-batch-bar button', { hasText: 'Clear selection' }).click();

  await page.locator('.voter-card', { hasText: 'Bob Voter' }).locator('.voter-card__select').click();
  await page.locator('.board-batch-bar button', { hasText: 'Add/remove labels' }).click();
  await page.locator('.board-batch-bar .label-picker__item', { hasText: 'Batch 2' }).click();
  await page.locator('.board-batch-bar button', { hasText: 'Clear selection' }).click();

  const aliceBatch1Badge = page.locator('.voter-card', { hasText: 'Alice Voter' }).locator('.label-badge', {
    hasText: 'Batch 1',
  });
  const aliceBatch2Badge = page.locator('.voter-card', { hasText: 'Alice Voter' }).locator('.label-badge', {
    hasText: 'Batch 2',
  });

  await aliceBatch1Badge.click();
  await expect(page.locator('.voter-card', { hasText: 'Alice Voter' })).toBeVisible();
  await expect(page.locator('.voter-card', { hasText: 'Bob Voter' })).toHaveCount(0);
  await expect(page.locator('.voter-card', { hasText: 'Cara Voter' })).toHaveCount(0);

  await aliceBatch2Badge.click();
  await expect(page.locator('.voter-card', { hasText: 'Alice Voter' })).toBeVisible();
  await expect(page.locator('.voter-card', { hasText: 'Bob Voter' })).toBeVisible();
  await expect(page.locator('.voter-card', { hasText: 'Cara Voter' })).toHaveCount(0);

  await aliceBatch1Badge.click();
  await aliceBatch2Badge.click();
  await expect(page.locator('.voter-card', { hasText: 'Cara Voter' })).toBeVisible();
});
