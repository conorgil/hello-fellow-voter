import { test, expect } from '@playwright/test';
import { resetApp, createProject, addVoter, openVoterDetail } from './helpers';

test.describe('desktop (mouse/trackpad, no touch emulation)', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
    await createProject(page, 'Test Project');
    await addVoter(page, { name: 'Jane Voter', street: '1 Main St', city: 'Springfield', state: 'IL', zip: '62704' });
    await openVoterDetail(page, 'Jane Voter');
  });

  for (const [label, size] of Object.entries({
    wide: { width: 1440, height: 900 },
    square: { width: 900, height: 900 },
    tall: { width: 700, height: 1000 },
  })) {
    test(`postcard keeps the real 4x6 (3:2) ratio at a ${label} window size`, async ({ page }) => {
      await page.setViewportSize(size);
      const box = await page.locator('.postcard').boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width / box!.height).toBeCloseTo(1.5, 1);
    });
  }

  test('a narrow, portrait-shaped laptop window is not rotated into landscape', async ({ page }) => {
    // Same shape (narrow + taller than wide) that triggers the mobile
    // auto-rotation on a real phone, but this context has no touch — a
    // laptop window resized to this shape must render right-side-up.
    await page.setViewportSize({ width: 500, height: 800 });
    const transform = await page.locator('.overlay--detail').evaluate((el) => getComputedStyle(el).transform);
    expect(transform).toBe('none');
  });

  test('a short, landscape-shaped laptop window keeps the postcard un-stretched', async ({ page }) => {
    // Same shape (landscape + short) that triggers the mobile compact-chrome
    // layout (which deliberately drops the aspect ratio) on a real phone
    // rotated sideways — but this context has no touch, so the postcard
    // should stay a real 3:2 card instead of stretching to fill the frame.
    await page.setViewportSize({ width: 900, height: 450 });
    const box = await page.locator('.postcard').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width / box!.height).toBeCloseTo(1.5, 1);
  });

  test('the close button never overlaps the postcard or the GitHub corner ribbon', async ({ page }) => {
    for (const size of [
      { width: 1440, height: 900 },
      { width: 900, height: 900 },
      { width: 700, height: 1000 },
    ]) {
      await page.setViewportSize(size);
      const closeBox = await page.locator('.detail-panel__close').boundingBox();
      const postcardBox = await page.locator('.postcard').boundingBox();
      const ribbonBox = await page.locator('.gh-corner').boundingBox();
      expect(closeBox).not.toBeNull();
      expect(postcardBox).not.toBeNull();
      expect(boxesOverlap(closeBox!, postcardBox!)).toBe(false);
      if (ribbonBox) expect(boxesOverlap(closeBox!, ribbonBox)).toBe(false);
    }

    await page.locator('.detail-panel__close').click();
    await expect(page.locator('.detail-panel')).toHaveCount(0);
  });

  test('a long address is never clipped, including after the window shrinks and grows back', async ({ page }) => {
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

    async function expectNoOverflow() {
      const overflowing = await page.locator('.postcard-address__line').evaluateAll((lines) =>
        lines.some((line) => line.scrollWidth > line.clientWidth + 1),
      );
      expect(overflowing).toBe(false);
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await expectNoOverflow();

    await page.setViewportSize({ width: 500, height: 400 });
    await expectNoOverflow();

    const shrunkFontSize = await page.locator('.postcard-address__line').first().evaluate((el) => getComputedStyle(el).fontSize);

    await page.setViewportSize({ width: 1440, height: 900 });
    await expectNoOverflow();

    const grownFontSize = await page.locator('.postcard-address__line').first().evaluate((el) => getComputedStyle(el).fontSize);
    expect(parseFloat(grownFontSize)).toBeGreaterThan(parseFloat(shrunkFontSize));
  });
});

function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
