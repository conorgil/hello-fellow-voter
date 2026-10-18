import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as pdfjsLib from 'pdfjs-dist';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProject, getVotersForProject } from '../storage';
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

function loadFixture(name: string): File {
  const buf = readFileSync(path.join(__dirname, '../../test-data', name));
  return new File([buf], name, { type: 'application/pdf' });
}

describe('importing real-world PDFs', () => {
  it('imports a 2-column, 3-line-per-record layout with no commas in the city/state/zip line', async () => {
    const project = createProject('Indivisible Philly')!;
    const file = loadFixture('indivisible-philly.pdf');

    const result = await importPdf(project.id, file);

    expect(result.importedCount).toBe(500);
    expect(result.duplicateCount).toBe(0);

    const voters = getVotersForProject(project.id);
    expect(voters).toHaveLength(500);

    const darrel = voters.find((v) => v.name === 'Darrel Taylor');
    expect(darrel).toMatchObject({
      street: '526 N Budd St # B',
      city: 'Philadelphia',
      state: 'PA',
      zip: '19104',
    });

    const peter = voters.find((v) => v.name === 'Peter Brothers');
    expect(peter).toMatchObject({
      street: '6244 N Beechwood St',
      city: 'Philadelphia',
      state: 'PA',
      zip: '19138',
    });

    expect(result.skippedCount).toBe(0);
    expect(result.suspectedLines).toEqual([]);
  });

  it('still imports single-column single-line formats (regression check)', async () => {
    const project = createProject('Signs of Justice')!;
    const file = loadFixture('signs-of-justice.pdf');
    const result = await importPdf(project.id, file);
    expect(result.importedCount).toBe(498);
    expect(result.skippedCount).toBe(0);
  });

  it('still imports Vote Forward format (regression check)', async () => {
    const project = createProject('Vote Forward')!;
    const file = loadFixture('vote-forward.pdf');
    const result = await importPdf(project.id, file);
    expect(result.importedCount).toBe(20);
    expect(result.skippedCount).toBe(0);
  });
});
