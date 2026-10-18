import { type ExtractedPage, type PositionedTextItem, extractPages, groupItemsIntoRows, joinRow } from './extractLines';
import { isStandaloneAddressTail, looksLikeDataRow } from './parseVoterLine';

// A gap between two items on the same baseline counts as a column gutter (not
// ordinary word/field spacing) once it's at least this wide, relative to the
// page — whichever is larger. Tuned against a real 2-column sample whose
// gutter is ~190pt on a 612pt-wide page; comfortably clears both floors.
const MIN_COLUMN_GAP_FRACTION = 0.12;
const MIN_COLUMN_GAP_ABSOLUTE = 60;
// Candidate split-x values are bucketed to this granularity before tallying,
// since the "same" column boundary can jitter by a point or two across rows.
const BUCKET_SIZE = 10;
// A candidate split only counts as a real column boundary if it recurs often
// enough — guards against a single row with an unusually wide gap (e.g. a
// table cell) being mistaken for a 2-column layout.
const MIN_RECURRENCE_ROWS = 3;
const MIN_RECURRENCE_FRACTION = 0.3;
// How many non-closing lines a pending multi-line record can accumulate
// before it's given up on (e.g. stray boilerplate that never resolves into a
// real address). Comfortably covers a 3-line name/street/city-state-zip
// record with a line of slack.
const MAX_PENDING_LINES = 4;
// A gap between consecutive lines bigger than this multiple of the stream's
// typical (median) line-to-line gap forces a block break even when content
// alone hasn't closed the pending buffer — catches e.g. a one-off page title
// sitting just above the first real record, which no content heuristic can
// tell apart from a legitimate name line on its own.
const GAP_BREAK_FACTOR = 1.6;

/**
 * Finds the x position of a recurring column gutter on a page, or null if the
 * page looks like a single column. Only rows with 2+ items on the same
 * baseline are examined, since a single-item row can't itself reveal a gutter.
 */
export function findColumnSplitX(rows: PositionedTextItem[][], pageWidth: number): number | null {
  const threshold = Math.max(MIN_COLUMN_GAP_ABSOLUTE, pageWidth * MIN_COLUMN_GAP_FRACTION);
  const multiItemRows = rows.filter((row) => row.length >= 2);
  if (multiItemRows.length === 0) return null;

  const buckets = new Map<number, number[]>();
  for (const row of multiItemRows) {
    let largestGap = -Infinity;
    let splitX: number | null = null;
    for (let i = 1; i < row.length; i++) {
      const gap = row[i].x - (row[i - 1].x + row[i - 1].width);
      if (gap > largestGap) {
        largestGap = gap;
        splitX = row[i].x;
      }
    }
    if (splitX === null || largestGap <= threshold) continue;
    const bucket = Math.round(splitX / BUCKET_SIZE) * BUCKET_SIZE;
    const xs = buckets.get(bucket) ?? [];
    xs.push(splitX);
    buckets.set(bucket, xs);
  }

  let best: number[] | null = null;
  for (const xs of buckets.values()) {
    if (!best || xs.length > best.length) best = xs;
  }
  if (!best) return null;

  // The fraction check only means anything against a decently sized sample —
  // with few multi-item rows overall, a single stray one trivially clears
  // 30% and would otherwise look like a real, recurring column boundary.
  const recurs =
    best.length >= MIN_RECURRENCE_ROWS ||
    (multiItemRows.length >= 5 && best.length / multiItemRows.length >= MIN_RECURRENCE_FRACTION);
  if (!recurs) return null;

  return Math.min(...best);
}

export interface PositionedLine {
  text: string;
  y: number;
}

/**
 * Splits each row at `splitX` into a left/right line stream, each in
 * top-to-bottom page order (rows already come sorted that way), carrying
 * each line's baseline Y along for gap-based block-break detection. With
 * `splitX === null`, returns a single stream — the existing single-column
 * behavior.
 */
export function buildColumnLineStreams(rows: PositionedTextItem[][], splitX: number | null): PositionedLine[][] {
  if (splitX === null) return [rows.map((row) => ({ text: joinRow(row), y: row[0].y }))];

  const left: PositionedLine[] = [];
  const right: PositionedLine[] = [];
  for (const row of rows) {
    const leftItems = row.filter((it) => it.x < splitX);
    const rightItems = row.filter((it) => it.x >= splitX);
    if (leftItems.length > 0) left.push({ text: joinRow(leftItems), y: row[0].y });
    if (rightItems.length > 0) right.push({ text: joinRow(rightItems), y: row[0].y });
  }
  return [left, right];
}

export interface GroupedLines {
  blocks: string[][];
  discardedLines: string[];
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Walks one column's line stream and groups consecutive lines into
 * record-sized blocks: a line that's a complete record on its own closes
 * immediately (unchanged single-line behavior); otherwise lines accumulate
 * until one stands alone as a City[,] ST ZIP tail, closing the whole
 * accumulated block as one multi-line record. A self-closing line arriving
 * mid-accumulation abandons the stale buffer rather than merging into it, as
 * does an anomalously large vertical gap (e.g. a page title sitting just
 * above the first record, which no content heuristic alone can distinguish
 * from a legitimate name line) — detected relative to the stream's own
 * typical (median) line-to-line gap. A buffer that never closes within
 * `MAX_PENDING_LINES` is given up on regardless.
 */
export function groupLinesIntoBlocks(lines: PositionedLine[]): GroupedLines {
  const blocks: string[][] = [];
  const discardedLines: string[] = [];
  let pending: PositionedLine[] = [];

  const typicalGap = median(lines.slice(1).map((line, i) => lines[i].y - line.y));
  const gapBreakThreshold = typicalGap > 0 ? typicalGap * GAP_BREAK_FACTOR : Infinity;

  for (const line of lines) {
    if (looksLikeDataRow(line.text)) {
      if (pending.length > 0) {
        discardedLines.push(...pending.map((l) => l.text));
        pending = [];
      }
      blocks.push([line.text]);
      continue;
    }

    if (pending.length > 0 && pending[pending.length - 1].y - line.y > gapBreakThreshold) {
      discardedLines.push(...pending.map((l) => l.text));
      pending = [];
    }

    pending.push(line);
    if (isStandaloneAddressTail(line.text)) {
      blocks.push(pending.map((l) => l.text));
      pending = [];
    } else if (pending.length > MAX_PENDING_LINES) {
      discardedLines.push(...pending.map((l) => l.text));
      pending = [];
    }
  }
  if (pending.length > 0) discardedLines.push(...pending.map((l) => l.text));

  return { blocks, discardedLines };
}

function extractPageRecordBlocks(page: ExtractedPage): { lines: string[] } & GroupedLines {
  const rows = groupItemsIntoRows(page.items);
  const splitX = findColumnSplitX(rows, page.pageWidth);
  const columnLineStreams = buildColumnLineStreams(rows, splitX);

  const lines: string[] = [];
  const blocks: string[][] = [];
  const discardedLines: string[] = [];
  for (const stream of columnLineStreams) {
    lines.push(...stream.map((l) => l.text));
    const grouped = groupLinesIntoBlocks(stream);
    blocks.push(...grouped.blocks);
    discardedLines.push(...grouped.discardedLines);
  }
  return { lines, blocks, discardedLines };
}

export interface ExtractedVoterText {
  /** Every line on every page, regardless of column — used for the HFV
   * marker scan, which doesn't care about order or column grouping. */
  allLines: string[];
  /** Each record's line(s), grouped per column and in reading order. */
  blocks: string[][];
  /** Lines that never resolved into a block (boilerplate, truncated
   * fragments) — still worth flagging for manual review. */
  discardedLines: string[];
}

/** One pdf.js parse pass that detects each page's column layout and groups
 * its lines into record-sized blocks, replacing a flat `extractAllLines` call
 * for the heuristic (non-HFV) import path. */
export async function extractVoterText(data: ArrayBuffer): Promise<ExtractedVoterText> {
  const pages = await extractPages(data);

  const allLines: string[] = [];
  const blocks: string[][] = [];
  const discardedLines: string[] = [];
  for (const page of pages) {
    const result = extractPageRecordBlocks(page);
    allLines.push(...result.lines);
    blocks.push(...result.blocks);
    discardedLines.push(...result.discardedLines);
  }
  return { allLines, blocks, discardedLines };
}
