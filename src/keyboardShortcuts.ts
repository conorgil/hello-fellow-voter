export function isUndoShortcut(e: KeyboardEvent): boolean {
  const hasModifier = e.metaKey || e.ctrlKey;
  return hasModifier && !e.shiftKey && e.key.toLowerCase() === 'z';
}

export function isRedoShortcut(e: KeyboardEvent): boolean {
  const hasModifier = e.metaKey || e.ctrlKey;
  const key = e.key.toLowerCase();
  return (hasModifier && e.shiftKey && key === 'z') || (e.ctrlKey && key === 'y');
}
