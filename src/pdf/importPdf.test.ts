import { beforeEach, describe, expect, it } from 'vitest';
import { createProject, getColumns, getVotersForProject } from '../storage';
import { importRecords } from './importPdf';

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

describe('importRecords', () => {
  it('restores a new voter into the column matching its exported status label', () => {
    const project = mustCreateProject('Project');
    const mailedColumn = getColumns(project.id).find((c) => c.label === 'Mailed')!;

    const result = importRecords(project.id, [
      { name: 'Darrel Taylor', street: '526 N Budd St', city: 'Philadelphia', state: 'PA', zip: '19104', status: 'Mailed' },
    ]);

    expect(result.importedCount).toBe(1);
    expect(result.duplicateCount).toBe(0);
    expect(result.statusUpdatedCount).toBe(0);

    const voters = getVotersForProject(project.id);
    expect(voters).toHaveLength(1);
    expect(voters[0].status).toBe(mailedColumn.id);
  });

  it('falls back to the first column for a new voter whose status has no matching column', () => {
    const project = mustCreateProject('Project');
    const firstColumn = getColumns(project.id)[0];

    const result = importRecords(project.id, [
      {
        name: 'Darrel Taylor',
        street: '526 N Budd St',
        city: 'Philadelphia',
        state: 'PA',
        zip: '19104',
        status: 'Some Unknown Status',
      },
    ]);

    expect(result.importedCount).toBe(1);
    const voters = getVotersForProject(project.id);
    expect(voters[0].status).toBe(firstColumn.id);
  });

  it('updates an existing duplicate voter to the imported status when a matching column exists', () => {
    const project = mustCreateProject('Project');
    const todoColumn = getColumns(project.id).find((c) => c.label === 'TODO')!;
    const mailedColumn = getColumns(project.id).find((c) => c.label === 'Mailed')!;

    importRecords(project.id, [
      { name: 'Darrel Taylor', street: '526 N Budd St', city: 'Philadelphia', state: 'PA', zip: '19104' },
    ]);
    expect(getVotersForProject(project.id)[0].status).toBe(todoColumn.id);

    const result = importRecords(project.id, [
      { name: 'Darrel Taylor', street: '526 N Budd St', city: 'Philadelphia', state: 'PA', zip: '19104', status: 'Mailed' },
    ]);

    expect(result.importedCount).toBe(0);
    expect(result.duplicateCount).toBe(1);
    expect(result.statusUpdatedCount).toBe(1);

    const voters = getVotersForProject(project.id);
    expect(voters).toHaveLength(1);
    expect(voters[0].status).toBe(mailedColumn.id);
  });

  it('leaves a duplicate voter untouched when the imported status has no matching column', () => {
    const project = mustCreateProject('Project');
    const todoColumn = getColumns(project.id).find((c) => c.label === 'TODO')!;

    importRecords(project.id, [
      { name: 'Darrel Taylor', street: '526 N Budd St', city: 'Philadelphia', state: 'PA', zip: '19104' },
    ]);

    const result = importRecords(project.id, [
      {
        name: 'Darrel Taylor',
        street: '526 N Budd St',
        city: 'Philadelphia',
        state: 'PA',
        zip: '19104',
        status: 'Some Unknown Status',
      },
    ]);

    expect(result.duplicateCount).toBe(1);
    expect(result.statusUpdatedCount).toBe(0);

    const voters = getVotersForProject(project.id);
    expect(voters).toHaveLength(1);
    expect(voters[0].status).toBe(todoColumn.id);
  });
});
