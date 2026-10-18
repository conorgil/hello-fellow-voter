import { describe, expect, it } from 'vitest';
import type { PositionedTextItem } from './extractLines';
import {
  buildColumnLineStreams,
  findColumnSplitX,
  groupLinesIntoBlocks,
  type PositionedLine,
} from './extractRecordBlocks';

function item(str: string, x: number, y: number, width: number): PositionedTextItem {
  return { str, x, y, width };
}

function line(text: string, y: number): PositionedLine {
  return { text, y };
}

describe('findColumnSplitX', () => {
  it('detects a recurring 2-column gutter', () => {
    const rows: PositionedTextItem[][] = [
      [item('Darrel Taylor', 72, 700, 62), item('Peter Brothers', 324, 700, 70)],
      [item('526 N Budd St', 72, 686, 80), item('6244 N Beechwood St', 324, 686, 100)],
      [item('Mana Hollis', 72, 672, 55), item('Johanna Figueroa', 324, 672, 90)],
      [item('908 E Stafford St', 72, 658, 90), item('7725 Gilbert St', 324, 658, 75)],
    ];
    expect(findColumnSplitX(rows, 612)).toBe(324);
  });

  it('does not misdetect a single-column document with one stray wide gap', () => {
    const rows: PositionedTextItem[][] = [
      [item('Darrel Taylor', 72, 700, 62)],
      [item('526 N Budd St, Philadelphia, PA 19104', 72, 686, 200)],
      // One row happens to have two items with a big gap (e.g. a one-off
      // table-ish line) — shouldn't by itself read as a real 2-column layout.
      [item('Name', 72, 672, 30), item('Status', 500, 672, 40)],
      [item('Mana Hollis', 72, 658, 55)],
      [item('908 E Stafford St, Philadelphia, PA 19138', 72, 644, 200)],
    ];
    expect(findColumnSplitX(rows, 612)).toBeNull();
  });

  it('returns null when there are no multi-item rows at all', () => {
    const rows: PositionedTextItem[][] = [
      [item('Darrel Taylor', 72, 700, 62)],
      [item('526 N Budd St, Philadelphia, PA 19104', 72, 686, 200)],
    ];
    expect(findColumnSplitX(rows, 612)).toBeNull();
  });
});

describe('buildColumnLineStreams', () => {
  it('splits each row at the column boundary into independent left/right streams', () => {
    const rows: PositionedTextItem[][] = [
      [item('Darrel Taylor', 72, 700, 62), item('Peter Brothers', 324, 700, 70)],
      [item('526 N Budd St', 72, 686, 80), item('6244 N Beechwood St', 324, 686, 100)],
    ];
    const [left, right] = buildColumnLineStreams(rows, 324);
    expect(left.map((l) => l.text)).toEqual(['Darrel Taylor', '526 N Budd St']);
    expect(right.map((l) => l.text)).toEqual(['Peter Brothers', '6244 N Beechwood St']);
  });

  it('returns a single stream when splitX is null', () => {
    const rows: PositionedTextItem[][] = [
      [item('Darrel Taylor', 72, 700, 62)],
      [item('526 N Budd St, Philadelphia, PA 19104', 72, 686, 200)],
    ];
    const streams = buildColumnLineStreams(rows, null);
    expect(streams).toHaveLength(1);
    expect(streams[0].map((l) => l.text)).toEqual(['Darrel Taylor', '526 N Budd St, Philadelphia, PA 19104']);
  });

  it('drops a side with no items on a given row instead of emitting a blank line', () => {
    const rows: PositionedTextItem[][] = [
      [item('Darrel Taylor', 72, 700, 62), item('Peter Brothers', 324, 700, 70)],
      // Left column ran out of rows on this page before the right column did.
      [item('Johanna Figueroa', 324, 686, 90)],
    ];
    const [left, right] = buildColumnLineStreams(rows, 324);
    expect(left.map((l) => l.text)).toEqual(['Darrel Taylor']);
    expect(right.map((l) => l.text)).toEqual(['Peter Brothers', 'Johanna Figueroa']);
  });
});

describe('groupLinesIntoBlocks', () => {
  it('closes a single-line record immediately', () => {
    const lines = [
      line('KEZIAH MONTGOMERY, 3389 HAWTHORNE ST, BRIDGEMONT, PA 19188', 700),
      line('DELANEY ASHFORD, 512 CEDARVIEW AVE, STONEBRIDGE HOLLOW, PA 15188', 686),
    ];
    const { blocks, discardedLines } = groupLinesIntoBlocks(lines);
    expect(blocks).toEqual([
      ['KEZIAH MONTGOMERY, 3389 HAWTHORNE ST, BRIDGEMONT, PA 19188'],
      ['DELANEY ASHFORD, 512 CEDARVIEW AVE, STONEBRIDGE HOLLOW, PA 15188'],
    ]);
    expect(discardedLines).toEqual([]);
  });

  it('groups a 3-line name/street/city-state-zip record with no commas', () => {
    const lines = [
      line('Darrel Taylor', 706.5),
      line('526 N Budd St # B', 692.0),
      line('Philadelphia PA 19104', 677.4),
      line('Mana Hollis', 652.9),
      line('908 E Stafford St', 638.3),
      line('Philadelphia PA 19138', 623.8),
    ];
    const { blocks, discardedLines } = groupLinesIntoBlocks(lines);
    expect(blocks).toEqual([
      ['Darrel Taylor', '526 N Budd St # B', 'Philadelphia PA 19104'],
      ['Mana Hollis', '908 E Stafford St', 'Philadelphia PA 19138'],
    ]);
    expect(discardedLines).toEqual([]);
  });

  it('abandons a stale pending buffer when a self-closing line arrives mid-accumulation', () => {
    const lines = [
      line('Some Stray Boilerplate', 706.5),
      line('KEZIAH MONTGOMERY, 3389 HAWTHORNE ST, BRIDGEMONT, PA 19188', 692.0),
    ];
    const { blocks, discardedLines } = groupLinesIntoBlocks(lines);
    expect(blocks).toEqual([['KEZIAH MONTGOMERY, 3389 HAWTHORNE ST, BRIDGEMONT, PA 19188']]);
    expect(discardedLines).toEqual(['Some Stray Boilerplate']);
  });

  it('gives up on a buffer that never closes within MAX_PENDING_LINES', () => {
    const lines = [
      line('Stray One', 700),
      line('Stray Two', 686),
      line('Stray Three', 672),
      line('Stray Four', 658),
      line('Stray Five', 644),
      line('Stray Six', 630),
    ];
    const { blocks, discardedLines } = groupLinesIntoBlocks(lines);
    expect(blocks).toEqual([]);
    expect(discardedLines).toEqual(['Stray One', 'Stray Two', 'Stray Three', 'Stray Four', 'Stray Five', 'Stray Six']);
  });

  it('forces a block break on an anomalously large gap even without a self-closing line', () => {
    // A one-off page title sitting well above the first real record, whose
    // gap is much larger than the record's own internal line pitch.
    const lines = [
      line('Some Document Title', 741),
      line('Darrel Taylor', 706.5),
      line('526 N Budd St # B', 692.0),
      line('Philadelphia PA 19104', 677.4),
    ];
    const { blocks, discardedLines } = groupLinesIntoBlocks(lines);
    expect(blocks).toEqual([['Darrel Taylor', '526 N Budd St # B', 'Philadelphia PA 19104']]);
    expect(discardedLines).toEqual(['Some Document Title']);
  });
});
