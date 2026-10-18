import type { ImportResult } from '../pdf/importPdf';
import { addLabelToVoters, getVotersForProject, removeLabelFromVoters } from '../storage';
import { formatImportMessage } from '../ui/importMessage';
import { createLabelPicker } from '../ui/labelPicker';

/**
 * Shared "importing -> results/error" phases for the PDF and paste-import
 * modals: both keep their own picker UI unchanged and hand off to these once
 * the user has chosen a file/submitted pasted text, so the modal stays open
 * (progress, then results) instead of closing immediately behind a toast.
 *
 * `titleEl` is the caller's pinned heading (outside the scrollable area, so
 * it never scrolls out of view) — these functions only update its text.
 */

export function renderImportingPhase(titleEl: HTMLElement, scrollArea: HTMLElement, actions: HTMLElement, titleText: string): void {
  titleEl.textContent = titleText;

  const importing = document.createElement('div');
  importing.className = 'import-importing';

  const spinner = document.createElement('div');
  spinner.className = 'import-spinner';

  const status = document.createElement('p');
  status.className = 'import-status-text';
  status.textContent = 'Importing voters…';

  importing.append(spinner, status);
  scrollArea.replaceChildren(importing);
  actions.hidden = true;
}

export function renderResultsPhase(
  titleEl: HTMLElement,
  scrollArea: HTMLElement,
  actions: HTMLElement,
  projectId: string,
  result: ImportResult,
  rerender: () => void,
  onDone: () => void,
): void {
  titleEl.textContent = 'Import complete';

  const summary = document.createElement('p');
  summary.className = 'import-result-summary';
  summary.textContent = formatImportMessage(result);
  scrollArea.replaceChildren(summary);

  const importedIds = result.importedVoterIds;
  const doneBtn = document.createElement('button');
  doneBtn.type = 'button';
  doneBtn.className = 'btn btn--primary';
  doneBtn.textContent = 'Done';
  doneBtn.addEventListener('click', onDone);

  if (importedIds.length === 0) {
    actions.replaceChildren(doneBtn);
    actions.hidden = false;
    return;
  }

  // Lives in the pinned actions row (not the scrollable area) and opens
  // upward: the button sits at the bottom of a fixed-size panel, so a
  // downward-opening popover would immediately be clipped by the panel's
  // own edge.
  let pickerOpen = false;

  // Rebuilt on every toggle (rather than updated in place) so a newly created
  // label shows up immediately — the same pattern createLabelPicker's other
  // callers (board batch bar, voter detail view) use, since the picker only
  // refreshes its own list on open.
  function renderLabelPicker(): void {
    const hasLabel = (labelId: string) =>
      importedIds.every((id) => getVotersForProject(projectId).find((v) => v.id === id)?.labelIds.includes(labelId));

    const picker = createLabelPicker(
      'Add labels to new voters',
      projectId,
      hasLabel,
      (labelId) => {
        if (hasLabel(labelId)) {
          removeLabelFromVoters(importedIds, labelId);
        } else {
          addLabelToVoters(importedIds, labelId);
        }
        renderLabelPicker();
      },
      rerender,
      {
        startOpen: pickerOpen,
        onOpenChange: (open) => {
          pickerOpen = open;
        },
        panelTitle: `Apply labels to ${importedIds.length} imported voter${importedIds.length === 1 ? '' : 's'}`,
        placement: 'above',
      },
    );
    actions.replaceChildren(picker, doneBtn);
  }

  renderLabelPicker();
  actions.hidden = false;
}

export function renderErrorPhase(titleEl: HTMLElement, scrollArea: HTMLElement, actions: HTMLElement, titleText: string, message: string, onClose: () => void): void {
  titleEl.textContent = titleText;

  const errorText = document.createElement('p');
  errorText.className = 'form-error';
  errorText.textContent = message;
  scrollArea.replaceChildren(errorText);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn btn--secondary';
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', onClose);

  actions.replaceChildren(closeBtn);
  actions.hidden = false;
}
