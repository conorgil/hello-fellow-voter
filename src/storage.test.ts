import { describe, expect, it } from 'vitest';
import { dedupeKey, normalize } from './storage';

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
