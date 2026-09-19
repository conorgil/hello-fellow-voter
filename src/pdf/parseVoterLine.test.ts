import { describe, expect, it } from 'vitest';
import { looksLikeDataRow, parseVoterLine } from './parseVoterLine';

const cases: Array<[string, ReturnType<typeof parseVoterLine>]> = [
  [
    '1 Marigold Ashworth 22140 Willowmere Dr, Elderglen, NC 27599',
    { name: 'Marigold Ashworth', street: '22140 Willowmere Dr', city: 'Elderglen', state: 'NC', zip: '27599' },
  ],
  [
    '9 Walter Pemberton Room 218, Founders Hall, Millbrook, VA 23299',
    { name: 'Walter Pemberton', street: 'Room 218, Founders Hall', city: 'Millbrook', state: 'VA', zip: '23299' },
  ],
  [
    '10 Gene Whitfield SR 4407 Brookline Ave, Dellwood, NC 27911',
    { name: 'Gene Whitfield SR', street: '4407 Brookline Ave', city: 'Dellwood', state: 'NC', zip: '27911' },
  ],
  [
    '41 Milo Thackeray PO Box 884, Ashcombe, NC 27861-0884',
    { name: 'Milo Thackeray', street: 'PO Box 884', city: 'Ashcombe', state: 'NC', zip: '27861-0884' },
  ],
  [
    '58 Dennis Aldercott JR 3312 Hollow Creek Dr, Brookhaven, NC 28277',
    { name: 'Dennis Aldercott JR', street: '3312 Hollow Creek Dr', city: 'Brookhaven', state: 'NC', zip: '28277' },
  ],
  [
    '243 Rosalind Fenwick 2247 Birchbark St NE APT 118, Elmsford Falls, MI 49577',
    {
      name: 'Rosalind Fenwick',
      street: '2247 Birchbark St NE APT 118',
      city: 'Elmsford Falls',
      state: 'MI',
      zip: '49577',
    },
  ],
  [
    '466 Marcus Windham Jr. 719 Sycamore Ave, Hollowbrook, NJ 07644',
    { name: 'Marcus Windham Jr.', street: '719 Sycamore Ave', city: 'Hollowbrook', state: 'NJ', zip: '07644' },
  ],
  [
    '499 Nathaniel Boswell III 850 W Cold Springs Rd Unit 340, Fairhollow, NV 89044',
    {
      name: 'Nathaniel Boswell III',
      street: '850 W Cold Springs Rd Unit 340',
      city: 'Fairhollow',
      state: 'NV',
      zip: '89044',
    },
  ],
  ['# WRITE TO MAIL TO', null],
  ['TERMS OF USE. These voter addresses are provided solely to address and mail', null],
  ['page 2 of 26', null],
  ['', null],
  // Vote Forward's format: no row index, ALL CAPS name followed by a comma.
  [
    'KEZIAH MONTGOMERY, 3389 HAWTHORNE ST, BRIDGEMONT, PA 19188',
    { name: 'KEZIAH MONTGOMERY', street: '3389 HAWTHORNE ST', city: 'BRIDGEMONT', state: 'PA', zip: '19188' },
  ],
  [
    'JOSEPHINE ALDRIDGE, 2504 MAPLE HOLLOW UNIT 7, FAIRWOOD BEND, PA 15088',
    { name: 'JOSEPHINE ALDRIDGE', street: '2504 MAPLE HOLLOW UNIT 7', city: 'FAIRWOOD BEND', state: 'PA', zip: '15088' },
  ],
  [
    'DELANEY ASHFORD, 512 CEDARVIEW AVE, STONEBRIDGE HOLLOW, PA 15188',
    { name: 'DELANEY ASHFORD', street: '512 CEDARVIEW AVE', city: 'STONEBRIDGE HOLLOW', state: 'PA', zip: '15188' },
  ],
  [
    'THEODORE BLACKWOOD, 415 JUNIPER RD LOT 42, NORTHFIELD CROSS, PA 17388',
    { name: 'THEODORE BLACKWOOD', street: '415 JUNIPER RD LOT 42', city: 'NORTHFIELD CROSS', state: 'PA', zip: '17388' },
  ],
  // Return-address artifact lines from the Vote Forward PDF's letterhead —
  // neither ends in a real City, ST ZIP tail, so both are correctly ignored.
  ['5131 W. GIRARD PMB#1, 5131 W. GIRARD PMB#1,', null],
  ['PHILADELPHIA, PA 19131 PHILADELPHIA, PA 19131', null],
];

describe('parseVoterLine', () => {
  for (const [input, expected] of cases) {
    it(`parses: ${input || '(empty line)'}`, () => {
      expect(parseVoterLine(input)).toEqual(expected);
    });
  }
});

describe('looksLikeDataRow', () => {
  it('is true for lines starting with an index number', () => {
    expect(looksLikeDataRow('1 Marigold Ashworth 22140 Willowmere Dr, Elderglen, NC 27599')).toBe(true);
  });

  it('is true for unindexed comma-separated lines with a real address tail', () => {
    expect(looksLikeDataRow('KEZIAH MONTGOMERY, 3389 HAWTHORNE ST, BRIDGEMONT, PA 19188')).toBe(true);
  });

  it('is false for header/footer lines', () => {
    expect(looksLikeDataRow('# WRITE TO MAIL TO')).toBe(false);
    expect(looksLikeDataRow('page 2 of 26')).toBe(false);
  });

  it('is false for lines with no real City, ST ZIP tail, even if they start with digits', () => {
    expect(looksLikeDataRow('5131 W. GIRARD PMB#1, 5131 W. GIRARD PMB#1,')).toBe(false);
  });
});

describe('parseVoterLine fallback for unrecognized name/street conventions', () => {
  it('keeps the whole prefix as the name rather than dropping a line with a real address tail', () => {
    // Mixed-case name with a comma before the street and no digit-led street
    // token — neither known heuristic applies, but there's clearly a real
    // address here, so it must still produce a record.
    expect(parseVoterLine('Some Committee, Main Office, Anytown, CA 90001')).toEqual({
      name: 'Some Committee, Main Office',
      street: '',
      city: 'Anytown',
      state: 'CA',
      zip: '90001',
    });
  });
});
