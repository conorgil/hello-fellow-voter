import { importPastedText } from '../pdf/importPastedText';
import { addToSuspectQueue, getSuspectQueue } from '../storage';
import { renderResultsPhase } from './importResultPanel';
import { openReviewSuspectsForm } from './reviewSuspectsForm';

export function openPasteImportForm(projectId: string, rerender: () => void): void {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';

  const panel = document.createElement('div');
  panel.className = 'panel form-panel paste-import-panel';

  const title = document.createElement('h2');
  title.textContent = 'Copy/paste voters';

  const hint = document.createElement('p');
  hint.className = 'paste-import-hint';
  hint.textContent = 'Enter one voter per line, e.g. "Voter Name, Street address, City, State, ZIP".';

  const form = document.createElement('form');

  const textareaField = document.createElement('label');
  textareaField.className = 'form-field';

  const textarea = document.createElement('textarea');
  textarea.className = 'paste-import-textarea';
  textarea.required = true;
  textareaField.append(textarea);

  const actions = document.createElement('div');
  actions.className = 'form-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn--secondary';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', close);

  const importBtn = document.createElement('button');
  importBtn.type = 'submit';
  importBtn.className = 'btn btn--primary';
  importBtn.textContent = 'Import';

  actions.append(cancelBtn, importBtn);

  // Cancel/Import (and later Done) live outside this scrollable area so they
  // stay visible even when the content overflows the panel's max height.
  const scrollArea = document.createElement('div');
  scrollArea.className = 'form-panel__scroll';
  scrollArea.append(hint, textareaField);

  // Title lives outside the scrollable area too, so it never scrolls out of view.
  form.append(title, scrollArea, actions);
  panel.append(form);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  // Importing pasted text is synchronous, so there's no in-progress phase to
  // guard against dismissal — only the results phase needs Escape/outside
  // click to act as Done instead of a plain close.
  let dismissible = true;
  let dismissAction: () => void = close;

  function close(): void {
    overlay.remove();
    document.removeEventListener('keydown', onKeydown);
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && dismissible) dismissAction();
  }
  document.addEventListener('keydown', onKeydown);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay && dismissible) dismissAction();
  });

  function onDone(): void {
    close();
    rerender();
    if (getSuspectQueue(projectId).length > 0) {
      openReviewSuspectsForm(projectId, rerender);
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const result = importPastedText(projectId, textarea.value);
    addToSuspectQueue(projectId, result.suspectedLines);
    dismissAction = onDone;
    renderResultsPhase(title, scrollArea, actions, projectId, result, rerender, onDone);
  });

  textarea.focus();
}
