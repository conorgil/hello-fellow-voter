import { jsPDF } from 'jspdf';
import type { FakeVoter } from './fakeVoters';

const MARGIN = 40;
const FONT_SIZE = 10;
const LINE_HEIGHT = 14;
const MIN_PAGE_HEIGHT = 792;
// Column gutter must exceed `max(60, pageWidth * 0.12)` (see
// extractRecordBlocks.ts). This stays comfortably above that threshold for
// any page width a realistic generated record's text width could produce.
const COLUMN_GAP = 400;

function formatRecordLines(voter: FakeVoter, linesPerRecord: 1 | 2): string[] {
  if (linesPerRecord === 1) {
    return [`${voter.name}, ${voter.street}, ${voter.city}, ${voter.state} ${voter.zip}`];
  }
  return [`${voter.name}, ${voter.street}`, `${voter.city}, ${voter.state} ${voter.zip}`];
}

/**
 * Renders one or more side-by-side columns of voters as a synthetic test
 * PDF, using raw positioned `text()` calls (not autoTable) so column x
 * positions and line spacing are exactly controlled. A record's lines are
 * never split across a page break — each page holds only whole records —
 * since extractRecordBlocks.ts groups lines per page and a record split
 * across pages would otherwise be silently lost rather than imported.
 */
export function buildVoterPdf(columnsOfVoters: FakeVoter[][], linesPerRecord: 1 | 2): ArrayBuffer {
  const columnRecordLines = columnsOfVoters.map((voters) => voters.map((v) => formatRecordLines(v, linesPerRecord)));

  const measureDoc = new jsPDF({ unit: 'pt' });
  measureDoc.setFontSize(FONT_SIZE);
  const columnWidths = columnRecordLines.map((records) =>
    records.flat().reduce((max, line) => Math.max(max, measureDoc.getTextWidth(line)), 0),
  );

  let cursorX = MARGIN;
  const columnX: number[] = [];
  for (const width of columnWidths) {
    columnX.push(cursorX);
    cursorX += width + COLUMN_GAP;
  }
  const pageWidth = cursorX - COLUMN_GAP + MARGIN;
  // All test PDFs should be portrait, like a real voter list export — a wide
  // 2-column page grows taller instead of flipping to landscape. (jsPDF also
  // silently swaps a custom [width, height] format to keep width <= height
  // unless orientation is given explicitly, so this keeps that swap a no-op.)
  const pageHeight = Math.max(MIN_PAGE_HEIGHT, pageWidth + MARGIN);

  const rowsPerPage = Math.floor((pageHeight - 2 * MARGIN) / LINE_HEIGHT);
  const recordsPerPage = Math.max(1, Math.floor(rowsPerPage / linesPerRecord));
  const pageCount = Math.max(1, ...columnRecordLines.map((records) => Math.ceil(records.length / recordsPerPage)));

  const doc = new jsPDF({ unit: 'pt', format: [pageWidth, pageHeight], orientation: 'p' });
  doc.setFontSize(FONT_SIZE);

  for (let page = 0; page < pageCount; page++) {
    if (page > 0) doc.addPage([pageWidth, pageHeight], 'p');
    for (let col = 0; col < columnRecordLines.length; col++) {
      const pageLines = columnRecordLines[col].slice(page * recordsPerPage, (page + 1) * recordsPerPage).flat();
      pageLines.forEach((line, row) => {
        const y = MARGIN + FONT_SIZE + row * LINE_HEIGHT;
        doc.text(line, columnX[col], y);
      });
    }
  }

  return doc.output('arraybuffer');
}

export function buildSingleColumnSingleLinePdf(voters: FakeVoter[]): ArrayBuffer {
  return buildVoterPdf([voters], 1);
}

export function buildSingleColumnMultiLinePdf(voters: FakeVoter[]): ArrayBuffer {
  return buildVoterPdf([voters], 2);
}

export function buildTwoColumnSingleLinePdf(voters: FakeVoter[]): ArrayBuffer {
  const mid = Math.ceil(voters.length / 2);
  return buildVoterPdf([voters.slice(0, mid), voters.slice(mid)], 1);
}

export function buildTwoColumnMultiLinePdf(voters: FakeVoter[]): ArrayBuffer {
  const mid = Math.ceil(voters.length / 2);
  return buildVoterPdf([voters.slice(0, mid), voters.slice(mid)], 2);
}
