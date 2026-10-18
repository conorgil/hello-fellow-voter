import * as pdfjsLib from 'pdfjs-dist';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProject, dedupeKey, getVotersForProject } from '../storage';
import {
  buildSingleColumnMultiLinePdf,
  buildSingleColumnSingleLinePdf,
  buildTwoColumnMultiLinePdf,
  buildTwoColumnSingleLinePdf,
} from './buildTestPdf';
import { generateFakeVoters, type FakeVoter } from './fakeVoters';
import { importPdf } from './importPdf';

// Same vitest-environment worker fixup as importExportRoundTrip.test.ts.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  '../../node_modules/pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).href;

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

globalThis.localStorage = new MemoryStorage();

beforeEach(() => {
  localStorage.clear();
});

const VOTERS = generateFakeVoters(500);

function keyOf(projectId: string, v: FakeVoter): string {
  return dedupeKey(projectId, v.name, v.street, v.city, v.state, v.zip);
}

const LAYOUTS: [string, (voters: FakeVoter[]) => ArrayBuffer][] = [
  ['single column, single voter per line', buildSingleColumnSingleLinePdf],
  ['single column, multi-line voter', buildSingleColumnMultiLinePdf],
  ['2 column, single voter per line', buildTwoColumnSingleLinePdf],
  ['2 column, multi-line voter', buildTwoColumnMultiLinePdf],
];

describe('importing generated layout PDFs', () => {
  for (const [label, buildPdf] of LAYOUTS) {
    it(`round-trips all 500 generated voters for: ${label}`, async () => {
      const project = createProject(label)!;
      const buffer = buildPdf(VOTERS);
      const file = new File([buffer], 'generated.pdf', { type: 'application/pdf' });

      const result = await importPdf(project.id, file);

      expect(result.importedCount).toBe(500);
      expect(result.duplicateCount).toBe(0);
      expect(result.skippedCount).toBe(0);
      expect(result.suspectedLines).toEqual([]);

      const voters = getVotersForProject(project.id);
      expect(voters).toHaveLength(500);

      const expectedKeys = new Set(VOTERS.map((v) => keyOf(project.id, v)));
      const actualKeys = new Set(voters.map((v) => keyOf(project.id, v)));
      expect(actualKeys).toEqual(expectedKeys);

      const first = voters.find((v) => v.name === VOTERS[0].name && v.street === VOTERS[0].street);
      expect(first).toMatchObject(VOTERS[0]);

      const last = voters.find((v) => v.name === VOTERS[499].name && v.street === VOTERS[499].street);
      expect(last).toMatchObject(VOTERS[499]);
    });
  }
});
