import { jsPDF } from 'jspdf';
import { test, expect } from '@playwright/test';
import { resetApp, createProject } from './helpers';

// Cold WASM init + model load (CDN or local fallback) + recognition can take
// well past Playwright's default 30s test timeout, even for this one-page fixture.
test.setTimeout(90_000);

// Vote Forward's comma-separated format (`src/pdf/parseVoterLine.ts`'s
// `splitByCommaHeuristic`), one voter per line, well clear of each other
// vertically so OCR's row grouping can't confuse them.
const LINES = [
  'KEZIAH MONTGOMERY, 3389 HAWTHORNE ST, Philadelphia, PA 19104',
  'DARREL TAYLOR, 526 N BUDD ST, Philadelphia, PA 19104',
];

const PAGE_WIDTH = 950;
const PAGE_HEIGHT = 260;

/**
 * Builds a small PDF with a real image XObject and genuinely no text layer,
 * to drive the OCR import path. Generated in-memory rather than committed as
 * a fixture file — this repo's .gitignore blanket-excludes `/test-data` and
 * `*.pdf` (vendor terms restrict retaining voter-data PDFs), so there's
 * nowhere to durably check one in.
 */
async function buildScannedPdf(page: import('@playwright/test').Page): Promise<Buffer> {
  const jpegDataUrl = await page.evaluate(
    ({ lines, width, height }) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = 'black';
      ctx.font = '22px sans-serif';
      lines.forEach((line, i) => ctx.fillText(line, 30, 90 + i * 80));
      return canvas.toDataURL('image/jpeg', 0.7);
    },
    { lines: LINES, width: PAGE_WIDTH, height: PAGE_HEIGHT },
  );

  const doc = new jsPDF({ unit: 'px', orientation: 'landscape', format: [PAGE_WIDTH, PAGE_HEIGHT] });
  doc.addImage(jpegDataUrl, 'JPEG', 0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  return Buffer.from(doc.output('arraybuffer'));
}

test('imports voters from a scanned PDF with no text layer via OCR', async ({ page }) => {
  await resetApp(page);
  await createProject(page, 'OCR Import Test');

  const pdfBuffer = await buildScannedPdf(page);

  await page.getByRole('button', { name: 'Import voter list...' }).click();
  await page.locator('.dropdown__item', { hasText: '...via PDF' }).click();
  await page.waitForSelector('.pdf-import-panel', { state: 'visible' });

  await page
    .locator('.pdf-import-panel input[type="file"]')
    .setInputFiles({ name: 'scanned-voter-list.pdf', mimeType: 'application/pdf', buffer: pdfBuffer });

  // OCR phase shows up as progress text before the final toast.
  await expect(page.locator('.pdf-drop-zone__text')).toContainText(/Scanning page/, { timeout: 60_000 });
  await expect(page.locator('.toast')).toContainText('Imported', { timeout: 60_000 });

  await expect(page.locator('.voter-card', { hasText: 'KEZIAH MONTGOMERY' })).toBeVisible();
  await expect(page.locator('.voter-card', { hasText: 'DARREL TAYLOR' })).toBeVisible();
});
