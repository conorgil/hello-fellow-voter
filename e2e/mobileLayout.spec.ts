import { test, expect } from '@playwright/test';
import { resetApp, createProject, openAutomationForm, addVoter, openVoterDetail } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

test('modals fill the viewport edge-to-edge on mobile', async ({ page }) => {
  await resetApp(page);
  await createProject(page, 'Mobile Project');

  await openAutomationForm(page, 0);
  const automationBox = await page.locator('.automation-panel').boundingBox();
  expect(automationBox?.width).toBeGreaterThanOrEqual(389);
  expect(automationBox?.height).toBeGreaterThanOrEqual(843);
  await page.keyboard.press('Escape');

  await page.locator('.board-header__menu-toggle').click();
  await page.getByRole('button', { name: /add single voter/i }).click();
  const formBox = await page.locator('.form-panel').boundingBox();
  expect(formBox?.width).toBeGreaterThanOrEqual(389);
  expect(formBox?.height).toBeGreaterThanOrEqual(843);
});

test('voter detail view fills the screen, auto-rotated to landscape in portrait', async ({ page }) => {
  await resetApp(page);
  await createProject(page, 'Mobile Project');

  await page.locator('.board-header__menu-toggle').click();
  await addVoter(page, { name: 'Jane Voter', street: '1 Main St', city: 'Springfield', state: 'IL', zip: '62701' });
  await openVoterDetail(page, 'Jane Voter');

  // The panel is rotated via CSS transform (no physical device rotation), so its
  // on-screen bounding box should still fill the (portrait) viewport edge-to-edge.
  const detailBox = await page.locator('.detail-panel').boundingBox();
  expect(detailBox?.width).toBeGreaterThanOrEqual(389);
  expect(detailBox?.height).toBeGreaterThanOrEqual(843);

  // Its un-rotated layout box is landscape-shaped (width:100vh x height:100vw),
  // which is what gives the address line room to render at a readable size.
  const addressLineWidth = await page.locator('.postcard-address__line').first().evaluate((el) => el.clientWidth);
  expect(addressLineWidth).toBeGreaterThan(300);

  // The on-open automation fires a toast while the rotated view is already showing;
  // it should be rotated to match (hugging the real right edge) instead of landing
  // right-side-up on top of the panel.
  const toastBox = await page.locator('.toast').first().boundingBox();
  const viewport = page.viewportSize()!;
  expect(toastBox).not.toBeNull();
  expect(toastBox!.x + toastBox!.width).toBeGreaterThan(viewport.width - 40);
  expect(toastBox!.x + toastBox!.width).toBeLessThanOrEqual(viewport.width);
});

test('board actions collapse behind the hamburger menu, with undo/redo always visible', async ({ page }) => {
  await resetApp(page);
  await createProject(page, 'Mobile Project');

  for (const btn of await page.locator('.board-header__history-btn').all()) {
    await expect(btn).toBeVisible();
  }

  const addVoterBtn = page.getByRole('button', { name: /add single voter/i });
  await expect(addVoterBtn).toBeHidden();

  await page.locator('.board-header__menu-toggle').click();
  await expect(addVoterBtn).toBeVisible();
  await addVoterBtn.click();
  await expect(page.locator('.form-panel')).toBeVisible();
});

test('project row actions stack below the info instead of overflowing the card', async ({ page }) => {
  await resetApp(page);
  await createProject(page, 'Mobile Project');
  await page.getByRole('button', { name: 'All projects' }).click();
  await page.waitForSelector('.project-row');

  const viewport = page.viewportSize()!;
  for (const label of ['Open', 'Rename', 'Delete']) {
    const box = await page.locator('.project-row button', { hasText: label }).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  }
});

test('back link shows only the arrow but keeps its accessible name', async ({ page }) => {
  await resetApp(page);
  await createProject(page, 'Mobile Project');

  await expect(page.getByRole('button', { name: 'All projects' })).toBeVisible();
  await expect(page.locator('.board-header__back-text')).toBeHidden();
});

test('the GitHub corner ribbon is hidden', async ({ page }) => {
  await resetApp(page);
  await expect(page.locator('.gh-corner')).toBeHidden();
});
