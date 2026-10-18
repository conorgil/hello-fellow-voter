import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
// The `?url` suffix tells Vite to emit the worker as its own hashed asset and
// give back its final (same-origin, relative) URL, so it's bundled locally
// into dist/ instead of being fetched from a CDN at runtime.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface PositionedTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
}

/**
 * Groups positioned text items into rows by baseline Y (within a small
 * tolerance, since fonts/rounding can jitter a shared baseline by ~1pt),
 * sorting each row's items left-to-right by X. Pure and DOM/pdf.js-free so
 * it can be unit tested with synthetic items. Shared by `groupItemsIntoLines`
 * (single-column joining) and `extractRecordBlocks.ts` (column-aware joining).
 */
export function groupItemsIntoRows(items: PositionedTextItem[], yTolerance = 2): PositionedTextItem[][] {
  const nonEmpty = items.filter((it) => it.str.trim() !== '');
  const sorted = [...nonEmpty].sort((a, b) => b.y - a.y); // top of page first

  const rows: PositionedTextItem[][] = [];
  for (const item of sorted) {
    const row = rows.find((r) => Math.abs(r[0].y - item.y) <= yTolerance);
    if (row) row.push(item);
    else rows.push([item]);
  }

  return rows.map((row) => [...row].sort((a, b) => a.x - b.x));
}

export function joinRow(row: PositionedTextItem[]): string {
  return row
    .map((it) => it.str)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Groups positioned text items into lines by baseline Y, then joins each row
 * left-to-right into a single string — assumes one column of content. */
export function groupItemsIntoLines(items: PositionedTextItem[], yTolerance = 2): string[] {
  return groupItemsIntoRows(items, yTolerance).map(joinRow);
}

export interface ExtractedPage {
  items: PositionedTextItem[];
  pageWidth: number;
}

/** One pdf.js parse pass, shared by `extractAllLines` (flat lines, assumes one
 * column) and `extractRecordBlocks.ts` (column- and multi-line-aware). */
export async function extractPages(data: ArrayBuffer): Promise<ExtractedPage[]> {
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const pages: ExtractedPage[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items: PositionedTextItem[] = content.items
      .filter((it): it is TextItem => 'str' in it)
      .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width }));
    pages.push({ items, pageWidth: viewport.width });
  }
  return pages;
}

export async function extractAllLines(data: ArrayBuffer): Promise<string[]> {
  const pages = await extractPages(data);
  return pages.flatMap((page) => groupItemsIntoLines(page.items));
}
