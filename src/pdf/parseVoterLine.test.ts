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

  it('is false for header/footer lines', () => {
    expect(looksLikeDataRow('# WRITE TO MAIL TO')).toBe(false);
    expect(looksLikeDataRow('page 2 of 26')).toBe(false);
  });
});
