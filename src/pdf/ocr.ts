import type { PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
import * as Tesseract from 'tesseract.js';
import { groupItemsIntoLines, type PdfImportProgressCallback, type PositionedTextItem } from './extractLines';

// Below this many non-whitespace characters of real extracted text, treat the
// page as having no usable text layer. Deliberately low (not e.g. 0) so a
// page with one stray real-text page number/footer, but an otherwise scanned
// body, still triggers OCR rather than silently "extracting" just "14".
export const OCR_TEXT_LAYER_THRESHOLD = 10;

export function pageNeedsOcr(items: PositionedTextItem[]): boolean {
  const totalChars = items.reduce((sum, it) => sum + it.str.replace(/\s/g, '').length, 0);
  return totalChars < OCR_TEXT_LAYER_THRESHOLD;
}

// Pages actually needing OCR (not total page count) in one import. OCR is
// slow and memory-heavy in-browser; this bounds the worst case rather than
// letting the tab hang indefinitely on a pathological scan. Generous above
// the 19-page real-world sample this feature was built against.
export const MAX_OCR_PAGES = 75;

export class OcrPageLimitExceededError extends Error {
  constructor(
    public readonly pageCount: number,
    public readonly limit: number,
  ) {
    super(`This PDF has ${pageCount} scanned pages, over the ${limit}-page limit for a single import. Try splitting it into smaller files.`);
    this.name = 'OcrPageLimitExceededError';
  }
}

// pdf.js scale 1 = 72 DPI. ~180 DPI is a reasonable middle ground for
// printed/typed address lists (not photographs) — high enough for OCR
// accuracy on body text without the memory cost of a full 300 DPI render.
// Validate against a real scanned voter list and raise toward ~3.5–4 if
// recognition is poor on small print.
export const OCR_RENDER_SCALE = 2.5;

export async function renderPageToCanvas(page: PDFPageProxy, scale = OCR_RENDER_SCALE): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const canvasContext = canvas.getContext('2d');
  if (!canvasContext) throw new Error('Could not get a 2D canvas context for OCR rendering.');
  await page.render({ canvasContext, viewport }).promise;
  return canvas;
}

interface TesseractWordLike {
  text: string;
  bbox: { x0: number; y0: number };
}

/**
 * Converts tesseract.js word boxes (pixel space, top-left origin, scaled by
 * the render scale) into the same `PositionedTextItem` shape pdf.js produces
 * (PDF-point space, bottom-left origin) — so OCR'd pages can be fed through
 * the exact same, already-tested `groupItemsIntoLines` as text-layer pages.
 */
export function tesseractWordsToPositionedItems(
  words: TesseractWordLike[],
  scale: number,
  pageHeightPoints: number,
): PositionedTextItem[] {
  return words
    .filter((w) => w.text.trim() !== '')
    .map((w) => ({ str: w.text, x: w.bbox.x0 / scale, y: pageHeightPoints - w.bbox.y0 / scale }));
}

function flattenWords(blocks: Tesseract.Block[] | null): Tesseract.Word[] {
  if (!blocks) return [];
  return blocks.flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)));
}

// --- Ruled-table detection and per-row OCR -------------------------------
//
// A page laid out as a bordered table (e.g. a canvassing worksheet with
// Name/Street/City/State/Zip columns) defeats a single whole-page OCR pass:
// Tesseract's own layout analysis gets confused by the vertical gridlines and
// narrow columns, and produces garbled text for exactly the State/Zip/etc.
// cells the address parser needs most. Detecting the table's horizontal
// ruling lines and OCR'ing each row in isolation (so Tesseract never sees
// more than one row's content at a time) fixes this reliably — confirmed
// against a real scanned canvassing sheet during development.

interface GrayscaleImage {
  width: number;
  height: number;
  data: Uint8ClampedArray; // RGBA, as from CanvasRenderingContext2D#getImageData
}

const GRIDLINE_DARK_LUMINANCE = 128;
// Real ruling lines on the sample scanned document measure anywhere from
// ~0.3 to ~0.56 dark-pixel ratio (scan quality/antialiasing varies line to
// line); dense all-caps text rows cap out around ~0.2. 0.25 sits cleanly
// between the two — confirmed against real scanned pages to catch every
// ruling line with no false positives from text.
const GRIDLINE_ROW_DARK_RATIO = 0.25;
// Header rule + at least 2 data-row rules + bottom rule. A page with only a
// couple of incidental full-width dark rows (a horizontal divider, an
// underline) shouldn't be mistaken for a ruled table.
const MIN_TABLE_GRIDLINES = 4;
const MIN_TABLE_ROW_HEIGHT_PX = 20;

/**
 * Finds horizontal ruling lines by looking for image rows that are mostly
 * dark across their full width — a printed/scanned table's ruling lines, not
 * sparse text. Pure pixel analysis, no OCR involved, so it's cheap to run
 * speculatively on every OCR'd page.
 */
export function detectHorizontalGridlines(image: GrayscaleImage): number[] {
  const { width, height, data } = image;
  const isDarkRow: boolean[] = new Array(height);
  for (let y = 0; y < height; y++) {
    let darkCount = 0;
    const rowStart = y * width * 4;
    for (let x = 0; x < width; x++) {
      const i = rowStart + x * 4;
      const luminance = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (luminance < GRIDLINE_DARK_LUMINANCE) darkCount++;
    }
    isDarkRow[y] = darkCount / width > GRIDLINE_ROW_DARK_RATIO;
  }

  const gridlines: number[] = [];
  let runStart = -1;
  for (let y = 0; y <= height; y++) {
    const dark = y < height && isDarkRow[y];
    if (dark && runStart === -1) runStart = y;
    if (!dark && runStart !== -1) {
      gridlines.push(Math.round((runStart + y - 1) / 2));
      runStart = -1;
    }
  }
  return gridlines;
}

// A handful of incidental full-width dark rows (e.g. JPEG compression
// artifacts near text, on a page with no real table at all) can clear the
// darkness-ratio threshold above without being a real table — but they land
// at irregular, non-repeating distances from each other. A genuine ruled
// table's rows repeat at one near-uniform spacing. Requiring that the most
// common gap between consecutive candidate gridlines itself repeats several
// times is what actually distinguishes "a real row grid" from incidental
// noise (confirmed: this is exactly what rejected a 2-line non-tabular
// synthetic test fixture that otherwise cleared the raw gridline-count bar).
const MIN_CONSISTENT_ROW_GAPS = 3;
const ROW_GAP_BUCKET_PX = 10;

export function hasConsistentRowSpacing(gridlines: number[]): boolean {
  const gaps = gridlines.slice(1).map((y, i) => y - gridlines[i]);
  const gapBucketCounts = new Map<number, number>();
  for (const gap of gaps) {
    const bucket = Math.round(gap / ROW_GAP_BUCKET_PX);
    gapBucketCounts.set(bucket, (gapBucketCounts.get(bucket) ?? 0) + 1);
  }
  return Math.max(0, ...gapBucketCounts.values()) >= MIN_CONSISTENT_ROW_GAPS;
}

interface TesseractWordBox {
  text: string;
  bbox: { x0: number; x1: number };
}

// Gap (in PDF points, i.e. already divided by render scale) between adjacent
// words' bounding boxes, above which they're treated as belonging to
// different table cells/columns rather than being ordinary inter-word
// spacing within the same cell. On the real ruled-table sample this feature
// was built against, intra-cell gaps are a few points; column gaps are 60+
// points — comfortably separated.
export const OCR_COLUMN_GAP_POINTS = 20;

/**
 * Joins one table row's recognized words, left to right, inserting a comma
 * at column-sized gaps (so e.g. a City cell followed by a State cell reads
 * as "..., City, ST ..." — the comma-delimited tail `parseVoterLine` expects)
 * and a plain space for ordinary gaps within the same cell.
 */
// A row crop still includes the pixels of the table's vertical column rules
// (the crop is full-canvas-width, only trimmed top/bottom), and Tesseract
// frequently reads a rule's stroke as a standalone "|"/"¦"-like glyph "word"
// sitting right at a column boundary — e.g. "VA | 22932" instead of
// "VA 22932". Real cell content is never *only* a vertical-bar character, so
// these are filtered out as column-rule noise rather than real words.
const VERTICAL_RULE_GLYPH = /^[|¦‖!]+$/;

export function joinOcrRowWords(words: TesseractWordBox[], scale: number, columnGapPoints = OCR_COLUMN_GAP_POINTS): string {
  const nonEmpty = words.filter((w) => {
    const text = w.text.trim();
    return text !== '' && !VERTICAL_RULE_GLYPH.test(text);
  });
  const sorted = [...nonEmpty].sort((a, b) => a.bbox.x0 - b.bbox.x0);
  if (sorted.length === 0) return '';

  let result = sorted[0].text;
  for (let i = 1; i < sorted.length; i++) {
    const gapPoints = (sorted[i].bbox.x0 - sorted[i - 1].bbox.x1) / scale;
    result += (gapPoints > columnGapPoints ? ', ' : ' ') + sorted[i].text;
  }
  return result;
}

// All four tesseract.js runtime assets live flat in one directory so the
// worker script and the WASM core it loads can resolve each other regardless
// of which one's own URL `self.location` ends up pointing at.
const VENDOR_BASE = `${import.meta.env.BASE_URL}vendor/tesseract/`;
const OCR_WORKER_PATH = `${VENDOR_BASE}worker.min.js`;
const OCR_CORE_PATH = `${VENDOR_BASE}tesseract-core-lstm.js`; // .js extension -> skips SIMD-detection branch, deterministic
const OCR_LANG_CDN_TIMEOUT_MS = 6000;

let currentProgressSink: PdfImportProgressCallback | undefined;
// `rowIndex`/`rowCount` let a page processed as a ruled table (many small
// `recognize()` calls, one per row) report smooth page-level progress
// instead of each row's own 0→1 sawtoothing back to 0.
let currentProgressContext = { page: 0, totalPages: 0, rowIndex: 0, rowCount: 1 };

function handleTesseractLog(message: Tesseract.LoggerMessage): void {
  if (message.status === 'recognizing text') {
    const { page, totalPages, rowIndex, rowCount } = currentProgressContext;
    const ocrProgress = (rowIndex + message.progress) / rowCount;
    currentProgressSink?.({ page, totalPages, phase: 'ocr', ocrProgress });
  }
}

function createOcrWorker(langPath?: string): Promise<Tesseract.Worker> {
  return Tesseract.createWorker('eng', Tesseract.OEM.LSTM_ONLY, {
    workerPath: OCR_WORKER_PATH,
    corePath: OCR_CORE_PATH,
    workerBlobURL: false, // keeps the worker's own self.location a real, resolvable URL (needed for the WASM lookup above)
    logger: handleTesseractLog,
    ...(langPath ? { langPath } : {}),
  });
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  promise.catch(() => {}); // avoid an unhandled rejection if this promise loses the race below
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

let sharedWorkerPromise: Promise<Tesseract.Worker> | null = null;

/**
 * Lazily creates one shared OCR worker for the whole app session, reused
 * across pages and imports. Per the user's preference, tries the larger,
 * more accurate English model from tesseract.js's own default CDN
 * (jsDelivr) first, and falls back to a smaller model bundled locally (so
 * OCR still works offline, or if the CDN is slow/unreachable).
 */
function getOcrWorker(): Promise<Tesseract.Worker> {
  if (!sharedWorkerPromise) {
    sharedWorkerPromise = (async () => {
      try {
        // No langPath override: tesseract.js's own default (CDN, "best_int" model) is used.
        return await withTimeout(createOcrWorker(), OCR_LANG_CDN_TIMEOUT_MS);
      } catch {
        return createOcrWorker(VENDOR_BASE); // bundled "fast" model, guaranteed to work offline
      }
    })();
  }
  return sharedWorkerPromise;
}

/** Crops one row band out of a full-page canvas into its own canvas, for isolated per-row OCR. */
function cropCanvasRow(source: HTMLCanvasElement, y0: number, y1: number): HTMLCanvasElement {
  const rowCanvas = document.createElement('canvas');
  rowCanvas.width = source.width;
  rowCanvas.height = y1 - y0;
  const ctx = rowCanvas.getContext('2d');
  if (!ctx) throw new Error('Could not get a 2D canvas context for OCR row cropping.');
  ctx.drawImage(source, 0, y0, source.width, y1 - y0, 0, 0, source.width, y1 - y0);
  return rowCanvas;
}

/**
 * Binarizes a row crop in place (grayscale, then thresholds every pixel to
 * pure black or white via Otsu's method) before handing it to Tesseract.
 * Antialiased scan noise around glyph edges is exactly the kind of thing
 * Tesseract's own accuracy guidance calls out as worth removing before
 * recognition. Dimensions are left unchanged so downstream bbox math (which
 * assumes `OCR_RENDER_SCALE` pixels-per-point) stays valid.
 */
export function preprocessRowCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get a 2D canvas context for OCR row preprocessing.');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  binarizeImageData(imageData);
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/** Converts RGBA pixel data to grayscale, then thresholds via Otsu's method to pure black/white, in place. */
export function binarizeImageData(image: { width: number; height: number; data: Uint8ClampedArray }): void {
  const { data } = image;
  const pixelCount = data.length / 4;
  const gray = new Uint8ClampedArray(pixelCount);
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < pixelCount; i++) {
    const o = i * 4;
    const luminance = Math.round((data[o] + data[o + 1] + data[o + 2]) / 3);
    gray[i] = luminance;
    histogram[luminance]++;
  }

  const threshold = otsuThreshold(histogram, pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    const value = gray[i] > threshold ? 255 : 0;
    const o = i * 4;
    data[o] = data[o + 1] = data[o + 2] = value;
  }
}

/** Otsu's method: picks the luminance threshold that best separates a bimodal histogram into two classes. */
function otsuThreshold(histogram: number[], pixelCount: number): number {
  let sumAll = 0;
  for (let t = 0; t < 256; t++) sumAll += t * histogram[t];

  let sumBackground = 0;
  let weightBackground = 0;
  let bestVariance = -1;
  let bestThreshold = 128;

  for (let t = 0; t < 256; t++) {
    weightBackground += histogram[t];
    if (weightBackground === 0) continue;
    const weightForeground = pixelCount - weightBackground;
    if (weightForeground === 0) break;

    sumBackground += t * histogram[t];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sumAll - sumBackground) / weightForeground;
    const betweenClassVariance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;

    if (betweenClassVariance > bestVariance) {
      bestVariance = betweenClassVariance;
      bestThreshold = t;
    }
  }
  return bestThreshold;
}

/**
 * OCRs a page detected as a ruled table one row at a time (see the comment
 * above `detectHorizontalGridlines`), rather than as a whole page. Each
 * `recognize()` call sees only one row's pixels, so Tesseract's own layout
 * analysis can't confuse content across rows or get tripped up by the
 * table's vertical gridlines — which a single whole-page pass reliably does
 * for exactly the narrow/short cells (state, ZIP) the address parser needs most.
 */
async function extractLinesFromRuledTable(
  canvas: HTMLCanvasElement,
  gridlines: number[],
  pageNum: number,
  totalPages: number,
): Promise<string[]> {
  const worker = await getOcrWorker();
  // Each row crop is already known to be exactly one line of text — the
  // default "fully automatic" layout analysis wastes effort re-detecting
  // that, and can misorder/garble short cells. SINGLE_LINE tells Tesseract
  // not to bother.
  await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE });
  const rowBands = gridlines.slice(0, -1).map((y0, i) => [y0, gridlines[i + 1]] as const).filter(([y0, y1]) => y1 - y0 >= MIN_TABLE_ROW_HEIGHT_PX);

  const lines: string[] = [];
  for (let i = 0; i < rowBands.length; i++) {
    const [y0, y1] = rowBands[i];
    currentProgressContext = { page: pageNum, totalPages, rowIndex: i, rowCount: rowBands.length };
    const rowCanvas = preprocessRowCanvas(cropCanvasRow(canvas, y0, y1));
    const { data } = await worker.recognize(rowCanvas, {}, { blocks: true });
    const line = joinOcrRowWords(flattenWords(data.blocks), OCR_RENDER_SCALE);
    if (line) lines.push(line);
  }
  return lines;
}

export async function extractLinesViaOcr(
  page: PDFPageProxy,
  pageNum: number,
  totalPages: number,
  onProgress?: PdfImportProgressCallback,
): Promise<string[]> {
  if (!sharedWorkerPromise) onProgress?.({ page: pageNum, totalPages, phase: 'ocr-setup' });

  currentProgressContext = { page: pageNum, totalPages, rowIndex: 0, rowCount: 1 };
  currentProgressSink = onProgress;

  const canvas = await renderPageToCanvas(page);
  const canvasCtx = canvas.getContext('2d');
  if (!canvasCtx) throw new Error('Could not get a 2D canvas context for OCR gridline detection.');
  const gridlines = detectHorizontalGridlines(canvasCtx.getImageData(0, 0, canvas.width, canvas.height));

  if (gridlines.length >= MIN_TABLE_GRIDLINES && hasConsistentRowSpacing(gridlines)) {
    const lines = await extractLinesFromRuledTable(canvas, gridlines, pageNum, totalPages);
    page.cleanup();
    return lines;
  }

  const worker = await getOcrWorker();
  // A non-tabular page is still a uniform block of body text (no multi-column
  // layout to detect), so SINGLE_BLOCK fits better than the default
  // fully-automatic analysis (which also attempts orientation/script
  // detection we don't need).
  await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK });
  const { data } = await worker.recognize(canvas, {}, { blocks: true });
  const pageHeightPoints = page.getViewport({ scale: 1 }).height;
  page.cleanup();

  const words = flattenWords(data.blocks);
  const items = tesseractWordsToPositionedItems(words, OCR_RENDER_SCALE, pageHeightPoints);
  // Looser than the default (2pt) baseline tolerance: OCR word-tops jitter
  // more than pdf.js's exact glyph transforms.
  return groupItemsIntoLines(items, 3);
}
