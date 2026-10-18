import { addVoters, dedupeKey, getColumns, getVotersForProject, moveVoter, startingImportNumber } from '../storage';
import type { Column, Voter } from '../types';
import { extractVoterText } from './extractRecordBlocks';
import { parseHfvExportLines } from './parseHfvExport';
import { looksLikeDataBlock, looksLikeSuspectedAddress, parseVoterBlock, type ParsedRecord } from './parseVoterLine';

/** A plain `ParsedRecord` from the heuristic parser has no status; an `HfvExportRecord`
 * from our own export format carries the column label it was exported with. */
type ImportableRecord = ParsedRecord & { status?: string };

export interface ImportResult {
  importedCount: number;
  duplicateCount: number;
  /** Duplicates whose status was updated to match an HFV export's status column (0 for every non-HFV import). */
  statusUpdatedCount: number;
  skippedCount: number;
  suspectedLines: string[];
  /** Ids of the newly created voters, so a caller can offer to label them right after import. */
  importedVoterIds: string[];
}

function findColumnByLabel(columns: Column[], label: string | undefined): Column | undefined {
  const normalized = label?.trim().toLowerCase();
  if (!normalized) return undefined;
  return columns.find((c) => c.label.trim().toLowerCase() === normalized);
}

/** Dedupes and persists already-parsed records; skippedCount/suspectedLines just pass through for the caller's report. */
export function importRecords(
  projectId: string,
  records: ImportableRecord[],
  skippedCount = 0,
  suspectedLines: string[] = [],
): ImportResult {
  const existingVoters = getVotersForProject(projectId);
  const existingByKey = new Map<string, Voter>();
  for (const voter of existingVoters) {
    existingByKey.set(dedupeKey(projectId, voter.name, voter.street, voter.city, voter.state, voter.zip), voter);
  }

  const columns = getColumns(projectId);
  const firstColumnId = columns[0]?.id ?? '';

  // Lazily tracks the next `order` slot per column, seeded from existing voters and
  // bumped by every voter (new or re-statused) that lands in that column during this
  // import, so a column touched twice in one batch never hands out the same order twice.
  const nextOrderByColumn = new Map<string, number>();
  function reserveOrder(columnId: string): number {
    const current =
      nextOrderByColumn.get(columnId) ??
      existingVoters.filter((v) => v.status === columnId).reduce((max, v) => Math.max(max, v.order), -1) + 1;
    nextOrderByColumn.set(columnId, current + 1);
    return current;
  }

  const newVoters: Voter[] = [];
  let imported = 0;
  let duplicates = 0;
  let statusUpdated = 0;
  let nextImportNumber = startingImportNumber(existingVoters, projectId);

  for (const record of records) {
    const key = dedupeKey(projectId, record.name, record.street, record.city, record.state, record.zip);
    const existing = existingByKey.get(key);

    if (existing) {
      duplicates++;
      const matchedColumn = findColumnByLabel(columns, record.status);
      if (matchedColumn && existing.status !== matchedColumn.id) {
        reserveOrder(matchedColumn.id);
        moveVoter(existing.id, matchedColumn.id, null);
        existing.status = matchedColumn.id;
        statusUpdated++;
      }
      continue;
    }

    const matchedColumn = findColumnByLabel(columns, record.status);
    const status = matchedColumn?.id ?? firstColumnId;

    const voter: Voter = {
      id: crypto.randomUUID(),
      projectId,
      name: record.name,
      street: record.street,
      city: record.city,
      state: record.state,
      zip: record.zip,
      status,
      order: reserveOrder(status),
      importNumber: nextImportNumber++,
      createdAt: new Date().toISOString(),
      labelIds: [],
    };
    existingByKey.set(key, voter);
    newVoters.push(voter);
    imported++;
  }

  addVoters(newVoters);

  return {
    importedCount: imported,
    duplicateCount: duplicates,
    statusUpdatedCount: statusUpdated,
    skippedCount,
    suspectedLines,
    importedVoterIds: newVoters.map((v) => v.id),
  };
}

export async function importPdf(projectId: string, file: File): Promise<ImportResult> {
  const buf = await file.arrayBuffer();
  const { allLines, blocks, discardedLines } = await extractVoterText(buf);

  const hfvRecords = parseHfvExportLines(allLines);
  if (hfvRecords.length > 0) {
    return importRecords(projectId, hfvRecords);
  }

  const records: ParsedRecord[] = [];
  const suspectedLines: string[] = [];
  let skipped = 0;

  for (const block of blocks) {
    if (!looksLikeDataBlock(block)) {
      const text = block.join(' ');
      if (looksLikeSuspectedAddress(text)) suspectedLines.push(text);
      continue; // header/footer/front-matter — not a failure
    }

    const record = parseVoterBlock(block);
    if (!record) {
      skipped++;
      continue;
    }
    records.push(record);
  }

  for (const line of discardedLines) {
    if (looksLikeSuspectedAddress(line)) suspectedLines.push(line);
  }

  return importRecords(projectId, records, skipped, suspectedLines);
}
