export type ColumnId = string;

/** Sentinel for `doneMoveTo`: show the Done button, but don't move the current voter. */
export const DONE_STAY = '__stay__';

export interface ColumnAutomation {
  /** Column to move the voter to when their postcard is opened. Null = don't move the voter. */
  onOpenMoveTo: string | null;
  /**
   * Column to move the voter to when "Done" is clicked (which also closes the postcard).
   * Null = no Done button. `DONE_STAY` = show the button but leave the voter in place.
   */
  doneMoveTo: string | null;
  /** Column to move the current voter to when "Next voter" is clicked. Null = Next voter button disabled. */
  nextVoterMoveTo: string | null;
  /**
   * Column to look in for the next voter to automatically open when "Next voter" is
   * clicked — no voter is moved by this step. Null = don't auto-open anyone.
   */
  displayNextFrom: string | null;
  /** Column to move a voter from, paired with pullTo. Null = skip this step. */
  pullFrom: string | null;
  /** Column to move that voter into. */
  pullTo: string | null;
}

export interface Column {
  id: string;
  label: string;
  automation: ColumnAutomation;
}

export const DEFAULT_COLUMNS: Column[] = [
  {
    id: 'todo',
    label: 'TODO',
    automation: {
      onOpenMoveTo: 'writing',
      doneMoveTo: DONE_STAY,
      nextVoterMoveTo: 'written',
      displayNextFrom: 'writing',
      pullFrom: 'todo',
      pullTo: 'writing',
    },
  },
  {
    id: 'writing',
    label: 'Writing',
    automation: {
      onOpenMoveTo: null,
      doneMoveTo: 'written',
      nextVoterMoveTo: 'written',
      displayNextFrom: 'writing',
      pullFrom: 'todo',
      pullTo: 'writing',
    },
  },
  {
    id: 'written',
    label: 'Written',
    automation: {
      onOpenMoveTo: null,
      doneMoveTo: 'stamped',
      nextVoterMoveTo: 'stamped',
      displayNextFrom: 'written',
      pullFrom: null,
      pullTo: null,
    },
  },
  {
    id: 'stamped',
    label: 'Stamp Applied',
    automation: {
      onOpenMoveTo: null,
      doneMoveTo: null,
      nextVoterMoveTo: 'mailed',
      displayNextFrom: 'stamped',
      pullFrom: null,
      pullTo: null,
    },
  },
  {
    id: 'mailed',
    label: 'Mailed',
    automation: {
      onOpenMoveTo: null,
      doneMoveTo: null,
      nextVoterMoveTo: null,
      displayNextFrom: null,
      pullFrom: null,
      pullTo: null,
    },
  },
];

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  message: string;
}

export interface Voter {
  id: string;
  projectId: string;
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  status: ColumnId;
  order: number;
  createdAt: string;
}

export interface StoredState {
  version: 1;
  projects: Project[];
  activeProjectId: string | null;
  voters: Voter[];
  /** Lines from a PDF/paste import that might be addresses but couldn't be parsed automatically, awaiting manual review. */
  suspectQueues: Record<string, string[]>;
  columns: Record<string, Column[]>;
}
