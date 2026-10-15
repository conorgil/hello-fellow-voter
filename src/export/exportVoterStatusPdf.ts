import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FIELD_SEPARATOR, HFV_MARKER } from '../pdf/parseHfvExport';
import { getColumns } from '../storage';
import type { Project, Voter } from '../types';
import { buildExportRows, summarizeByStatus } from './buildExportRows';

const PAGE_MARGIN = 40;
const SITE_URL = 'https://hellofellowvoter.com';
const LINK_COLOR: [number, number, number] = [37, 99, 235];
/**
 * Vertical offset (pt) of the invisible per-row marker above its row's visible text —
 * just enough to land on its own baseline so `groupItemsIntoLines` (2pt Y tolerance)
 * never merges it with the visible row, while staying inside this row's own band.
 */
const HFV_MARKER_Y_OFFSET = 3;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'project';
}

/** Local-time YYYY-MM-DD, to match the "Generated on" date shown in the PDF body. */
function localDateStamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Builds the voter status report PDF. Split out from `exportVoterStatusPdf` so the
 * generated document's bytes can be inspected/tested (e.g. round-tripped back through
 * the importer) without triggering a browser download.
 *
 * Alongside the visible table, each row also gets an invisible HFV-EXPORT-V1 record
 * (see docs/pdf-import-format.md) so this exact PDF can be deterministically
 * re-imported later — e.g. by a team leader collecting status reports back from
 * volunteers — instead of relying on parsing the visible table's layout, which
 * `jspdf-autotable` can wrap across multiple lines for long cell contents.
 */
export function buildVoterStatusPdfDoc(project: Project, voters: Voter[]): jsPDF {
  const columns = getColumns(project.id);
  const now = new Date();
  const doc = new jsPDF({ unit: 'pt', compress: true });
  doc.setProperties({ keywords: 'hello-fellow-voter-export; format=voter-status; version=1' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const textWidth = pageWidth - PAGE_MARGIN * 2;

  doc.setFontSize(16);
  doc.text(`${project.name} — Voter Contact Status`, PAGE_MARGIN, PAGE_MARGIN);

  doc.setFontSize(10);

  const attributionY = PAGE_MARGIN + 24;
  const attributionPrefix = 'This document was generated with ';
  const linkText = 'HelloFellowVoter.com';

  doc.setTextColor(0, 0, 0);
  doc.text(attributionPrefix, PAGE_MARGIN, attributionY);
  const linkX = PAGE_MARGIN + doc.getTextWidth(attributionPrefix);
  const linkWidth = doc.getTextWidth(linkText);

  doc.setTextColor(...LINK_COLOR);
  doc.textWithLink(linkText, linkX, attributionY, { url: SITE_URL });
  doc.setDrawColor(...LINK_COLOR);
  doc.setLineWidth(0.5);
  doc.line(linkX, attributionY + 1.5, linkX + linkWidth, attributionY + 1.5);

  doc.setTextColor(0, 0, 0);
  doc.text('.', linkX + linkWidth, attributionY);

  const explanation = doc.splitTextToSize(
    `It lists the voters in the "${project.name}" list along with their current contact status, ` +
      `so the organization that provided this list can see which voters were actually contacted.`,
    textWidth,
  );
  doc.text(explanation, PAGE_MARGIN, attributionY + 16);
  const introBottom = attributionY + 16 + explanation.length * 12;

  const generatedOn = `Generated on ${now.toLocaleDateString()}`;
  doc.text(generatedOn, PAGE_MARGIN, introBottom + 16);
  doc.text(summarizeByStatus(voters, columns), PAGE_MARGIN, introBottom + 32);

  const exportRows = buildExportRows(voters, columns);

  autoTable(doc, {
    startY: introBottom + 48,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    head: [['Name', 'Street', 'City', 'State', 'ZIP', 'Status']],
    body: exportRows.map((row) => [row.name, row.street, row.city, row.state, row.zip, row.status]),
    didDrawCell: (data) => {
      if (data.section !== 'body' || data.column.index !== data.table.columns.length - 1) return;
      const row = exportRows[data.row.index];
      const payload = [HFV_MARKER, row.name, row.street, row.city, row.state, row.zip, row.status].join(
        FIELD_SEPARATOR,
      );
      // Kept within the page's bounds (unlike a position past the right margin) —
      // pdf.js's text extraction silently drops glyphs positioned outside the page.
      doc.text(payload, PAGE_MARGIN, data.cell.y + data.cell.height / 2 - HFV_MARKER_Y_OFFSET, {
        renderingMode: 'invisible',
      });
    },
  });

  return doc;
}

export function exportVoterStatusPdf(project: Project, voters: Voter[]): void {
  const doc = buildVoterStatusPdfDoc(project, voters);
  doc.save(`${slugify(project.name)}-voter-status-${localDateStamp(new Date())}.pdf`);
}
