import type { ParsedRecord } from './parseVoterLine';

/**
 * Marker for the app's own versioned, invisible per-voter data channel embedded in
 * `exportVoterStatusPdf.ts` exports — lets re-importing one of our own export PDFs be
 * deterministic instead of relying on text-shape heuristics against the visible table
 * (which can wrap long cells across multiple lines). See docs/pdf-import-format.md.
 */
export const HFV_MARKER = 'HFV-EXPORT-V1';

/**
 * Field delimiter. A C0 control character (e.g. the ASCII Unit Separator) would be
 * ideal in principle — never appears in real text, and isn't whitespace, so
 * `groupItemsIntoLines`'s `\s+` collapsing in extractLines.ts couldn't touch it — but
 * standard PDF fonts have no glyph for codes below 0x20, and pdf.js's text extraction
 * silently substitutes a plain space for them. A plain pipe survives the full
 * jsPDF-write / pdf.js-read round trip unchanged (verified empirically) and, while
 * technically printable, essentially never appears in a real name, address, or status.
 */
export const FIELD_SEPARATOR = '|';

const MARKER_PREFIX = `${HFV_MARKER}${FIELD_SEPARATOR}`;

export interface HfvExportRecord extends ParsedRecord {
  /** Column label as exported (e.g. "Mailed"), or '' if the voter had none. */
  status: string;
}

function parseHfvExportLine(line: string): HfvExportRecord | null {
  const markerIndex = line.indexOf(MARKER_PREFIX);
  if (markerIndex === -1) return null;

  const payload = line.slice(markerIndex + MARKER_PREFIX.length);
  const fields = payload.split(FIELD_SEPARATOR);
  if (fields.length !== 6) return null;

  const [name, street, city, state, zip, status] = fields;
  if (!name || !street || !city || !state || !zip) return null;

  return { name, street, city, state, zip, status };
}

/**
 * Scans extracted PDF lines for the HFV-EXPORT-V1 marker and decodes any it finds.
 * Lines without the marker (the visible table's own text) are ignored here — the
 * caller falls back to the ordinary heuristic parser when this returns no records.
 */
export function parseHfvExportLines(lines: string[]): HfvExportRecord[] {
  const records: HfvExportRecord[] = [];
  for (const line of lines) {
    const record = parseHfvExportLine(line);
    if (record) records.push(record);
  }
  return records;
}
