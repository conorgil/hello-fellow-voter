import { test, expect } from '@playwright/test';
import { DEFAULT_ADDRESS_FONT_SIZE, MAX_ADDRESS_FONT_SIZE, MIN_ADDRESS_FONT_SIZE } from '../src/addressView';
import { addVoter, createProject, openVoterDetail, resetApp, setRangeInputValue } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetApp(page);
  await createProject(page, 'Test Project');
  await addVoter(page, { name: 'Jane Voter', street: '1 Main St', city: 'Springfield', state: 'IL', zip: '62704' });
  await openVoterDetail(page, 'Jane Voter');
});

test('opens in postcard mode by default', async ({ page }) => {
  await expect(page.locator('.postcard-frame')).toBeVisible();
  await expect(page.locator('.address-only-frame')).toBeHidden();
});

test('toggling shows exactly one of the two views at a time', async ({ page }) => {
  const toggle = page.locator('.detail-panel__view-toggle');

  await toggle.click();
  await expect(page.locator('.address-only-frame')).toBeVisible();
  await expect(page.locator('.postcard-frame')).toBeHidden();

  await toggle.click();
  await expect(page.locator('.postcard-frame')).toBeVisible();
  await expect(page.locator('.address-only-frame')).toBeHidden();
});

test('toggle button label flips with the mode', async ({ page }) => {
  const toggle = page.locator('.detail-panel__view-toggle');
  await expect(toggle).toHaveAttribute('aria-label', 'Switch to address-only view');

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-label', 'Switch to postcard view');
});

test('address-only mode persists across closing and reopening the same voter', async ({ page }) => {
  await page.locator('.detail-panel__view-toggle').click();
  await expect(page.locator('.address-only-frame')).toBeVisible();

  await page.locator('.detail-panel__close').click();
  await openVoterDetail(page, 'Jane Voter');

  await expect(page.locator('.address-only-frame')).toBeVisible();
  await expect(page.locator('.postcard-frame')).toBeHidden();
});

test('view mode is independent per project', async ({ page }) => {
  await page.locator('.detail-panel__view-toggle').click();
  await expect(page.locator('.address-only-frame')).toBeVisible();
  await page.locator('.detail-panel__close').click();

  await page.locator('.board-header__back').click();
  await createProject(page, 'Second Project');
  await addVoter(page, { name: 'Second Voter', street: '2 Main St', city: 'Springfield', state: 'IL', zip: '62704' });
  await openVoterDetail(page, 'Second Voter');

  await expect(page.locator('.postcard-frame')).toBeVisible();
  await expect(page.locator('.address-only-frame')).toBeHidden();
});

test('slider live-updates the font size and persists it across reopen', async ({ page }) => {
  await page.locator('.detail-panel__view-toggle').click();
  const slider = page.locator('.address-only-font-slider');
  const line = page.locator('.address-only-view__line').first();

  const initialSize = parseFloat(await line.evaluate((el) => getComputedStyle(el).fontSize));
  await setRangeInputValue(slider, MAX_ADDRESS_FONT_SIZE);
  const updatedSize = parseFloat(await line.evaluate((el) => getComputedStyle(el).fontSize));
  expect(updatedSize).toBeGreaterThan(initialSize);

  await page.locator('.detail-panel__close').click();
  await openVoterDetail(page, 'Jane Voter');

  await expect(page.locator('.address-only-font-slider')).toHaveValue(String(MAX_ADDRESS_FONT_SIZE));
  const persistedSize = parseFloat(
    await page.locator('.address-only-view__line').first().evaluate((el) => getComputedStyle(el).fontSize),
  );
  expect(persistedSize).toBe(updatedSize);
});

test('slider bounds match the configured min/max, not hardcoded numbers', async ({ page }) => {
  await page.locator('.detail-panel__view-toggle').click();
  const slider = page.locator('.address-only-font-slider');
  await expect(slider).toHaveAttribute('min', String(MIN_ADDRESS_FONT_SIZE));
  await expect(slider).toHaveAttribute('max', String(MAX_ADDRESS_FONT_SIZE));
  await expect(slider).toHaveValue(String(DEFAULT_ADDRESS_FONT_SIZE));
});

test('the font-size slider row stays in the same place as the font size changes', async ({ page }) => {
  await page.locator('.detail-panel__view-toggle').click();
  const sliderRow = page.locator('.address-only-font-row');

  const boxAtDefault = await sliderRow.boundingBox();
  await setRangeInputValue(page.locator('.address-only-font-slider'), MAX_ADDRESS_FONT_SIZE);
  const boxAtMax = await sliderRow.boundingBox();

  expect(boxAtDefault).not.toBeNull();
  expect(boxAtMax).not.toBeNull();
  expect(boxAtMax!.y).toBeCloseTo(boxAtDefault!.y, 0);
});

test('a long address wraps without clipping or overflowing the panel, even at the max font size', async ({ page }) => {
  await resetApp(page);
  await createProject(page, 'Test Project');
  await addVoter(page, {
    name: 'Cornwell Shakoor-Washington',
    street: '926 E Stafford St Apt 4B',
    city: 'Philadelphia',
    state: 'PA',
    zip: '19104',
  });
  await openVoterDetail(page, 'Cornwell Shakoor-Washington');
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.locator('.detail-panel__view-toggle').click();
  await setRangeInputValue(page.locator('.address-only-font-slider'), MAX_ADDRESS_FONT_SIZE);

  const overflowingHorizontally = await page
    .locator('.address-only-view__line')
    .evaluateAll((lines) => lines.some((line) => line.scrollWidth > line.clientWidth + 1));
  expect(overflowingHorizontally).toBe(false);

  const [scrollHeight, clientHeight] = await page
    .locator('.address-only-view')
    .evaluate((el) => [el.scrollHeight, el.clientHeight]);
  expect(scrollHeight).toBeLessThanOrEqual(clientHeight + 1);
});

test('switching back to postcard mode still renders an unclipped address', async ({ page }) => {
  const toggle = page.locator('.detail-panel__view-toggle');
  await toggle.click();
  await toggle.click();

  const overflowing = await page
    .locator('.postcard-address__line')
    .evaluateAll((lines) => lines.some((line) => line.scrollWidth > line.clientWidth + 1));
  expect(overflowing).toBe(false);
});
