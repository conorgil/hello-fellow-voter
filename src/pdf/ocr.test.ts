import { describe, expect, it } from 'vitest';
import { groupItemsIntoLines } from './extractLines';
import {
  binarizeImageData,
  detectHorizontalGridlines,
  hasConsistentRowSpacing,
  joinOcrRowWords,
  OCR_TEXT_LAYER_THRESHOLD,
  pageNeedsOcr,
  tesseractWordsToPositionedItems,
} from './ocr';

describe('pageNeedsOcr', () => {
  it('is true for a page with no text items at all (a fully scanned page)', () => {
    expect(pageNeedsOcr([])).toBe(true);
  });

  it('is true for a page whose only text is a short stray fragment, like a page number', () => {
    expect(pageNeedsOcr([{ str: '14', x: 300, y: 20 }])).toBe(true);
  });

  it('is false for a page with a real amount of extracted text', () => {
    const items = [
      { str: 'Darrel Taylor', x: 10, y: 500 },
      { str: '526 N Budd St, Philadelphia, PA 19104', x: 10, y: 480 },
    ];
    expect(pageNeedsOcr(items)).toBe(false);
  });

  it('counts only non-whitespace characters against the threshold', () => {
    const whitespaceOnly = [{ str: ' '.repeat(OCR_TEXT_LAYER_THRESHOLD + 5), x: 0, y: 0 }];
    expect(pageNeedsOcr(whitespaceOnly)).toBe(true);
  });
});

describe('tesseractWordsToPositionedItems', () => {
  it('converts pixel-space, top-left-origin word boxes into PDF-point, bottom-left-origin items', () => {
    const scale = 2;
    const pageHeightPoints = 792; // US Letter
    const words = [
      { text: 'Darrel', bbox: { x0: 100, y0: 50 } }, // near the top of the rendered image
      { text: 'Taylor', bbox: { x0: 200, y0: 50 } },
    ];

    const items = tesseractWordsToPositionedItems(words, scale, pageHeightPoints);

    expect(items).toEqual([
      { str: 'Darrel', x: 50, y: 767 },
      { str: 'Taylor', x: 100, y: 767 },
    ]);
  });

  it('filters out blank/whitespace-only words', () => {
    const words = [
      { text: 'Hello', bbox: { x0: 0, y0: 0 } },
      { text: '   ', bbox: { x0: 10, y0: 0 } },
    ];
    expect(tesseractWordsToPositionedItems(words, 1, 100)).toEqual([{ str: 'Hello', x: 0, y: 100 }]);
  });

  it('round-trips through groupItemsIntoLines just like real pdf.js text items would', () => {
    const scale = 2;
    const pageHeightPoints = 792;
    // Two words on the same OCR'd line (same y0, i.e. same row in the rendered image).
    const words = [
      { text: 'Darrel', bbox: { x0: 100, y0: 300 } },
      { text: 'Taylor', bbox: { x0: 240, y0: 301 } }, // 1px jitter — still the same row
    ];

    const items = tesseractWordsToPositionedItems(words, scale, pageHeightPoints);
    expect(groupItemsIntoLines(items, 3)).toEqual(['Darrel Taylor']);
  });
});

/** Builds a synthetic RGBA image for `detectHorizontalGridlines` tests: an all-white
 * canvas with given rows either fully dark (a ruling line) or sparsely dark (text-like). */
function buildImage(width: number, height: number, fullyDarkRows: number[], sparseDarkRows: number[] = []): {
  width: number;
  height: number;
  data: Uint8ClampedArray;
} {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const setPixel = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = 0;
  };
  for (const y of fullyDarkRows) {
    for (let x = 0; x < width; x++) setPixel(x, y);
  }
  for (const y of sparseDarkRows) {
    for (let x = 0; x < width; x += 10) setPixel(x, y); // 10% coverage — text-like, not a ruling line
  }
  return { width, height, data };
}

describe('detectHorizontalGridlines', () => {
  it('finds nothing in a page with only sparse, text-like dark rows', () => {
    const image = buildImage(200, 50, [], [10, 20, 30]);
    expect(detectHorizontalGridlines(image)).toEqual([]);
  });

  it('finds each full-width dark row as a gridline', () => {
    const image = buildImage(200, 50, [5, 20, 35]);
    expect(detectHorizontalGridlines(image)).toEqual([5, 20, 35]);
  });

  it('merges a multi-pixel-thick ruling line into one gridline at its center', () => {
    const image = buildImage(200, 50, [20, 21, 22]);
    expect(detectHorizontalGridlines(image)).toEqual([21]);
  });

  it('ignores sparse text rows mixed in alongside real gridlines', () => {
    const image = buildImage(200, 60, [5, 50], [15, 30]);
    expect(detectHorizontalGridlines(image)).toEqual([5, 50]);
  });
});

describe('hasConsistentRowSpacing', () => {
  it('is true for gridlines repeating at a near-uniform spacing, like a real ruled table', () => {
    // Real sample-document pattern: an irregular header gap, then many ~67px row gaps.
    expect(hasConsistentRowSpacing([100, 740, 806, 873, 940, 1007, 1074])).toBe(true);
  });

  it('is false for a handful of incidental dark rows at irregular distances, like JPEG noise near text', () => {
    expect(hasConsistentRowSpacing([250, 276, 296, 518, 563])).toBe(false);
  });

  it('is false for too few gridlines to show a repeating pattern', () => {
    expect(hasConsistentRowSpacing([100, 200])).toBe(false);
  });
});

describe('joinOcrRowWords', () => {
  const scale = 2.5;

  it('joins words in the same cell with a plain space', () => {
    const words = [
      { text: 'DEBORAH', bbox: { x0: 53, x1: 161 } },
      { text: 'JACKSON', bbox: { x0: 170, x1: 270 } },
    ];
    expect(joinOcrRowWords(words, scale)).toBe('DEBORAH JACKSON');
  });

  it('inserts a comma at a column-sized gap between cells', () => {
    const words = [
      { text: 'CROZET', bbox: { x0: 924, x1: 1011 } }, // city cell
      { text: 'VA', bbox: { x0: 1223, x1: 1254 } }, // state cell — gap of (1223-1011)/2.5 = 84.8pt, well over the threshold
    ];
    expect(joinOcrRowWords(words, scale)).toBe('CROZET, VA');
  });

  it('sorts out-of-order words left to right before joining', () => {
    const words = [
      { text: 'JACKSON', bbox: { x0: 170, x1: 270 } },
      { text: 'DEBORAH', bbox: { x0: 53, x1: 161 } },
    ];
    expect(joinOcrRowWords(words, scale)).toBe('DEBORAH JACKSON');
  });

  it('filters out blank/whitespace-only words', () => {
    const words = [
      { text: 'VA', bbox: { x0: 1223, x1: 1254 } },
      { text: '  ', bbox: { x0: 1260, x1: 1270 } },
      { text: '22932', bbox: { x0: 1289, x1: 1356 } },
    ];
    expect(joinOcrRowWords(words, scale)).toBe('VA 22932');
  });

  it('returns an empty string for no real words', () => {
    expect(joinOcrRowWords([], scale)).toBe('');
  });

  it('filters out a column rule misread as a standalone "|" word between cells', () => {
    const words = [
      { text: 'VA', bbox: { x0: 1223, x1: 1254 } },
      { text: '|', bbox: { x0: 1260, x1: 1265 } },
      { text: '22932', bbox: { x0: 1289, x1: 1356 } },
    ];
    expect(joinOcrRowWords(words, scale)).toBe('VA 22932');
  });
});

describe('binarizeImageData', () => {
  /** Builds a flat RGBA buffer from a list of per-pixel grayscale values (one row). */
  function buildGrayRow(values: number[]): { width: number; height: number; data: Uint8ClampedArray } {
    const data = new Uint8ClampedArray(values.length * 4);
    values.forEach((v, i) => {
      data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
      data[i * 4 + 3] = 255;
    });
    return { width: values.length, height: 1, data };
  }

  it('pushes a bimodal mix of dark glyph pixels and light background pixels to pure black/white', () => {
    const image = buildGrayRow([10, 12, 8, 245, 250, 248, 252]);
    binarizeImageData(image);
    const values = Array.from({ length: 7 }, (_, i) => image.data[i * 4]);
    expect(values).toEqual([0, 0, 0, 255, 255, 255, 255]);
  });

  it('leaves a uniform image entirely on one side of the threshold', () => {
    const image = buildGrayRow([200, 200, 200, 200]);
    binarizeImageData(image);
    expect(Array.from({ length: 4 }, (_, i) => image.data[i * 4])).toEqual([255, 255, 255, 255]);
  });

  it('zeroes out color channels identically, leaving a true grayscale black/white image', () => {
    const data = new Uint8ClampedArray([20, 20, 20, 255, 230, 230, 230, 255]);
    const image = { width: 2, height: 1, data };
    binarizeImageData(image);
    expect(Array.from(image.data)).toEqual([0, 0, 0, 255, 255, 255, 255, 255]);
  });
});
