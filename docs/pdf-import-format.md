# Hello Fellow Voter — Embedded Voter Record format (HFV-EXPORT-V1)

## Why this exists

Hello Fellow Voter imports voter-list PDFs by guessing at their structure: splitting lines on commas, looking for a `City, ST ZIP` tail, and so on (see `src/pdf/parseVoterLine.ts`). That works for the handful of export conventions we've seen, but it's inherently fragile — a layout tweak, a wrapped line, or a new organization's format can silently drop voters or garble names.

If you generate PDFs that get handed to volunteers using this app (or any pdf.js-based importer that adopts the same convention), you can sidestep all of that by embedding one machine-readable record per voter directly in the PDF, alongside whatever human-readable layout you want. This is **additive** — it doesn't change how your PDF looks or prints. Hello Fellow Voter's importer checks for this format first and only falls back to text-shape guessing if it isn't present.

## The wire format

For each voter, embed one text string in the PDF containing:

```
HFV-EXPORT-V1|name|street|city|state|zip|status
```

- `|` (a plain pipe character) is the field delimiter.
- `HFV-EXPORT-V1` is a literal marker string identifying both the format and its version. It must appear immediately before the first `|`.
- Fields, in order: `name`, `street`, `city`, `state` (2-letter, e.g. `PA`), `zip` (5 or 9 digit, e.g. `19104` or `19104-1234`), `status` (free text; see below).
- Exactly 6 fields are required after the marker (6 segments produced by splitting the whole string on `|`, including the leading `HFV-EXPORT-V1` segment — i.e. 7 pipe-separated segments total). A record with more or fewer fields is invalid and will be ignored.
- `status` may be an **empty string** if your organization doesn't track per-voter status — the importer treats an empty/unmatched status as "use the destination project's default column."
- No escaping is needed or supported for any field: pick field content that doesn't itself contain a literal `|` (see below for why this is a safe assumption for voter name/address data).

### Why a pipe, and not a non-printable separator?

An obvious instinct is to use a C0 control character (like the ASCII Unit Separator, `U+001F`) as the delimiter, since it can't appear in real text and isn't whitespace. **Don't do this — it doesn't survive a real PDF round trip.** We tried it first and verified empirically that it fails: standard PDF fonts (Helvetica, Times, etc.) have no glyph defined for character codes below `0x20`, and `pdfjs-dist`'s text extraction silently substitutes a plain space for any such code when decoding a simple font's glyphs back to text — even though the exact control-character byte is genuinely present in the PDF's content stream as written. The corruption happens on **read**, not on write, which makes it an easy mistake to ship undetected unless you actually extract the text back out and check.

A plain, printable, uncommon character — this format uses `|` — survives the full write/read round trip unchanged (verified against `pdfjs-dist`), and in practice never appears in a US postal name, street, city, or status label. Because this app's text extraction (`groupItemsIntoLines` in `src/pdf/extractLines.ts`) only collapses *whitespace* runs (`\s+`) when reconstructing lines, a non-whitespace delimiter like `|` also survives that normalization step untouched.

## How to embed it in the PDF

This string needs to end up as part of the PDF's extractable text layer — i.e. something a tool like `pdfjs-dist`'s `getTextContent()` will return — not baked into an image. Concretely:

1. **Write it as a single, unbroken text-show operation.** Most PDF libraries (jsPDF, PDFKit, ReportLab, etc.) have a basic "draw this string at (x, y)" call — use that for the whole marker+payload string in one call, rather than splitting it across several positioned runs.
2. **Keep it fully within the page's bounds.** This one is easy to get wrong if your instinct (like ours) is to tuck the marker "out of the way" past the printed margin, e.g. at `x = pageWidth + 10`. Don't — `pdfjs-dist` clips text content to the page's MediaBox, and a glyph positioned even slightly outside it is dropped from `getTextContent()` entirely (we verified this: text starting just before the page edge gets truncated mid-string; text starting fully past the edge is silently dropped in its entirety). Keep the marker's entire run — start x through start x + rendered width — inside `[0, pageWidth]`. The safest choice is to left-align it at your normal content margin, the same x you use for ordinary visible text.
3. **Give it a baseline Y position that no other text on the page shares** (within ~2pt). PDF text extraction tools reconstruct "lines" by grouping text runs that share a baseline, then ordering by X — if your marker string's Y collides with unrelated text, the two can get merged or interleaved into one garbled line. A reliable approach: for a marker associated with a given visible row, offset its Y by a few points from that row's own text baseline (enough to clear your extractor's baseline-grouping tolerance, small enough to stay within that row's vertical band and not collide with an adjacent row) — this gives the marker its own dedicated line, immediately adjacent to that voter's visible row in extraction order, without the complexity of forcing it to literally merge into the visible row's line.
4. **Visibility is your choice.** Hello Fellow Voter renders its own marker text as invisible (PDF text-rendering mode 3 — in jsPDF, `doc.text(str, x, y, { renderingMode: 'invisible' })`; in raw PDF, the `3 Tr` operator) so it doesn't affect the visible page at all. You can do the same, or simply place it somewhere inconspicuous if your library doesn't support invisible text — either way, pdf.js's `getTextContent()` returns it regardless of visibility (rendering mode does not affect text-content extraction, only on-screen/printed appearance).
5. **One record per voter, anywhere in the document.** Records don't need to be in any particular order, on any particular page, or adjacent to that voter's visible listing (if you have one) — the importer scans every page's extracted text for the marker.
6. **(Optional, recommended) Tag the document itself.** Set the PDF's Keywords metadata to something identifying your export, e.g. `keywords: 'hello-fellow-voter-export; format=voter-status; version=1'`. Not required for import to work, but it's a free, cheap way for humans (and future tooling) to identify a file's origin without opening it.

## Example

For a voter named `Darrel Taylor` at `526 N Budd St # B`, `Philadelphia, PA 19104`, with status `Mailed`:

```
HFV-EXPORT-V1|Darrel Taylor|526 N Budd St # B|Philadelphia|PA|19104|Mailed
```

jsPDF example, embedding one marker per table row just above that row's own baseline:

```ts
doc.text(
  ['HFV-EXPORT-V1', name, street, city, state, zip, status].join('|'),
  marginLeft,                 // same left margin as your visible content — stays on-page
  rowBaselineY - 3,           // a few points off the visible row's own baseline
  { renderingMode: 'invisible' },
);
```

## Versioning

If a future format needs different or additional fields, it will use a new marker (`HFV-EXPORT-V2`, etc.) rather than changing the meaning of `HFV-EXPORT-V1` — so files already in the wild, and tools already generating `V1`, keep working indefinitely. Importers should treat an unrecognized version marker as "not this format" and fall back to their own heuristics, the same way they'd treat a PDF with no marker at all.

## Scanned / image-based PDFs (OCR)

Everything above assumes the PDF has a real, extractable text layer. Some voter lists are just scans or photos of a printed sheet — `getTextContent()` returns nothing for those pages. `src/pdf/ocr.ts` detects this per page (not per document, so a PDF can mix scanned and text-layer pages) and falls back to running OCR with `tesseract.js` entirely in the browser.

A few things that are easy to get wrong if you touch this code:

- **Detection threshold.** `pageNeedsOcr()` (`OCR_TEXT_LAYER_THRESHOLD`, currently 10 non-whitespace characters) is intentionally low — a page number or other stray fragment in the text layer shouldn't be enough to suppress OCR on an otherwise fully-scanned page.
- **Render DPI tradeoff.** Pages are rasterized at `OCR_RENDER_SCALE` (currently 2.5, ≈180 DPI) before OCR. Higher is more accurate but slower and more memory-hungry; this value was chosen for typical printed/typed address lists and may need to go up (toward 3.5–4) for small or low-contrast source scans.
- **The `workerBlobURL: false` / flat-vendor-directory requirement.** tesseract.js's worker resolves the WASM core's location relative to the worker script's own `self.location`. The default (`workerBlobURL: true`) wraps the worker in a blob URL, which makes that lookup meaningless. We set `workerBlobURL: false` and keep the worker script, WASM core, and local language data all in one flat directory (`public/vendor/tesseract/`) so the relative lookup actually resolves.
- **CDN-first, local-fallback language data.** `getOcrWorker()` tries tesseract.js's own default CDN-hosted English model first (a short timeout, `OCR_LANG_CDN_TIMEOUT_MS`), and falls back to the smaller model bundled in `public/vendor/tesseract/eng.traineddata.gz` if the CDN is unreachable or slow. This keeps the common case accurate while still working fully offline.
- **OCR misreads and the suspects-review queue.** OCR can corrupt exactly the characters the address heuristics key off (a ZIP digit, a state letter, `0`/`O`, `l`/`1`) in a way pdf.js's exact text-layer extraction essentially never does. To avoid silently losing a voter to one bad character, every extracted line carries its provenance (`sourcedFromOcr`), and `importPdf.ts` routes *every* non-blank, unparseable OCR-sourced line into the suspects-review queue — not just the ones that already look loosely address-shaped. Expect a real scanned file to produce more review-queue entries than a text-layer PDF would.
- **Caps.** `MAX_PDF_FILE_SIZE_BYTES` and `MAX_OCR_PAGES` bound worst-case memory/time on a pathological file; both throw a dedicated error (`PdfTooLargeError`, `OcrPageLimitExceededError`) that `pdfImportForm.ts` shows as a specific toast rather than the generic "could not read this PDF" message.
- **Ruled-table layouts (gridded canvassing worksheets).** A scanned worksheet laid out as a bordered grid (separate Name/Street/City/State/Zip columns, ruling lines, a checkbox column) defeats a single whole-page OCR pass — Tesseract's own layout analysis gets confused by the vertical gridlines and narrow columns, and garbles exactly the State/Zip cells the address parser needs most. `detectHorizontalGridlines()` finds the table's horizontal ruling lines by scanning for image rows that are mostly dark across their full width (`GRIDLINE_ROW_DARK_RATIO`, currently 0.25 — tuned against a real scanned sheet, where genuine ruling lines measured anywhere from ~0.3 to ~0.56 depending on scan quality, and dense all-caps text rows topped out around ~0.2). When a page has at least `MIN_TABLE_GRIDLINES` (4) such lines, `extractLinesFromRuledTable()` OCRs each row in isolation — cropping a horizontal band between consecutive gridlines and calling `recognize()` on just that crop — so Tesseract never sees more than one row's pixels at once. `joinOcrRowWords()` then reconstructs each row's line, inserting a comma at column-sized gaps (`OCR_COLUMN_GAP_POINTS`) so the result matches the comma-delimited tail `parseVoterLine` expects, and filters out stray "|"/"¦"-like single-character "words" — a thin vertical column rule still present in a row crop is frequently misread by Tesseract as a standalone glyph sitting right at the column boundary (e.g. "VA | 22932" instead of "VA 22932"), and real cell content is never *only* a vertical-bar character.
- **Residual garbling on lower-quality scans.** Some pages (or regions of a page) have faint, skewed, or inconsistent ruling lines that still fall under the darkness threshold, causing two or more physical rows to be grouped into a single OCR'd band and their text to interleave. These land safely in the suspects-review queue (per the point above) rather than being silently dropped or merged into a wrong record, but won't parse into clean records automatically. If a particular source document produces a lot of these, the fix is page-specific: either raise the render DPI for that scan, or loosen/tighten `GRIDLINE_ROW_DARK_RATIO` after inspecting that page's actual dark-row ratios.
