import { test, expect } from '@playwright/test';
import { resetApp, createProject, addVoter, openVoterDetail } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetApp(page);
  await createProject(page, 'Test Project');
  await addVoter(page, { name: 'First Voter', street: '1 Main St', city: 'Springfield', state: 'IL', zip: '62704' });
  await openVoterDetail(page, 'First Voter');
});

test('new project defaults to the "most effective" preset message', async ({ page }) => {
  await expect(page.locator('.postcard__message-text')).toContainText('Who you vote for is private');
});

test('clicking the message opens the picker with intro text and all four options', async ({ page }) => {
  await page.locator('.postcard__message-display').click();
  await page.waitForSelector('.message-picker-panel', { state: 'visible' });

  await expect(page.locator('.message-picker-panel')).toContainText('nonpartisan messages about the voting process');
  await expect(page.locator('.message-picker-panel')).toContainText("finger's width of white space");

  const options = page.locator('.message-picker__option');
  await expect(options).toHaveCount(4);
  await expect(options.nth(0)).toHaveAttribute('aria-checked', 'true');

  await options.filter({ hasText: 'Plan-making' }).click();
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.locator('.postcard__message-text')).toContainText('Please plan ahead!');
});

test('a custom message longer than the longest preset shows a non-blocking warning', async ({ page }) => {
  await page.locator('.postcard__message-display').click();
  await page.waitForSelector('.message-picker-panel', { state: 'visible' });

  await page.locator('.message-picker__option', { hasText: 'Custom message' }).click();
  const textarea = page.locator('.message-picker__textarea');
  await expect(page.locator('.form-warning')).toBeHidden();

  const longMessage = 'x'.repeat(300);
  await textarea.fill(longMessage);
  await expect(page.locator('.form-warning')).toBeVisible();
  await expect(page.locator('.form-warning')).toContainText('might not fit on the postcard');

  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.postcard__message-text')).toHaveText(longMessage);
});

test('replacing a custom message with a preset asks for confirmation', async ({ page }) => {
  await page.locator('.postcard__message-display').click();
  await page.waitForSelector('.message-picker-panel', { state: 'visible' });
  await page.locator('.message-picker__option', { hasText: 'Custom message' }).click();
  await page.locator('.message-picker__textarea').fill('My own hand-written message');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.postcard__message-text')).toHaveText('My own hand-written message');

  await page.locator('.postcard__message-display').click();
  await page.waitForSelector('.message-picker-panel', { state: 'visible' });
  await page.locator('.message-picker__option').filter({ hasText: 'Most effective' }).click();
  await page.getByRole('button', { name: 'Save' }).click();

  await page.waitForSelector('.confirm-dialog', { state: 'visible' });
  await page.locator('.confirm-dialog').getByRole('button', { name: 'Cancel' }).click();
  await page.waitForSelector('.confirm-dialog', { state: 'hidden' });
  await page.locator('.message-picker-panel').getByRole('button', { name: 'Cancel' }).click();
  await page.waitForSelector('.message-picker-panel', { state: 'hidden' });
  await expect(page.locator('.postcard__message-text')).toHaveText('My own hand-written message');

  await page.locator('.postcard__message-display').click();
  await page.waitForSelector('.message-picker-panel', { state: 'visible' });
  await page.locator('.message-picker__option').filter({ hasText: 'Most effective' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForSelector('.confirm-dialog', { state: 'visible' });
  await page.getByRole('button', { name: 'Replace message' }).click();

  await expect(page.locator('.postcard__message-text')).toContainText('Who you vote for is private');
});
