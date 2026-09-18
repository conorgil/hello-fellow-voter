import { beforeEach, describe, expect, it } from 'vitest';
import {
  addCard,
  canRedo,
  canUndo,
  createProject,
  dedupeKey,
  deleteCard,
  getCardsForProject,
  normalize,
  redo,
  undo,
} from './storage';

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

describe('normalize', () => {
  it('lowercases, strips punctuation, and collapses whitespace', () => {
    expect(normalize('Marcus Windham Jr.')).toBe('marcus windham jr');
    expect(normalize('  Marigold   Ashworth ')).toBe('marigold ashworth');
    expect(normalize('#105')).toBe('105');
  });
});

describe('dedupeKey', () => {
  it('treats equivalent formatting as the same key', () => {
    const a = dedupeKey('p1', 'Marcus Windham Jr.', '719 Sycamore Ave', 'Hollowbrook', 'NJ', '07644');
    const b = dedupeKey('p1', 'marcus windham jr', '719 sycamore ave', 'hollowbrook', 'nj', '07644');
    expect(a).toBe(b);
  });

  it('ignores a ZIP+4 suffix when comparing', () => {
    const a = dedupeKey('p1', 'Milo Thackeray', 'PO Box 884', 'Ashcombe', 'NC', '27861-0884');
    const b = dedupeKey('p1', 'Milo Thackeray', 'PO Box 884', 'Ashcombe', 'NC', '27861');
    expect(a).toBe(b);
  });

  it('scopes the key to the project, so the same voter in two projects does not collide', () => {
    const a = dedupeKey('project-a', 'Marigold Ashworth', '22140 Willowmere Dr', 'Elderglen', 'NC', '27599');
    const b = dedupeKey('project-b', 'Marigold Ashworth', '22140 Willowmere Dr', 'Elderglen', 'NC', '27599');
    expect(a).not.toBe(b);
  });
});

describe('undo', () => {
  it('reports nothing to undo when no data mutation has happened yet', () => {
    expect(canUndo()).toBe(false);
  });

  it('reverts the most recent card mutation', () => {
    const project = createProject('Test Project');
    addCard(project.id, { name: 'A', street: '1 A St', city: 'X', state: 'NY', zip: '10001' });
    expect(canUndo()).toBe(true);

    const card = addCard(project.id, { name: 'B', street: '2 B St', city: 'X', state: 'NY', zip: '10001' });
    expect(getCardsForProject(project.id)).toHaveLength(2);

    deleteCard(card.id);
    expect(getCardsForProject(project.id)).toHaveLength(1);

    expect(undo()).toBe(true);
    expect(getCardsForProject(project.id).map((c) => c.name).sort()).toEqual(['A', 'B']);
  });

  it('returns false when the undo history is exhausted', () => {
    while (undo()) {
      // drain any history left over from earlier tests in this file
    }
    createProject('Only Project');
    expect(undo()).toBe(true);
    expect(undo()).toBe(false);
  });
});

describe('redo', () => {
  it('reports nothing to redo when nothing has been undone yet', () => {
    while (undo()) {
      // drain any undo history left over from earlier tests
    }
    createProject('Reset Project'); // a fresh mutation clears any accumulated redo history
    expect(canRedo()).toBe(false);
  });

  it('re-applies an undone mutation', () => {
    const project = createProject('Redo Project');
    const card = addCard(project.id, { name: 'C', street: '3 C St', city: 'X', state: 'NY', zip: '10001' });
    deleteCard(card.id);
    expect(getCardsForProject(project.id)).toHaveLength(0);

    expect(undo()).toBe(true);
    expect(getCardsForProject(project.id)).toHaveLength(1);
    expect(canRedo()).toBe(true);

    expect(redo()).toBe(true);
    expect(getCardsForProject(project.id)).toHaveLength(0);
  });

  it('clears redo history once a new mutation is made after an undo', () => {
    const project = createProject('Branch Project');
    addCard(project.id, { name: 'D', street: '4 D St', city: 'X', state: 'NY', zip: '10001' });

    expect(undo()).toBe(true);
    expect(canRedo()).toBe(true);

    addCard(project.id, { name: 'E', street: '5 E St', city: 'X', state: 'NY', zip: '10001' });
    expect(canRedo()).toBe(false);
    expect(redo()).toBe(false);
  });
});
