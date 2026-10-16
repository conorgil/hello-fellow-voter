import * as pdfjsLib from 'pdfjs-dist';
import type { PDFPageProxy, TextItem } from 'pdfjs-dist/types/src/display/api';
// The `?url` suffix tells Vite to emit the worker as its own hashed asset and
// give back its final (same-origin, relative) URL, so it's bundled locally
// into dist/ instead of being fetched from a CDN at runtime.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { extractLinesViaOcr, MAX_OCR_PAGES, OcrPageLimitExceededError, pageNeedsOcr } from './ocr';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface PositionedTextItem {
  str: string;
  x: number;
  y: number;
}

/** A line of text extracted from a PDF, tagged with whether it came from the
 * real text layer or had to be OCR'd from a rasterized page image. OCR can
 * misread individual characters in a way pdf.js's exact text layer never
 * does, so callers use this to apply a more forgiving safety net to
 * OCR-sourced lines that fail to parse (see `importPdf.ts`). */
export interface ExtractedLine {
  line: string;
  sourcedFromOcr: boolean;
}

export type PdfImportPhase = 'reading' | 'ocr-setup' | 'ocr';

export interface PdfImportProgress {
  page: number;
  totalPages: number;
  phase: PdfImportPhase;
  /** 0–1. Only meaningful when `phase === 'ocr'`. */
  ocrProgress?: number;
}

export type PdfImportProgressCallback = (progress: PdfImportProgress) => void;

/**
 * Groups positioned text items into lines by baseline Y (within a small
 * tolerance, since fonts/rounding can jitter a shared baseline by ~1pt),
 * then sorts each line's items left-to-right by X before joining. This is
 * pure and DOM/pdf.js-free so it can be unit tested with synthetic items.
 */
export function groupItemsIntoLines(items: PositionedTextItem[], yTolerance = 2): string[] {
  const nonEmpty = items.filter((it) => it.str.trim() !== '');
  const sorted = [...nonEmpty].sort((a, b) => b.y - a.y); // top of page first

  const rows: PositionedTextItem[][] = [];
  for (const item of sorted) {
    const row = rows.find((r) => Math.abs(r[0].y - item.y) <= yTolerance);
    if (row) row.push(item);
    else rows.push([item]);
  }

  return rows.map((row) =>
    [...row]
      .sort((a, b) => a.x - b.x)
      .map((it) => it.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

async function getPageTextItems(page: PDFPageProxy): Promise<PositionedTextItem[]> {
  const content = await page.getTextContent();
  return content.items
    .filter((it): it is TextItem => 'str' in it)
    .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5] }));
}

export async function extractAllLines(
  data: ArrayBuffer,
  onProgress?: PdfImportProgressCallback,
): Promise<ExtractedLine[]> {
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const totalPages = doc.numPages;

  // First pass: classify every page from its (cheap, render-free) text content
  // alone, so the OCR page cap below can be enforced before any expensive
  // rasterization/OCR work starts on a document that's going to be rejected anyway.
  const pages: { page: PDFPageProxy; items: PositionedTextItem[]; needsOcr: boolean }[] = [];
  let ocrPageCount = 0;
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    onProgress?.({ page: pageNum, totalPages, phase: 'reading' });
    const page = await doc.getPage(pageNum);
    const items = await getPageTextItems(page);
    const needsOcr = pageNeedsOcr(items);
    if (needsOcr) ocrPageCount++;
    pages.push({ page, items, needsOcr });
  }

  if (ocrPageCount > MAX_OCR_PAGES) {
    throw new OcrPageLimitExceededError(ocrPageCount, MAX_OCR_PAGES);
  }

  // Second pass: build each page's lines, OCR'ing only the pages that need it.
  const lines: ExtractedLine[] = [];
  for (let i = 0; i < pages.length; i++) {
    const { page, items, needsOcr } = pages[i];
    const pageNum = i + 1;
    if (needsOcr) {
      const ocrLines = await extractLinesViaOcr(page, pageNum, totalPages, onProgress);
      lines.push(...ocrLines.map((line) => ({ line, sourcedFromOcr: true })));
    } else {
      lines.push(...groupItemsIntoLines(items).map((line) => ({ line, sourcedFromOcr: false })));
    }
  }

  return lines;
}
