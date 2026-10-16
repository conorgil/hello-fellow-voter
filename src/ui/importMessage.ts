import type { PdfImportProgress } from '../pdf/extractLines';
import type { ImportResult } from '../pdf/importPdf';

export function formatImportProgressMessage(progress: PdfImportProgress): string {
  if (progress.phase === 'ocr-setup') return 'Preparing OCR engine for scanned pages…';
  if (progress.phase === 'ocr') {
    const percent = Math.round((progress.ocrProgress ?? 0) * 100);
    return `Scanning page ${progress.page} of ${progress.totalPages} (${percent}%)…`;
  }
  return `Reading page ${progress.page} of ${progress.totalPages}…`;
}

export function formatImportMessage(result: ImportResult): string {
  const parts = [`Imported ${result.importedCount} new voter${result.importedCount === 1 ? '' : 's'}.`];
  if (result.duplicateCount > 0) {
    parts.push(`${result.duplicateCount} duplicate${result.duplicateCount === 1 ? '' : 's'} skipped.`);
  }
  if (result.statusUpdatedCount > 0) {
    parts.push(
      `Updated status for ${result.statusUpdatedCount} already-imported voter${result.statusUpdatedCount === 1 ? '' : 's'}.`,
    );
  }
  if (result.skippedCount > 0) {
    parts.push(
      `${result.skippedCount} line${result.skippedCount === 1 ? '' : 's'} couldn't be parsed and ${
        result.skippedCount === 1 ? 'was' : 'were'
      } skipped.`,
    );
  }
  if (result.suspectedLines.length > 0) {
    parts.push(
      `${result.suspectedLines.length} line${result.suspectedLines.length === 1 ? '' : 's'} might be ${
        result.suspectedLines.length === 1 ? 'an address' : 'addresses'
      } — review ${result.suspectedLines.length === 1 ? 'it' : 'them'} now.`,
    );
  }
  return parts.join(' ');
}
