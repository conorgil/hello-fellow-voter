import { beforeEach, describe, expect, it } from 'vitest';
import {
  clampAddressFontSize,
  DEFAULT_ADDRESS_FONT_SIZE,
  DEFAULT_ADDRESS_VIEW_MODE,
  MAX_ADDRESS_FONT_SIZE,
  MIN_ADDRESS_FONT_SIZE,
} from './addressView';
import { DEFAULT_MESSAGE } from './postcardMessages';
import {
  addColumn,
  addLabelToVoters,
  addVoter,
  addToSuspectQueue,
  canRedo,
  canUndo,
  createLabel,
  createProject,
  dedupeKey,
  deleteColumn,
  deleteLabel,
  deleteProject,
  deleteVoter,
  getColumns,
  getLabels,
  getProjectAddressViewFontSize,
  getProjectAddressViewMode,
  getProjectMessage,
  getVotersForProject,
  getSuspectQueue,
  moveVoter,
  moveVoters,
  normalize,
  redo,
  removeFromSuspectQueue,
  removeLabelFromVoters,
  renameColumn,
  renameProject,
  reorderColumns,
  setColumnAutomation,
  setProjectAddressViewFontSize,
  setProjectAddressViewMode,
  setProjectMessage,
  toggleVoterLabel,
  undo,
  updateLabel,
} from './storage';
import { DEFAULT_COLUMNS, type Project } from './types';

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

/** Every test in this file uses a distinct project name, so creation never actually fails. */
function mustCreateProject(name: string): Project {
  const project = createProject(name);
  if (!project) throw new Error(`expected to create project "${name}"`);
  return project;
}

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

  it('reverts the most recent voter mutation', () => {
    const project = mustCreateProject('Test Project');
    addVoter(project.id, { name: 'A', street: '1 A St', city: 'X', state: 'NY', zip: '10001' });
    expect(canUndo()).toBe(true);

    const voter = addVoter(project.id, { name: 'B', street: '2 B St', city: 'X', state: 'NY', zip: '10001' });
    expect(getVotersForProject(project.id)).toHaveLength(2);

    deleteVoter(voter.id);
    expect(getVotersForProject(project.id)).toHaveLength(1);

    expect(undo()).toBe(true);
    expect(getVotersForProject(project.id).map((v) => v.name).sort()).toEqual(['A', 'B']);
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
    const project = mustCreateProject('Redo Project');
    const voter = addVoter(project.id, { name: 'C', street: '3 C St', city: 'X', state: 'NY', zip: '10001' });
    deleteVoter(voter.id);
    expect(getVotersForProject(project.id)).toHaveLength(0);

    expect(undo()).toBe(true);
    expect(getVotersForProject(project.id)).toHaveLength(1);
    expect(canRedo()).toBe(true);

    expect(redo()).toBe(true);
    expect(getVotersForProject(project.id)).toHaveLength(0);
  });

  it('clears redo history once a new mutation is made after an undo', () => {
    const project = mustCreateProject('Branch Project');
    addVoter(project.id, { name: 'D', street: '4 D St', city: 'X', state: 'NY', zip: '10001' });

    expect(undo()).toBe(true);
    expect(canRedo()).toBe(true);

    addVoter(project.id, { name: 'E', street: '5 E St', city: 'X', state: 'NY', zip: '10001' });
    expect(canRedo()).toBe(false);
    expect(redo()).toBe(false);
  });
});

describe('suspect queue', () => {
  it('is empty for a project with no pending review lines', () => {
    const project = mustCreateProject('Suspects Project');
    expect(getSuspectQueue(project.id)).toEqual([]);
  });

  it('appends new lines and skips exact duplicates already queued', () => {
    const project = mustCreateProject('Dedupe Project');
    addToSuspectQueue(project.id, ['line one', 'line two']);
    addToSuspectQueue(project.id, ['line two', 'line three']);
    expect(getSuspectQueue(project.id)).toEqual(['line one', 'line two', 'line three']);
  });

  it('scopes the queue per project', () => {
    const a = mustCreateProject('Project A');
    const b = mustCreateProject('Project B');
    addToSuspectQueue(a.id, ['only in A']);
    expect(getSuspectQueue(a.id)).toEqual(['only in A']);
    expect(getSuspectQueue(b.id)).toEqual([]);
  });

  it('removes one resolved line, leaving the rest queued', () => {
    const project = mustCreateProject('Resolve Project');
    addToSuspectQueue(project.id, ['keep me', 'remove me']);
    removeFromSuspectQueue(project.id, 'remove me');
    expect(getSuspectQueue(project.id)).toEqual(['keep me']);
  });

  it('does nothing when removing a line that is not queued', () => {
    const project = mustCreateProject('No-op Project');
    addToSuspectQueue(project.id, ['keep me']);
    removeFromSuspectQueue(project.id, 'never queued');
    expect(getSuspectQueue(project.id)).toEqual(['keep me']);
  });
});

describe('project name uniqueness', () => {
  it('rejects creating a project whose name (case-insensitively) already exists', () => {
    mustCreateProject('Unique Project');
    expect(createProject('unique project')).toBeNull();
    expect(createProject('  Unique Project  ')).toBeNull();
  });

  it('rejects renaming a project to a name another project already uses', () => {
    mustCreateProject('First Project');
    const second = mustCreateProject('Second Project');
    expect(renameProject(second.id, 'first project')).toBe(false);
  });

  it('allows renaming a project to its own current name', () => {
    const project = mustCreateProject('Same Name Project');
    expect(renameProject(project.id, 'Same Name Project')).toBe(true);
  });
});

describe('project message', () => {
  it('defaults to the proven-effective default message for a freshly created project', () => {
    const project = mustCreateProject('Message Default Project');
    expect(getProjectMessage(project.id)).toBe(DEFAULT_MESSAGE);
  });

  it('round-trips a stored message', () => {
    const project = mustCreateProject('Message Round Trip Project');
    setProjectMessage(project.id, 'Please vote by Nov 5!');
    expect(getProjectMessage(project.id)).toBe('Please vote by Nov 5!');
  });

  it('trims whitespace when storing', () => {
    const project = mustCreateProject('Message Trim Project');
    setProjectMessage(project.id, '  Please vote!  ');
    expect(getProjectMessage(project.id)).toBe('Please vote!');
  });

  it('is a no-op for an unknown project id', () => {
    expect(() => setProjectMessage('not-a-real-id', 'Hello')).not.toThrow();
    expect(getProjectMessage('not-a-real-id')).toBe('');
  });
});

describe('project address view mode and font size', () => {
  it('defaults to postcard mode and the default font size for a freshly created project', () => {
    const project = mustCreateProject('Address View Default Project');
    expect(getProjectAddressViewMode(project.id)).toBe(DEFAULT_ADDRESS_VIEW_MODE);
    expect(getProjectAddressViewFontSize(project.id)).toBe(DEFAULT_ADDRESS_FONT_SIZE);
  });

  it('round-trips the view mode', () => {
    const project = mustCreateProject('Address View Mode Round Trip Project');
    setProjectAddressViewMode(project.id, 'address-only');
    expect(getProjectAddressViewMode(project.id)).toBe('address-only');
    setProjectAddressViewMode(project.id, 'postcard');
    expect(getProjectAddressViewMode(project.id)).toBe('postcard');
  });

  it('is a no-op to set the view mode for an unknown project id', () => {
    expect(() => setProjectAddressViewMode('not-a-real-id', 'address-only')).not.toThrow();
    expect(getProjectAddressViewMode('not-a-real-id')).toBe(DEFAULT_ADDRESS_VIEW_MODE);
  });

  it('round-trips an in-range font size', () => {
    const project = mustCreateProject('Address View Font Size Round Trip Project');
    const inRangeSize = (MIN_ADDRESS_FONT_SIZE + MAX_ADDRESS_FONT_SIZE) / 2;
    setProjectAddressViewFontSize(project.id, inRangeSize);
    expect(getProjectAddressViewFontSize(project.id)).toBe(inRangeSize);
  });

  it('clamps a font size below the minimum', () => {
    const project = mustCreateProject('Address View Font Size Clamp Low Project');
    setProjectAddressViewFontSize(project.id, MIN_ADDRESS_FONT_SIZE - 5);
    expect(getProjectAddressViewFontSize(project.id)).toBe(MIN_ADDRESS_FONT_SIZE);
  });

  it('clamps a font size above the maximum', () => {
    const project = mustCreateProject('Address View Font Size Clamp High Project');
    setProjectAddressViewFontSize(project.id, MAX_ADDRESS_FONT_SIZE + 5);
    expect(getProjectAddressViewFontSize(project.id)).toBe(MAX_ADDRESS_FONT_SIZE);
  });

  it('is a no-op to set the font size for an unknown project id', () => {
    expect(() => setProjectAddressViewFontSize('not-a-real-id', 6)).not.toThrow();
    expect(getProjectAddressViewFontSize('not-a-real-id')).toBe(DEFAULT_ADDRESS_FONT_SIZE);
  });
});

describe('clampAddressFontSize', () => {
  it('passes through an in-range value unchanged', () => {
    const mid = (MIN_ADDRESS_FONT_SIZE + MAX_ADDRESS_FONT_SIZE) / 2;
    expect(clampAddressFontSize(mid)).toBe(mid);
  });

  it('passes through the exact min and max boundaries unchanged', () => {
    expect(clampAddressFontSize(MIN_ADDRESS_FONT_SIZE)).toBe(MIN_ADDRESS_FONT_SIZE);
    expect(clampAddressFontSize(MAX_ADDRESS_FONT_SIZE)).toBe(MAX_ADDRESS_FONT_SIZE);
  });

  it('clamps values outside the range', () => {
    expect(clampAddressFontSize(MIN_ADDRESS_FONT_SIZE - 1)).toBe(MIN_ADDRESS_FONT_SIZE);
    expect(clampAddressFontSize(MAX_ADDRESS_FONT_SIZE + 1)).toBe(MAX_ADDRESS_FONT_SIZE);
  });
});

describe('column defaults', () => {
  it('seeds a new project with the 5 default columns', () => {
    const project = mustCreateProject('Columns Default Project');
    expect(getColumns(project.id)).toEqual(DEFAULT_COLUMNS);
  });

  it('gives each project its own independent column list', () => {
    const a = mustCreateProject('Columns Project A');
    const b = mustCreateProject('Columns Project B');
    addColumn(a.id, 'Extra Column');
    expect(getColumns(a.id)).toHaveLength(DEFAULT_COLUMNS.length + 1);
    expect(getColumns(b.id)).toEqual(DEFAULT_COLUMNS);
  });
});

describe('addColumn', () => {
  it('appends a new column with the given label', () => {
    const project = mustCreateProject('Add Column Project');
    const column = addColumn(project.id, 'Follow Up');
    expect(column).not.toBeNull();
    expect(getColumns(project.id).at(-1)).toEqual(column);
  });

  it('rejects a label (case-insensitively) that already exists in the project', () => {
    const project = mustCreateProject('Add Duplicate Column Project');
    expect(addColumn(project.id, 'todo')).toBeNull();
    expect(addColumn(project.id, '  TODO  ')).toBeNull();
  });

  it('does not reject a label already used by a column in a different project', () => {
    const a = mustCreateProject('Cross Project A');
    const b = mustCreateProject('Cross Project B');
    expect(addColumn(a.id, 'Shared Label')).not.toBeNull();
    expect(addColumn(b.id, 'Shared Label')).not.toBeNull();
  });

  it('gives a new column all-null automation', () => {
    const project = mustCreateProject('Add Column Automation Project');
    const column = addColumn(project.id, 'Follow Up');
    expect(column?.automation).toEqual({
      onOpenMoveTo: null,
      doneMoveTo: null,
      nextVoterMoveTo: null,
      displayNextFrom: null,
      pullFrom: null,
      pullTo: null,
      assignLabelOnEntry: null,
    });
  });
});

describe('setColumnAutomation', () => {
  it('round-trips an automation config', () => {
    const project = mustCreateProject('Set Automation Project');
    const [first, second, third] = getColumns(project.id);
    const automation = {
      onOpenMoveTo: second.id,
      doneMoveTo: third.id,
      nextVoterMoveTo: second.id,
      displayNextFrom: second.id,
      pullFrom: first.id,
      pullTo: second.id,
      assignLabelOnEntry: null,
    };
    expect(setColumnAutomation(project.id, first.id, automation)).toBe(true);
    expect(getColumns(project.id).find((c) => c.id === first.id)?.automation).toEqual(automation);
  });

  it('returns false for an unknown column id', () => {
    const project = mustCreateProject('Set Automation Unknown Column Project');
    const automation = {
      onOpenMoveTo: null,
      doneMoveTo: null,
      nextVoterMoveTo: null,
      displayNextFrom: null,
      pullFrom: null,
      pullTo: null,
      assignLabelOnEntry: null,
    };
    expect(setColumnAutomation(project.id, 'not-a-real-id', automation)).toBe(false);
  });
});

describe('renameColumn', () => {
  it('renames an existing column', () => {
    const project = mustCreateProject('Rename Column Project');
    const [first] = getColumns(project.id);
    expect(renameColumn(project.id, first.id, 'Inbox')).toBe(true);
    expect(getColumns(project.id)[0].label).toBe('Inbox');
  });

  it('returns false for an unknown column id', () => {
    const project = mustCreateProject('Rename Unknown Column Project');
    expect(renameColumn(project.id, 'not-a-real-id', 'Whatever')).toBe(false);
  });

  it('returns false when another column already has that label', () => {
    const project = mustCreateProject('Rename Duplicate Column Project');
    const [first, second] = getColumns(project.id);
    expect(renameColumn(project.id, second.id, first.label)).toBe(false);
  });

  it('allows renaming a column to its own current label', () => {
    const project = mustCreateProject('Rename Same Label Column Project');
    const [first] = getColumns(project.id);
    expect(renameColumn(project.id, first.id, first.label)).toBe(true);
  });
});

describe('deleteColumn', () => {
  it('deletes an empty column', () => {
    const project = mustCreateProject('Delete Empty Column Project');
    const columns = getColumns(project.id);
    const last = columns.at(-1)!;
    expect(deleteColumn(project.id, last.id)).toEqual({ ok: true });
    expect(getColumns(project.id).find((c) => c.id === last.id)).toBeUndefined();
  });

  it('blocks deleting a column with voters until they are moved out', () => {
    const project = mustCreateProject('Delete Non-Empty Column Project');
    const columns = getColumns(project.id);
    const target = columns[1];
    const voter = addVoter(project.id, { name: 'A', street: '1 A St', city: 'X', state: 'NY', zip: '10001' });
    moveVoter(voter.id, target.id, null);

    expect(deleteColumn(project.id, target.id)).toEqual({ ok: false, reason: 'not-empty', voterCount: 1 });

    moveVoter(voter.id, columns[0].id, null);
    expect(deleteColumn(project.id, target.id)).toEqual({ ok: true });
  });

  it('blocks deleting the project\'s last remaining column', () => {
    const project = mustCreateProject('Delete Last Column Project');
    for (const column of [...getColumns(project.id)]) {
      const columns = getColumns(project.id);
      if (columns.length <= 1) break;
      deleteColumn(project.id, column.id);
    }
    const [onlyColumn] = getColumns(project.id);
    expect(deleteColumn(project.id, onlyColumn.id)).toEqual({ ok: false, reason: 'last-column' });
  });

  it('returns not-found for an unknown column id', () => {
    const project = mustCreateProject('Delete Unknown Column Project');
    expect(deleteColumn(project.id, 'not-a-real-id')).toEqual({ ok: false, reason: 'not-found' });
  });
});

describe('reorderColumns', () => {
  it('reorders columns given a permutation of their ids', () => {
    const project = mustCreateProject('Reorder Column Project');
    const ids = getColumns(project.id).map((c) => c.id);
    const reversed = [...ids].reverse();
    expect(reorderColumns(project.id, reversed)).toBe(true);
    expect(getColumns(project.id).map((c) => c.id)).toEqual(reversed);
  });

  it('rejects a list that is not a permutation, leaving the order unchanged', () => {
    const project = mustCreateProject('Reorder Invalid Column Project');
    const original = getColumns(project.id).map((c) => c.id);
    expect(reorderColumns(project.id, [...original, 'extra-id'])).toBe(false);
    expect(reorderColumns(project.id, original.slice(1))).toBe(false);
    expect(reorderColumns(project.id, [...original.slice(1), 'unknown-id'])).toBe(false);
    expect(getColumns(project.id).map((c) => c.id)).toEqual(original);
  });
});

describe('column migration backfill', () => {
  it('backfills the default columns for pre-existing projects with no stored columns', () => {
    const raw = {
      version: 1,
      projects: [{ id: 'legacy-project', name: 'Legacy Project', createdAt: '2025-01-01T00:00:00.000Z' }],
      activeProjectId: 'legacy-project',
      voters: [
        {
          id: 'legacy-voter',
          projectId: 'legacy-project',
          name: 'Legacy Voter',
          street: '1 Legacy St',
          city: 'X',
          state: 'NY',
          zip: '10001',
          status: 'todo',
          order: 0,
          createdAt: '2025-01-01T00:00:00.000Z',
        },
      ],
      suspectQueues: {},
    };
    localStorage.setItem('hello-fellow-voter:v1', JSON.stringify(raw));

    const columns = getColumns('legacy-project');
    expect(columns).toEqual(DEFAULT_COLUMNS);
    expect(columns.some((c) => c.id === 'todo')).toBe(true);
  });

  it('reconstructs automation from column position for pre-existing custom columns with no automation field', () => {
    const raw = {
      version: 1,
      projects: [{ id: 'legacy-custom-project', name: 'Legacy Custom Project', createdAt: '2025-01-01T00:00:00.000Z' }],
      activeProjectId: 'legacy-custom-project',
      voters: [],
      suspectQueues: {},
      columns: {
        'legacy-custom-project': [
          { id: 'a', label: 'Alpha' },
          { id: 'b', label: 'Beta' },
          { id: 'c', label: 'Gamma' },
          { id: 'd', label: 'Delta' },
        ],
      },
    };
    localStorage.setItem('hello-fellow-voter:v1', JSON.stringify(raw));

    const columns = getColumns('legacy-custom-project');
    expect(columns.map((c) => c.automation)).toEqual([
      {
        onOpenMoveTo: 'b',
        doneMoveTo: 'c',
        nextVoterMoveTo: 'b',
        displayNextFrom: 'b',
        pullFrom: 'a',
        pullTo: 'b',
        assignLabelOnEntry: null,
      },
      {
        onOpenMoveTo: null,
        doneMoveTo: 'c',
        nextVoterMoveTo: 'c',
        displayNextFrom: 'b',
        pullFrom: 'a',
        pullTo: 'b',
        assignLabelOnEntry: null,
      },
      {
        onOpenMoveTo: null,
        doneMoveTo: null,
        nextVoterMoveTo: 'd',
        displayNextFrom: null,
        pullFrom: null,
        pullTo: null,
        assignLabelOnEntry: null,
      },
      {
        onOpenMoveTo: null,
        doneMoveTo: null,
        nextVoterMoveTo: null,
        displayNextFrom: null,
        pullFrom: null,
        pullTo: null,
        assignLabelOnEntry: null,
      },
    ]);
  });

  it('backfills assignLabelOnEntry for a column whose automation object predates label support', () => {
    const raw = {
      version: 1,
      projects: [{ id: 'legacy-label-project', name: 'Legacy Label Project', createdAt: '2025-01-01T00:00:00.000Z' }],
      activeProjectId: 'legacy-label-project',
      voters: [],
      suspectQueues: {},
      columns: {
        'legacy-label-project': [
          {
            id: 'a',
            label: 'Alpha',
            automation: {
              onOpenMoveTo: null,
              doneMoveTo: null,
              nextVoterMoveTo: null,
              displayNextFrom: null,
              pullFrom: null,
              pullTo: null,
            },
          },
        ],
      },
    };
    localStorage.setItem('hello-fellow-voter:v1', JSON.stringify(raw));

    const columns = getColumns('legacy-label-project');
    expect(columns[0].automation.assignLabelOnEntry).toBeNull();
  });
});

describe('message migration backfill', () => {
  it('backfills the default message for pre-existing projects with no stored message', () => {
    const raw = {
      version: 1,
      projects: [{ id: 'legacy-project', name: 'Legacy Project', createdAt: '2025-01-01T00:00:00.000Z' }],
      activeProjectId: 'legacy-project',
      voters: [],
      suspectQueues: {},
    };
    localStorage.setItem('hello-fellow-voter:v1', JSON.stringify(raw));

    expect(getProjectMessage('legacy-project')).toBe(DEFAULT_MESSAGE);
  });

  it('leaves an existing custom message untouched', () => {
    const raw = {
      version: 1,
      projects: [
        {
          id: 'legacy-project',
          name: 'Legacy Project',
          createdAt: '2025-01-01T00:00:00.000Z',
          message: 'My own hand-written message',
        },
      ],
      activeProjectId: 'legacy-project',
      voters: [],
      suspectQueues: {},
    };
    localStorage.setItem('hello-fellow-voter:v1', JSON.stringify(raw));

    expect(getProjectMessage('legacy-project')).toBe('My own hand-written message');
  });
});

describe('address view migration backfill', () => {
  it('backfills the default view mode and font size for pre-existing projects with neither stored', () => {
    const raw = {
      version: 1,
      projects: [{ id: 'legacy-project', name: 'Legacy Project', createdAt: '2025-01-01T00:00:00.000Z' }],
      activeProjectId: 'legacy-project',
      voters: [],
      suspectQueues: {},
    };
    localStorage.setItem('hello-fellow-voter:v1', JSON.stringify(raw));

    expect(getProjectAddressViewMode('legacy-project')).toBe(DEFAULT_ADDRESS_VIEW_MODE);
    expect(getProjectAddressViewFontSize('legacy-project')).toBe(DEFAULT_ADDRESS_FONT_SIZE);
  });

  it('leaves an already-set view mode and font size untouched', () => {
    const raw = {
      version: 1,
      projects: [
        {
          id: 'legacy-project',
          name: 'Legacy Project',
          createdAt: '2025-01-01T00:00:00.000Z',
          addressViewMode: 'address-only',
          addressViewFontSize: 7,
        },
      ],
      activeProjectId: 'legacy-project',
      voters: [],
      suspectQueues: {},
    };
    localStorage.setItem('hello-fellow-voter:v1', JSON.stringify(raw));

    expect(getProjectAddressViewMode('legacy-project')).toBe('address-only');
    expect(getProjectAddressViewFontSize('legacy-project')).toBe(7);
  });
});

describe('labels migration backfill', () => {
  it('backfills an empty labels list and empty voter labelIds for pre-existing projects', () => {
    const raw = {
      version: 1,
      projects: [{ id: 'legacy-project', name: 'Legacy Project', createdAt: '2025-01-01T00:00:00.000Z', message: '' }],
      activeProjectId: 'legacy-project',
      voters: [
        {
          id: 'legacy-voter',
          projectId: 'legacy-project',
          name: 'Legacy Voter',
          street: '1 Legacy St',
          city: 'X',
          state: 'NY',
          zip: '10001',
          status: 'todo',
          order: 0,
          createdAt: '2025-01-01T00:00:00.000Z',
        },
      ],
      suspectQueues: {},
    };
    localStorage.setItem('hello-fellow-voter:v1', JSON.stringify(raw));

    expect(getLabels('legacy-project')).toEqual([]);
    expect(getVotersForProject('legacy-project')[0].labelIds).toEqual([]);
  });
});

describe('import number migration backfill', () => {
  it('assigns sequential import numbers, in array order, to pre-existing voters that have none', () => {
    const raw = {
      version: 1,
      projects: [{ id: 'legacy-project', name: 'Legacy Project', createdAt: '2025-01-01T00:00:00.000Z' }],
      activeProjectId: 'legacy-project',
      voters: [
        {
          id: 'legacy-voter-1',
          projectId: 'legacy-project',
          name: 'First Voter',
          street: '1 Legacy St',
          city: 'X',
          state: 'NY',
          zip: '10001',
          status: 'todo',
          order: 0,
          createdAt: '2025-01-01T00:00:00.000Z',
          labelIds: [],
        },
        {
          id: 'legacy-voter-2',
          projectId: 'legacy-project',
          name: 'Second Voter',
          street: '2 Legacy St',
          city: 'X',
          state: 'NY',
          zip: '10002',
          status: 'todo',
          order: 1,
          createdAt: '2025-01-01T00:00:00.000Z',
          labelIds: [],
        },
      ],
      suspectQueues: {},
    };
    localStorage.setItem('hello-fellow-voter:v1', JSON.stringify(raw));

    const voters = getVotersForProject('legacy-project');
    expect(voters.map((v) => v.importNumber)).toEqual([1, 2]);
  });

  it('seeds the backfill counter from any already-numbered voters, so a partially-numbered project never duplicates a number', () => {
    const raw = {
      version: 1,
      projects: [{ id: 'legacy-project', name: 'Legacy Project', createdAt: '2025-01-01T00:00:00.000Z' }],
      activeProjectId: 'legacy-project',
      voters: [
        {
          id: 'legacy-voter-1',
          projectId: 'legacy-project',
          name: 'First Voter',
          street: '1 Legacy St',
          city: 'X',
          state: 'NY',
          zip: '10001',
          status: 'todo',
          order: 0,
          importNumber: 5,
          createdAt: '2025-01-01T00:00:00.000Z',
          labelIds: [],
        },
        {
          id: 'legacy-voter-2',
          projectId: 'legacy-project',
          name: 'Second Voter',
          street: '2 Legacy St',
          city: 'X',
          state: 'NY',
          zip: '10002',
          status: 'todo',
          order: 1,
          createdAt: '2025-01-01T00:00:00.000Z',
          labelIds: [],
        },
      ],
      suspectQueues: {},
    };
    localStorage.setItem('hello-fellow-voter:v1', JSON.stringify(raw));

    const voters = getVotersForProject('legacy-project');
    expect(voters.map((v) => v.importNumber)).toEqual([5, 6]);
  });
});

describe('labels CRUD', () => {
  it('creates, lists, and rejects a duplicate (case-insensitive) label name', () => {
    const project = mustCreateProject('Labels Project');
    const label = createLabel(project.id, 'Batch 1', '#ff0000');
    expect(label).not.toBeNull();
    expect(getLabels(project.id)).toEqual([label]);
    expect(createLabel(project.id, '  batch 1  ', '#00ff00')).toBeNull();
  });

  it('updates a label name and color, rejecting a name collision with another label', () => {
    const project = mustCreateProject('Update Label Project');
    const a = createLabel(project.id, 'Batch 1', '#ff0000')!;
    const b = createLabel(project.id, 'Batch 2', '#00ff00')!;
    expect(updateLabel(project.id, a.id, 'Batch One', '#0000ff')).toBe(true);
    expect(getLabels(project.id).find((l) => l.id === a.id)).toEqual({ id: a.id, name: 'Batch One', color: '#0000ff' });
    expect(updateLabel(project.id, a.id, 'Batch 2', '#0000ff')).toBe(false);
    expect(b).toBeTruthy();
  });

  it('deletes a label, stripping it from voters and nulling any automation pointing at it', () => {
    const project = mustCreateProject('Delete Label Project');
    const label = createLabel(project.id, 'Batch 1', '#ff0000')!;
    const voter = addVoter(project.id, { name: 'V', street: 'S', city: 'C', state: 'ST', zip: '00000' });
    toggleVoterLabel(voter.id, label.id);
    const [firstColumn] = getColumns(project.id);
    setColumnAutomation(project.id, firstColumn.id, { ...firstColumn.automation, assignLabelOnEntry: label.id });

    deleteLabel(project.id, label.id);

    expect(getLabels(project.id)).toEqual([]);
    expect(getVotersForProject(project.id)[0].labelIds).toEqual([]);
    expect(getColumns(project.id).find((c) => c.id === firstColumn.id)?.automation.assignLabelOnEntry).toBeNull();
  });

  it('cleans up a project labels when the project is deleted', () => {
    const project = mustCreateProject('Delete Project Labels Project');
    createLabel(project.id, 'Batch 1', '#ff0000');
    deleteProject(project.id);
    expect(getLabels(project.id)).toEqual([]);
  });
});

describe('voter label assignment', () => {
  it('toggles a single label on and off', () => {
    const project = mustCreateProject('Toggle Label Project');
    const label = createLabel(project.id, 'Batch 1', '#ff0000')!;
    const voter = addVoter(project.id, { name: 'V', street: 'S', city: 'C', state: 'ST', zip: '00000' });

    toggleVoterLabel(voter.id, label.id);
    expect(getVotersForProject(project.id)[0].labelIds).toEqual([label.id]);

    toggleVoterLabel(voter.id, label.id);
    expect(getVotersForProject(project.id)[0].labelIds).toEqual([]);
  });

  it('adds a label to multiple voters idempotently, leaving other voters untouched', () => {
    const project = mustCreateProject('Batch Add Label Project');
    const label = createLabel(project.id, 'Batch 1', '#ff0000')!;
    const v1 = addVoter(project.id, { name: 'V1', street: 'S', city: 'C', state: 'ST', zip: '00000' });
    const v2 = addVoter(project.id, { name: 'V2', street: 'S', city: 'C', state: 'ST', zip: '00000' });
    const v3 = addVoter(project.id, { name: 'V3', street: 'S', city: 'C', state: 'ST', zip: '00000' });
    toggleVoterLabel(v1.id, label.id);

    addLabelToVoters([v1.id, v2.id], label.id);

    const voters = getVotersForProject(project.id);
    expect(voters.find((v) => v.id === v1.id)?.labelIds).toEqual([label.id]);
    expect(voters.find((v) => v.id === v2.id)?.labelIds).toEqual([label.id]);
    expect(voters.find((v) => v.id === v3.id)?.labelIds).toEqual([]);
  });

  it('removes a label from multiple voters, leaving other voters untouched', () => {
    const project = mustCreateProject('Batch Remove Label Project');
    const label = createLabel(project.id, 'Batch 1', '#ff0000')!;
    const v1 = addVoter(project.id, { name: 'V1', street: 'S', city: 'C', state: 'ST', zip: '00000' });
    const v2 = addVoter(project.id, { name: 'V2', street: 'S', city: 'C', state: 'ST', zip: '00000' });
    addLabelToVoters([v1.id, v2.id], label.id);

    removeLabelFromVoters([v1.id], label.id);

    const voters = getVotersForProject(project.id);
    expect(voters.find((v) => v.id === v1.id)?.labelIds).toEqual([]);
    expect(voters.find((v) => v.id === v2.id)?.labelIds).toEqual([label.id]);
  });
});

describe('column automation: assign label on entry', () => {
  it('assigns a label when a voter moves into a column via moveVoter, without duplicating on repeat entry', () => {
    const project = mustCreateProject('Auto Label Move Project');
    const label = createLabel(project.id, 'Mailed Batch 1', '#ff0000')!;
    const [first, second] = getColumns(project.id);
    setColumnAutomation(project.id, second.id, { ...second.automation, assignLabelOnEntry: label.id });
    const voter = addVoter(project.id, { name: 'V', street: 'S', city: 'C', state: 'ST', zip: '00000' });

    moveVoter(voter.id, second.id, null);
    expect(getVotersForProject(project.id)[0].labelIds).toEqual([label.id]);

    moveVoter(voter.id, first.id, null);
    moveVoter(voter.id, second.id, null);
    expect(getVotersForProject(project.id)[0].labelIds).toEqual([label.id]);
  });

  it('assigns a label to a batch of voters moved via moveVoters', () => {
    const project = mustCreateProject('Auto Label Batch Move Project');
    const label = createLabel(project.id, 'Mailed Batch 1', '#ff0000')!;
    const [, second] = getColumns(project.id);
    setColumnAutomation(project.id, second.id, { ...second.automation, assignLabelOnEntry: label.id });
    const v1 = addVoter(project.id, { name: 'V1', street: 'S', city: 'C', state: 'ST', zip: '00000' });
    const v2 = addVoter(project.id, { name: 'V2', street: 'S', city: 'C', state: 'ST', zip: '00000' });

    moveVoters([v1.id, v2.id], second.id);

    const voters = getVotersForProject(project.id);
    expect(voters.find((v) => v.id === v1.id)?.labelIds).toEqual([label.id]);
    expect(voters.find((v) => v.id === v2.id)?.labelIds).toEqual([label.id]);
  });

  it('never removes a label a voter already has when moving into a column with no automation', () => {
    const project = mustCreateProject('No Automation Keeps Label Project');
    const label = createLabel(project.id, 'Manual Label', '#ff0000')!;
    const [first, second] = getColumns(project.id);
    const voter = addVoter(project.id, { name: 'V', street: 'S', city: 'C', state: 'ST', zip: '00000' });
    toggleVoterLabel(voter.id, label.id);

    moveVoter(voter.id, second.id, null);

    expect(getVotersForProject(project.id)[0].labelIds).toEqual([label.id]);
    expect(first).toBeTruthy();
  });

  it('silently no-ops if the automation points at a label that was since deleted', () => {
    const project = mustCreateProject('Deleted Label Automation Project');
    const label = createLabel(project.id, 'Gone Soon', '#ff0000')!;
    const [, second] = getColumns(project.id);
    setColumnAutomation(project.id, second.id, { ...second.automation, assignLabelOnEntry: label.id });
    deleteLabel(project.id, label.id);
    const voter = addVoter(project.id, { name: 'V', street: 'S', city: 'C', state: 'ST', zip: '00000' });

    expect(() => moveVoter(voter.id, second.id, null)).not.toThrow();
    expect(getVotersForProject(project.id)[0].labelIds).toEqual([]);
  });
});
