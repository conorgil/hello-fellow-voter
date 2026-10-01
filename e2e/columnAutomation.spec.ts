import { test, expect } from '@playwright/test';
import { resetApp, createProject, openAutomationForm, automationSelect } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetApp(page);
  await createProject(page, 'Test Project');
});

test('title names the column being customized', async ({ page }) => {
  await openAutomationForm(page, 0);
  await expect(page.locator('.automation-panel h2')).toHaveText('Automation for the TODO column');
});

test('hides the "into" field when "pull from" is set to none', async ({ page }) => {
  await openAutomationForm(page, 0);

  const pullFromSelect = automationSelect(page, 'When Next voter button is clicked', 'Move voter from');
  const intoField = page.locator('.automation-field', { hasText: 'into' });

  await expect(intoField).toBeVisible();

  await pullFromSelect.selectOption({ label: "(Don't move another voter)" });
  await expect(intoField).toBeHidden();

  await pullFromSelect.selectOption({ label: 'TODO' });
  await expect(intoField).toBeVisible();
});

test('saves the "Display next voter in" setting and reflects it on reopen', async ({ page }) => {
  await openAutomationForm(page, 2); // Written column

  const displaySelect = automationSelect(page, 'When Next voter button is clicked', 'Display next voter in');
  await expect(displaySelect).toHaveValue('written');
  await displaySelect.selectOption({ label: "(Don't automatically display a voter)" });
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.automation-panel')).toHaveCount(0);

  await openAutomationForm(page, 2);
  await expect(
    automationSelect(page, 'When Next voter button is clicked', 'Display next voter in'),
  ).toHaveValue('');
});

test('saves automation settings and reflects them on reopen', async ({ page }) => {
  await openAutomationForm(page, 0);

  const doneSelect = automationSelect(page, 'When Done button is clicked', 'Move the current voter to');
  await doneSelect.selectOption({ label: 'Written' });
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.automation-panel')).toHaveCount(0);

  await openAutomationForm(page, 0);
  await expect(automationSelect(page, 'When Done button is clicked', 'Move the current voter to')).toHaveValue(
    'written',
  );
});

test('moves the voter to the configured column when it is clicked', async ({ page }) => {
  await openAutomationForm(page, 0);

  const onOpenSelect = automationSelect(page, 'When a voter is clicked', 'Move the voter to');
  await expect(onOpenSelect).toHaveValue('writing');
  await onOpenSelect.selectOption({ label: 'Mailed' });
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.automation-panel')).toHaveCount(0);

  await openAutomationForm(page, 0);
  await expect(automationSelect(page, 'When a voter is clicked', 'Move the voter to')).toHaveValue('mailed');
});
