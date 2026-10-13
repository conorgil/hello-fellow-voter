import type { Locator, Page } from '@playwright/test';

export async function resetApp(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const getStartedBtn = page.getByRole('button', { name: /get started/i });
  if (await getStartedBtn.isVisible().catch(() => false)) {
    await getStartedBtn.click();
  }
}

export async function createProject(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: /new project/i }).click();
  await page.locator('input[type="text"]').fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForSelector('.board', { state: 'visible' });
}

export async function openColumnMenu(page: Page, columnIndex: number) {
  const menuButton = page.locator('.dropdown button', { hasText: '⋯' }).nth(columnIndex);
  await menuButton.click();
  return page.locator('.dropdown__menu').locator('visible=true');
}

export async function openAutomationForm(page: Page, columnIndex: number): Promise<void> {
  const menu = await openColumnMenu(page, columnIndex);
  await menu.getByText('Edit automation', { exact: true }).click();
  await page.waitForSelector('.automation-panel', { state: 'visible' });
}

/**
 * Looks up a dropdown in the automation modal by its fieldset legend and field
 * label, rather than DOM position, so tests don't break when fields are reordered.
 */
export function automationSelect(page: Page, groupLegend: string, fieldLabel: string): Locator {
  const group = page.locator('.automation-group', { hasText: groupLegend });
  return group.locator('.automation-field', { hasText: fieldLabel }).locator('select');
}

/** Assumes a voter's detail view is already open — reaches the manager via the label picker's "Edit labels" link. */
export async function openLabelManager(page: Page): Promise<void> {
  await page.locator('.detail-panel__labels button', { hasText: '+ Label' }).click();
  await page.locator('.label-picker__footer button', { hasText: 'Edit labels' }).click();
  await page.waitForSelector('.label-manager-panel', { state: 'visible' });
}

export async function openVoterDetail(page: Page, nameText: string): Promise<void> {
  await page.locator('.voter-card', { hasText: nameText }).click();
  await page.waitForSelector('.detail-panel', { state: 'visible' });
}

export async function createLabel(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: '+ New label' }).click();
  await page.locator('.label-manager__add-form input[type="text"]').fill(name);
  await page.locator('.label-manager__add-form .color-swatch').first().click();
  await page.locator('.label-manager__add-form button[type="submit"]').click();
}

export async function addVoter(
  page: Page,
  voter: { name: string; street: string; city: string; state: string; zip: string },
): Promise<void> {
  await page.getByRole('button', { name: /add single voter/i }).click();
  const form = page.locator('.form-panel form');
  await form.getByLabel('Name').fill(voter.name);
  await form.getByLabel('Street').fill(voter.street);
  await form.getByLabel('City').fill(voter.city);
  await form.getByLabel('State').fill(voter.state);
  await form.getByLabel('ZIP').fill(voter.zip);
  await form.getByRole('button', { name: 'Add voter' }).click();
  await page.waitForSelector('.voter-card', { state: 'visible' });
}
