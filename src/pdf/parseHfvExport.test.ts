import { describe, expect, it } from 'vitest';
import { FIELD_SEPARATOR, HFV_MARKER, parseHfvExportLines } from './parseHfvExport';

function markerLine(fields: string[]): string {
  return [HFV_MARKER, ...fields].join(FIELD_SEPARATOR);
}

describe('parseHfvExportLines', () => {
  it('decodes a well-formed marker line', () => {
    const line = markerLine(['Darrel Taylor', '526 N Budd St # B', 'Philadelphia', 'PA', '19104', 'Mailed']);
    expect(parseHfvExportLines([line])).toEqual([
      { name: 'Darrel Taylor', street: '526 N Budd St # B', city: 'Philadelphia', state: 'PA', zip: '19104', status: 'Mailed' },
    ]);
  });

  it('decodes a marker appended to the end of other (visible-table) text on the line', () => {
    const line = `Darrel Taylor 526 N Budd St # B Philadelphia PA 19104 Mailed ${markerLine([
      'Darrel Taylor',
      '526 N Budd St # B',
      'Philadelphia',
      'PA',
      '19104',
      'Mailed',
    ])}`;
    expect(parseHfvExportLines([line])).toEqual([
      { name: 'Darrel Taylor', street: '526 N Budd St # B', city: 'Philadelphia', state: 'PA', zip: '19104', status: 'Mailed' },
    ]);
  });

  it('allows an empty status field', () => {
    const line = markerLine(['Darrel Taylor', '526 N Budd St # B', 'Philadelphia', 'PA', '19104', '']);
    expect(parseHfvExportLines([line])).toEqual([
      { name: 'Darrel Taylor', street: '526 N Budd St # B', city: 'Philadelphia', state: 'PA', zip: '19104', status: '' },
    ]);
  });

  it('ignores lines without the marker', () => {
    expect(parseHfvExportLines(['Darrel Taylor 526 N Budd St # B, Philadelphia, PA 19104'])).toEqual([]);
  });

  it('ignores a line with too few fields', () => {
    const line = markerLine(['Darrel Taylor', '526 N Budd St # B', 'Philadelphia', 'PA']);
    expect(parseHfvExportLines([line])).toEqual([]);
  });

  it('ignores a line with too many fields', () => {
    const line = markerLine(['Darrel Taylor', '526 N Budd St # B', 'Philadelphia', 'PA', '19104', 'Mailed', 'extra']);
    expect(parseHfvExportLines([line])).toEqual([]);
  });

  it('ignores a line with a required field blank', () => {
    const line = markerLine(['', '526 N Budd St # B', 'Philadelphia', 'PA', '19104', 'Mailed']);
    expect(parseHfvExportLines([line])).toEqual([]);
  });

  it('decodes multiple records across multiple lines', () => {
    const lines = [
      markerLine(['Darrel Taylor', '526 N Budd St # B', 'Philadelphia', 'PA', '19104', 'Mailed']),
      'some unrelated visible-table line',
      markerLine(['Peter Brothers', '6244 N Beechwood St', 'Philadelphia', 'PA', '19138', 'TODO']),
    ];
    expect(parseHfvExportLines(lines)).toHaveLength(2);
  });
});
