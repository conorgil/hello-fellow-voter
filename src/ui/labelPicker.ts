import { createLabel, getLabels } from '../storage';
import { LABEL_PRESET_COLORS } from './color';
import { createColorPicker } from './colorPicker';
import { openLabelManagerForm } from '../forms/labelManagerForm';

export interface LabelPickerOptions {
  variant?: 'primary' | 'secondary';
  /** Render the popover already open, e.g. to survive a full rerender while the user has it open. */
  startOpen?: boolean;
  /** Called whenever the popover opens or closes, so callers can remember state across rerenders. */
  onOpenChange?: (open: boolean) => void;
  /** Heading shown at the top of the popover, e.g. "Apply labels to this voter". */
  panelTitle?: string;
  /** 'above' opens the popover upward instead of downward — for a button near the bottom of its container. */
  placement?: 'below' | 'above';
}

/**
 * A GitHub-style searchable label popover: a filter box narrows a checkbox+swatch list, and typing
 * text with no exact match reveals an inline "create new label" row. Unlike `createDropdownButton`,
 * clicking a row does NOT close the menu — toggling several labels in one sitting is the common case.
 */
export function createLabelPicker(
  buttonLabel: string,
  projectId: string,
  isChecked: (labelId: string) => boolean,
  onToggle: (labelId: string) => void,
  rerender: () => void,
  options: LabelPickerOptions = {},
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = options.placement === 'above' ? 'dropdown label-picker label-picker--above' : 'dropdown label-picker';

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = `btn btn--${options.variant ?? 'secondary'}`;
  toggleBtn.textContent = buttonLabel;

  const menu = document.createElement('div');
  menu.className = 'dropdown__menu label-picker__menu';

  if (options.panelTitle) {
    const titleEl = document.createElement('div');
    titleEl.className = 'label-picker__title';
    titleEl.textContent = options.panelTitle;
    menu.appendChild(titleEl);
  }

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'label-picker__search';
  searchInput.placeholder = 'Filter labels';
  menu.appendChild(searchInput);

  const list = document.createElement('div');
  list.className = 'label-picker__list';
  menu.appendChild(list);

  const footer = document.createElement('div');
  footer.className = 'label-picker__footer';
  const editLabelsBtn = document.createElement('button');
  editLabelsBtn.type = 'button';
  editLabelsBtn.className = 'btn btn--link';
  editLabelsBtn.textContent = 'Edit labels';
  editLabelsBtn.addEventListener('click', () => {
    close();
    openLabelManagerForm(projectId, rerender);
  });
  footer.appendChild(editLabelsBtn);
  menu.appendChild(footer);

  function renderList(): void {
    list.replaceChildren();

    const labels = getLabels(projectId);
    const query = searchInput.value.trim().toLowerCase();
    const matches = query ? labels.filter((l) => l.name.toLowerCase().includes(query)) : labels;

    if (!query && labels.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'label-picker__empty';
      empty.textContent = 'No labels yet.';
      list.appendChild(empty);
    }

    for (const label of matches) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'label-picker__item';

      const swatch = document.createElement('span');
      swatch.className = 'label-picker__swatch';
      swatch.style.backgroundColor = label.color;

      const name = document.createElement('span');
      name.className = 'label-picker__name';
      name.textContent = label.name;

      const check = document.createElement('span');
      check.className = 'label-picker__check';
      check.textContent = isChecked(label.id) ? '✓' : '';

      item.append(swatch, name, check);
      item.addEventListener('click', () => {
        onToggle(label.id);
        check.textContent = isChecked(label.id) ? '✓' : '';
      });
      list.appendChild(item);
    }

    const exactMatch = query && labels.some((l) => l.name.toLowerCase() === query);
    if (query && !exactMatch) {
      const createRow = document.createElement('button');
      createRow.type = 'button';
      createRow.className = 'label-picker__create-row';
      createRow.textContent = `+ Create new label: "${searchInput.value.trim()}"`;
      createRow.addEventListener('click', (e) => {
        // showCreateForm removes this row from the still-open menu in place, which
        // detaches it from the tree before the click event finishes bubbling to
        // document — stopPropagation keeps the outside-click listener (which checks
        // wrapper.contains(e.target)) from seeing a now-detached target and closing
        // the whole menu in response to this click.
        e.stopPropagation();
        showCreateForm(searchInput.value.trim());
      });
      list.appendChild(createRow);
    }
  }

  function showCreateForm(initialName: string): void {
    list.replaceChildren();

    const form = document.createElement('div');
    form.className = 'label-picker__create-form';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Label name';
    nameInput.value = initialName;

    const picker = createColorPicker(LABEL_PRESET_COLORS[0]);

    const errorText = document.createElement('p');
    errorText.className = 'form-error';
    errorText.hidden = true;

    const formActions = document.createElement('div');
    formActions.className = 'form-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn--secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      renderList();
    });
    const createBtn = document.createElement('button');
    createBtn.type = 'button';
    createBtn.className = 'btn btn--primary';
    createBtn.textContent = 'Create';
    formActions.append(cancelBtn, createBtn);

    form.append(nameInput, picker.el, errorText, formActions);
    list.appendChild(form);

    function doCreate(): void {
      const name = nameInput.value.trim();
      if (!name) return;
      const newLabel = createLabel(projectId, name, picker.getColor());
      if (!newLabel) {
        errorText.textContent = 'A label with this name already exists.';
        errorText.hidden = false;
        return;
      }
      searchInput.value = '';
      // Every current caller's onToggle synchronously triggers its own rebuild
      // (renderLabelsSection in the detail view, rerender() in the batch toolbar),
      // which tears down and recreates this exact picker instance fresh — so no
      // local re-render is needed here.
      onToggle(newLabel.id);
    }

    createBtn.addEventListener('click', doCreate);
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doCreate();
      }
    });

    nameInput.focus();
  }

  searchInput.addEventListener('input', renderList);

  toggleBtn.addEventListener('click', () => {
    menu.hidden ? open() : close();
  });

  function open(): void {
    menu.hidden = false;
    renderList();
    document.addEventListener('click', onOutsideClick);
    document.addEventListener('keydown', onKeydown);
    options.onOpenChange?.(true);
  }

  function close(): void {
    menu.hidden = true;
    document.removeEventListener('click', onOutsideClick);
    document.removeEventListener('keydown', onKeydown);
    options.onOpenChange?.(false);
  }

  function onOutsideClick(e: MouseEvent): void {
    if (!wrapper.contains(e.target as Node)) close();
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
  }

  menu.hidden = !options.startOpen;
  if (options.startOpen) {
    renderList();
    // Deferred: if this picker was just rebuilt by a rerender triggered from inside
    // another item's own click handler, that click event is still bubbling up to
    // document — attaching synchronously would let this brand-new listener catch
    // the tail of that same event and immediately treat it as an outside click.
    setTimeout(() => {
      if (!menu.hidden) {
        document.addEventListener('click', onOutsideClick);
        document.addEventListener('keydown', onKeydown);
      }
    }, 0);
  }

  wrapper.append(toggleBtn, menu);
  return wrapper;
}
