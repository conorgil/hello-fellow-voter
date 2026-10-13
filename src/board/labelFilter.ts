let activeLabelFilters = new Set<string>();

export function isLabelFilterActive(id: string): boolean {
  return activeLabelFilters.has(id);
}

export function getActiveLabelFilters(): string[] {
  return [...activeLabelFilters];
}

export function toggleLabelFilter(id: string): void {
  if (activeLabelFilters.has(id)) {
    activeLabelFilters.delete(id);
  } else {
    activeLabelFilters.add(id);
  }
}

export function clearLabelFilter(): void {
  activeLabelFilters.clear();
}

/** Drops any active filter ids no longer present in the given label list, e.g. after a label is deleted. */
export function pruneLabelFilters(validLabelIds: string[]): void {
  const validSet = new Set(validLabelIds);
  for (const id of activeLabelFilters) {
    if (!validSet.has(id)) activeLabelFilters.delete(id);
  }
}
