import * as pdfjsLib from 'pdfjs-dist';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildVoterStatusPdfDoc } from '../export/exportVoterStatusPdf';
import { createProject, getColumns, getVotersForProject } from '../storage';
import type { Voter } from '../types';
import { importPdf } from './importPdf';

// `extractLines.ts` points pdf.js at its worker via a Vite `?url` import, which
// resolves to a dev-server-relative path (e.g. "/node_modules/pdfjs-dist/...") —
// meaningless outside an actual Vite dev server. Under vitest there's no server
// to fetch it from, so point pdf.js at the real file on disk instead.
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

function mustCreateProject(name: string) {
  const project = createProject(name);
  if (!project) throw new Error(`failed to create project ${name}`);
  return project;
}

function makeVoter(projectId: string, status: string, order: number, overrides: Partial<Voter> = {}): Voter {
  return {
    id: crypto.randomUUID(),
    projectId,
    name: 'Darrel Taylor',
    street: '526 N Budd St # B',
    city: 'Philadelphia',
    state: 'PA',
    zip: '19104',
    status,
    order,
    createdAt: new Date().toISOString(),
    labelIds: [],
    ...overrides,
  };
}

describe('export → import round trip', () => {
  it('re-imports every voter from its own export PDF, restoring status by column label', async () => {
    const sourceProject = mustCreateProject('Source');
    const sourceColumns = getColumns(sourceProject.id);
    const todoId = sourceColumns.find((c) => c.label === 'TODO')!.id;
    const mailedId = sourceColumns.find((c) => c.label === 'Mailed')!.id;

    const voters: Voter[] = [
      makeVoter(sourceProject.id, todoId, 0, { name: 'Alice Adams', street: '1 Main St', zip: '19104' }),
      makeVoter(sourceProject.id, mailedId, 0, { name: 'Bob Brown', street: '2 Main St', zip: '19105' }),
      makeVoter(sourceProject.id, mailedId, 1, {
        name: 'Carla, "The" Cruz',
        street: '3 Main St, Apt #4',
        zip: '19106',
      }),
    ];

    const doc = buildVoterStatusPdfDoc(sourceProject, voters);
    const arrayBuffer = doc.output('arraybuffer');
    const file = new File([arrayBuffer], 'export.pdf', { type: 'application/pdf' });

    const destProject = mustCreateProject('Destination');
    const destColumns = getColumns(destProject.id);
    const destTodoId = destColumns.find((c) => c.label === 'TODO')!.id;
    const destMailedId = destColumns.find((c) => c.label === 'Mailed')!.id;

    const result = await importPdf(destProject.id, file);

    expect(result.importedCount).toBe(3);
    expect(result.duplicateCount).toBe(0);
    expect(result.statusUpdatedCount).toBe(0);
    expect(result.skippedCount).toBe(0);
    expect(result.suspectedLines).toEqual([]);

    const imported = getVotersForProject(destProject.id);
    expect(imported).toHaveLength(3);

    const alice = imported.find((v) => v.name === 'Alice Adams')!;
    expect(alice).toMatchObject({ street: '1 Main St', city: 'Philadelphia', state: 'PA', zip: '19104', status: destTodoId });

    const bob = imported.find((v) => v.name === 'Bob Brown')!;
    expect(bob).toMatchObject({ street: '2 Main St', city: 'Philadelphia', state: 'PA', zip: '19105', status: destMailedId });

    const carla = imported.find((v) => v.name === 'Carla, "The" Cruz')!;
    expect(carla).toMatchObject({
      street: '3 Main St, Apt #4',
      city: 'Philadelphia',
      state: 'PA',
      zip: '19106',
      status: destMailedId,
    });
  });

  it('updates status on re-import when the destination already has a matching voter', async () => {
    const sourceProject = mustCreateProject('Source');
    const mailedId = getColumns(sourceProject.id).find((c) => c.label === 'Mailed')!.id;
    const voters = [makeVoter(sourceProject.id, mailedId, 0)];

    const doc = buildVoterStatusPdfDoc(sourceProject, voters);
    const file = new File([doc.output('arraybuffer')], 'export.pdf', { type: 'application/pdf' });

    const destProject = mustCreateProject('Destination');
    const destTodoId = getColumns(destProject.id).find((c) => c.label === 'TODO')!.id;
    const destMailedId = getColumns(destProject.id).find((c) => c.label === 'Mailed')!.id;

    // Pre-seed the destination with the same voter, still TODO.
    const existing = makeVoter(destProject.id, destTodoId, 0);
    const { addVoters } = await import('../storage');
    addVoters([existing]);

    const result = await importPdf(destProject.id, file);

    expect(result.importedCount).toBe(0);
    expect(result.duplicateCount).toBe(1);
    expect(result.statusUpdatedCount).toBe(1);

    const imported = getVotersForProject(destProject.id);
    expect(imported).toHaveLength(1);
    expect(imported[0].status).toBe(destMailedId);
  });
});
