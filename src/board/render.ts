import { exportVoterStatusPdf } from '../export/exportVoterStatusPdf';
import { openColumnAutomationForm } from '../forms/columnAutomationForm';
import { openVoterForm } from '../forms/voterForm';
import { openPasteImportForm } from '../forms/pasteImportForm';
import { openPdfImportForm } from '../forms/pdfImportForm';
import { openReviewSuspectsForm } from '../forms/reviewSuspectsForm';
import { redoShortcutLabel, undoShortcutLabel } from '../keyboardShortcuts';
import { createHelpButton } from '../splash/helpButton';
import {
  addColumn,
  addLabelToVoters,
  canRedo,
  canUndo,
  deleteColumn,
  getColumns,
  getLabels,
  getVotersForProject,
  getSuspectQueue,
  redo,
  removeLabelFromVoters,
  renameColumn,
  renameProject,
  reorderColumns,
  setActiveProject,
  undo,
} from '../storage';
import type { Project } from '../types';
import { createDropdownButton } from '../ui/dropdownMenu';
import { createLabelPicker } from '../ui/labelPicker';
import { attachTextTooltip } from '../ui/tooltip';
import { showToast } from '../ui/toast';
import { createVoterElement } from './voter';
import { makeColumnDroppable } from './dragDrop';
import { dragAndDrop } from '@formkit/drag-and-drop';
import { clearLabelFilter, getActiveLabelFilters, pruneLabelFilters } from './labelFilter';
import { clearSelection, getSelectedCount, getSelectedIds, isSelected, toggleSelectAllInColumn } from './selection';

let batchPickerOpen = false;

export function renderBoardView(container: HTMLElement, project: Project, rerender: () => void): void {
  const wrapper = document.createElement('div');
  wrapper.className = 'board-view';

  // --- Header ---
  const header = document.createElement('div');
  header.className = 'board-header';

  const backLink = document.createElement('button');
  backLink.className = 'btn btn--link board-header__back';
  backLink.setAttribute('aria-label', 'All projects');
  const backArrow = document.createElement('span');
  backArrow.setAttribute('aria-hidden', 'true');
  backArrow.textContent = '←';
  const backText = document.createElement('span');
  backText.className = 'board-header__back-text';
  backText.textContent = 'All projects';
  backLink.append(backArrow, backText);
  backLink.addEventListener('click', () => {
    setActiveProject(null);
    clearSelection();
    clearLabelFilter();
    rerender();
  });

  const titleWrap = document.createElement('div');
  titleWrap.className = 'board-header__title-wrap';

  function showTitleButton(): void {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'board-header__title board-header__title--editable';
    button.setAttribute('aria-label', 'Rename project');

    const labelSpan = document.createElement('span');
    labelSpan.className = 'board-header__title-label';
    labelSpan.textContent = project.name;
    button.appendChild(labelSpan);

    attachTextTooltip(button, 'Project name. Click to change.', 400, 'below', 'left');
    button.addEventListener('click', showTitleEditor);
    titleWrap.replaceChildren(button);
  }

  function showTitleEditor(): void {
    const form = document.createElement('form');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'board-header__title-input';
    input.required = true;
    input.value = project.name;
    form.append(input);

    const errorText = document.createElement('p');
    errorText.className = 'form-error';
    errorText.hidden = true;

    titleWrap.replaceChildren(form, errorText);

    let cancelled = false;

    function commit(): void {
      const name = input.value.trim();
      if (!name || name === project.name) {
        showTitleButton();
        return;
      }
      if (!renameProject(project.id, name)) {
        errorText.textContent = 'A project with this name already exists.';
        errorText.hidden = false;
        input.focus();
        return;
      }
      rerender();
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      commit();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        cancelled = true;
        showTitleButton();
      }
    });

    input.addEventListener('blur', () => {
      if (cancelled) return;
      commit();
    });

    input.focus();
    input.select();
  }

  showTitleButton();

  const controls = document.createElement('div');
  controls.className = 'board-header__controls';

  const undoBtn = document.createElement('button');
  undoBtn.className = 'btn btn--secondary board-header__history-btn';
  undoBtn.setAttribute('aria-label', 'Undo');
  undoBtn.textContent = '↺';
  undoBtn.disabled = !canUndo();
  attachTextTooltip(undoBtn, `Undo (${undoShortcutLabel()})`, 400);
  undoBtn.addEventListener('click', () => {
    if (undo()) {
      clearSelection();
      rerender();
    }
  });

  const redoBtn = document.createElement('button');
  redoBtn.className = 'btn btn--secondary board-header__history-btn';
  redoBtn.setAttribute('aria-label', 'Redo');
  redoBtn.textContent = '↻';
  redoBtn.disabled = !canRedo();
  attachTextTooltip(redoBtn, `Redo (${redoShortcutLabel()})`, 400);
  redoBtn.addEventListener('click', () => {
    if (redo()) {
      clearSelection();
      rerender();
    }
  });

  // On desktop .board-header__actions is always visible (an inline row); on
  // mobile it's a collapsed dropdown shown only via --open, toggled by
  // menuToggleBtn (itself only visible on mobile). Using a modifier class
  // rather than the `hidden` attribute keeps those two states independent
  // instead of a single toggle fighting both breakpoints.
  const actions = document.createElement('div');
  actions.className = 'board-header__actions';

  const menuToggleBtn = document.createElement('button');
  menuToggleBtn.className = 'btn btn--secondary board-header__menu-toggle';
  menuToggleBtn.setAttribute('aria-label', 'More actions');
  menuToggleBtn.setAttribute('aria-expanded', 'false');
  menuToggleBtn.textContent = '≡';
  menuToggleBtn.addEventListener('click', () => {
    actions.classList.contains('board-header__actions--open') ? closeActions() : openActions();
  });

  function openActions(): void {
    actions.classList.add('board-header__actions--open');
    menuToggleBtn.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', onOutsideClick);
  }
  function closeActions(): void {
    actions.classList.remove('board-header__actions--open');
    menuToggleBtn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', onOutsideClick);
  }
  function onOutsideClick(e: MouseEvent): void {
    if (!controls.contains(e.target as Node)) closeActions();
  }

  controls.append(undoBtn, redoBtn, menuToggleBtn, actions);

  const importBtn = createDropdownButton(
    'Import voter list...',
    [
      { label: '...via PDF', onSelect: () => openPdfImportForm(project.id, rerender) },
      { label: '...via copy/paste', onSelect: () => openPasteImportForm(project.id, rerender) },
    ],
    'primary',
  );

  const addVoterBtn = document.createElement('button');
  addVoterBtn.className = 'btn btn--secondary';
  addVoterBtn.textContent = 'Add single voter';
  addVoterBtn.addEventListener('click', () => openVoterForm(project.id, rerender));

  const exportBtn = document.createElement('button');
  exportBtn.className = 'btn btn--secondary board-header__export-btn';
  exportBtn.textContent = 'Export voter list';
  attachTextTooltip(exportBtn, 'Export a PDF that contains each voter and their current status', 400);
  exportBtn.addEventListener('click', () => {
    exportVoterStatusPdf(project, getVotersForProject(project.id));
  });

  actions.append(importBtn, addVoterBtn, exportBtn);

  const labels = getLabels(project.id);
  pruneLabelFilters(labels.map((l) => l.id));
  const activeLabelFilters = getActiveLabelFilters();

  const pendingSuspects = getSuspectQueue(project.id);
  if (pendingSuspects.length > 0) {
    const reviewSuspectsBtn = document.createElement('button');
    reviewSuspectsBtn.className = 'btn btn--secondary';
    reviewSuspectsBtn.textContent = `Review possible addresses (${pendingSuspects.length})`;
    reviewSuspectsBtn.addEventListener('click', () => openReviewSuspectsForm(project.id, rerender));
    actions.append(reviewSuspectsBtn);
  }

  actions.append(createHelpButton());
  header.append(backLink, titleWrap, controls);

  const voters = getVotersForProject(project.id);
  const columns = getColumns(project.id);

  // --- Batch label toolbar ---
  const selectedCount = getSelectedCount();
  let batchBar: HTMLElement | null = null;
  if (selectedCount > 0 && labels.length > 0) {
    batchBar = document.createElement('div');
    batchBar.className = 'board-batch-bar';

    const countText = document.createElement('span');
    countText.textContent = `${selectedCount} selected`;
    batchBar.appendChild(countText);

    const selectedIds = getSelectedIds();
    const batchPicker = createLabelPicker(
      'Add/remove labels',
      project.id,
      (id) => selectedIds.every((voterId) => voters.find((v) => v.id === voterId)?.labelIds.includes(id)),
      (id) => {
        const allHaveIt = selectedIds.every((voterId) => voters.find((v) => v.id === voterId)?.labelIds.includes(id));
        const label = getLabels(project.id).find((l) => l.id === id);
        if (allHaveIt) {
          removeLabelFromVoters(selectedIds, id);
          if (label) showToast(`Removed "${label.name}" from ${selectedIds.length} voters`, 'success');
        } else {
          addLabelToVoters(selectedIds, id);
          if (label) showToast(`Labeled ${selectedIds.length} voters as "${label.name}"`, 'success');
        }
        rerender();
      },
      rerender,
      {
        startOpen: batchPickerOpen,
        onOpenChange: (open) => {
          batchPickerOpen = open;
        },
        panelTitle: `Apply labels to ${selectedCount} voter(s)`,
      },
    );
    batchBar.appendChild(batchPicker);

    const clearSelectionBtn = document.createElement('button');
    clearSelectionBtn.className = 'btn btn--link';
    clearSelectionBtn.textContent = 'Clear selection';
    clearSelectionBtn.addEventListener('click', () => {
      clearSelection();
      rerender();
    });
    batchBar.appendChild(clearSelectionBtn);
  }

  // --- Columns ---
  const board = document.createElement('div');
  board.className = 'board';

  for (const [columnIndex, column] of columns.entries()) {
    const columnEl = document.createElement('section');
    columnEl.className = 'column';
    columnEl.dataset.columnId = column.id;

    const columnVoters = voters
      .filter((v) => v.status === column.id)
      .filter((v) => activeLabelFilters.length === 0 || v.labelIds.some((id) => activeLabelFilters.includes(id)))
      .sort((a, b) => a.order - b.order);
    const columnVoterIds = columnVoters.map((v) => v.id);
    const selectedInColumn = columnVoterIds.filter((id) => isSelected(id)).length;

    const columnHeader = document.createElement('div');
    columnHeader.className = 'column__header';

    const columnHeaderTop = document.createElement('div');
    columnHeaderTop.className = 'column__header-top';

    const dragHandle = document.createElement('span');
    dragHandle.className = 'column__drag-handle';
    dragHandle.setAttribute('aria-label', 'Reorder column');
    dragHandle.textContent = '⠿';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'column__title-wrap';

    const headerError = document.createElement('p');
    headerError.className = 'column__header-error';
    headerError.hidden = true;

    function showColumnError(message: string): void {
      headerError.textContent = message;
      headerError.hidden = false;
    }

    function showColumnTitleButton(): void {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'column__title column__title--editable';
      button.setAttribute('aria-label', 'Rename column');
      button.addEventListener('click', showColumnTitleEditor);

      const labelSpan = document.createElement('span');
      labelSpan.className = 'column__title-label';
      labelSpan.textContent = column.label;

      const countSpan = document.createElement('span');
      countSpan.className = 'column__title-count';
      countSpan.textContent = String(columnVoters.length);

      button.append(labelSpan, countSpan);
      const voterWord = columnVoters.length === 1 ? 'voter' : 'voters';
      attachTextTooltip(
        button,
        `${columnVoters.length} ${voterWord} with status ${column.label}. Click to change column name.`,
        400,
        'below',
        columnIndex === 0 ? 'left' : 'right',
      );
      titleWrap.replaceChildren(button);
    }

    function showColumnTitleEditor(): void {
      const form = document.createElement('form');
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'column__title-input';
      input.required = true;
      input.value = column.label;
      form.append(input);

      titleWrap.replaceChildren(form);

      let cancelled = false;

      function commit(): void {
        const label = input.value.trim();
        if (!label || label === column.label) {
          showColumnTitleButton();
          return;
        }
        if (!renameColumn(project.id, column.id, label)) {
          showColumnError('A column with this name already exists.');
          input.focus();
          return;
        }
        rerender();
      }

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        commit();
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          cancelled = true;
          showColumnTitleButton();
        }
      });

      input.addEventListener('blur', () => {
        if (cancelled) return;
        commit();
      });

      input.focus();
      input.select();
    }

    showColumnTitleButton();

    const menuBtn = createDropdownButton(
      '⋯',
      [
        {
          label: selectedInColumn > 0 ? `${selectedInColumn} selected` : 'Select all',
          onSelect: () => {
            toggleSelectAllInColumn(columnVoterIds);
            rerender();
          },
          disabled: columnVoterIds.length === 0,
        },
        { label: 'Edit automation', onSelect: () => openColumnAutomationForm(project.id, column, rerender) },
        { label: 'Rename column', onSelect: showColumnTitleEditor },
        {
          label: 'Delete column',
          onSelect: () => {
            const result = deleteColumn(project.id, column.id);
            if (result.ok) {
              rerender();
              return;
            }
            if (result.reason === 'not-empty') {
              showColumnError(
                `Move all ${result.voterCount} voter${result.voterCount === 1 ? '' : 's'} out of this column before deleting it.`,
              );
            } else if (result.reason === 'last-column') {
              showColumnError('A project must have at least one column.');
            }
          },
        },
      ],
      'secondary',
    );

    columnHeaderTop.append(dragHandle, titleWrap, menuBtn);
    columnHeader.append(columnHeaderTop, headerError);

    const columnBody = document.createElement('div');
    columnBody.className = 'column__body';

    for (const voter of columnVoters) {
      columnBody.appendChild(createVoterElement(voter, project.id, columnVoterIds, columns, labels, rerender));
    }

    makeColumnDroppable(columnBody, column.id, rerender);

    columnEl.append(columnHeader, columnBody);
    board.appendChild(columnEl);
  }

  const addColumnEl = document.createElement('section');
  addColumnEl.className = 'column column--add';

  function showAddColumnButton(): void {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn--secondary column__add-btn';
    button.textContent = '+ Add column';
    button.addEventListener('click', showAddColumnEditor);
    addColumnEl.replaceChildren(button);
  }

  function showAddColumnEditor(): void {
    const form = document.createElement('form');

    const input = document.createElement('input');
    input.type = 'text';
    input.required = true;
    input.placeholder = 'Column name';

    const errorText = document.createElement('p');
    errorText.className = 'form-error';
    errorText.hidden = true;

    const actions = document.createElement('div');
    actions.className = 'form-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn--secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', showAddColumnButton);
    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.className = 'btn btn--primary';
    saveBtn.textContent = 'Add';
    actions.append(cancelBtn, saveBtn);

    form.append(input, errorText, actions);
    addColumnEl.replaceChildren(form);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const label = input.value.trim();
      if (!label) return;
      if (!addColumn(project.id, label)) {
        errorText.textContent = 'A column with this name already exists.';
        errorText.hidden = false;
        return;
      }
      rerender();
    });

    input.focus();
  }

  showAddColumnButton();
  board.appendChild(addColumnEl);

  dragAndDrop<string>({
    parent: board,
    getValues: () => getColumns(project.id).map((c) => c.id),
    setValues: (newOrder) => {
      reorderColumns(project.id, newOrder);
      rerender();
    },
    config: {
      dragHandle: '.column__drag-handle',
      draggable: (el) => !el.classList.contains('column--add'),
      longPress: true,
      longPressDuration: 450,
      draggingClass: 'column--dragging',
    },
  });

  if (batchBar) {
    wrapper.append(header, batchBar, board);
  } else {
    wrapper.append(header, board);
  }
  container.appendChild(wrapper);
}
