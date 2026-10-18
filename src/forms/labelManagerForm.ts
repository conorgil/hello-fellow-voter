import { createLabel, deleteLabel, getLabels, updateLabel } from '../storage';
import type { Label } from '../types';
import { LABEL_PRESET_COLORS, contrastTextColor } from '../ui/color';
import { createColorPicker } from '../ui/colorPicker';
import { confirmDialog } from '../ui/confirmDialog';

export function openLabelManagerForm(projectId: string, rerender: () => void): void {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';

  const panel = document.createElement('div');
  panel.className = 'panel form-panel label-manager-panel';

  const title = document.createElement('h2');
  title.textContent = 'Manage labels';

  const list = document.createElement('div');
  list.className = 'label-manager__list';

  const addSection = document.createElement('div');
  addSection.className = 'label-manager__add';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn btn--secondary';
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', close);

  const actions = document.createElement('div');
  actions.className = 'form-actions';
  actions.append(closeBtn);

  // Close lives outside this scrollable area so it stays visible even when
  // the label list overflows the panel's max height.
  const scrollArea = document.createElement('div');
  scrollArea.className = 'form-panel__scroll';
  scrollArea.append(title, list, addSection);

  panel.append(scrollArea, actions);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  function close(): void {
    overlay.remove();
    document.removeEventListener('keydown', onKeydown, true);
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      // Capture phase so this runs before any bubble-phase Escape handler on an
      // overlay underneath (e.g. the detail view), regardless of registration order.
      e.stopPropagation();
      close();
    }
  }
  document.addEventListener('keydown', onKeydown, true);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  function renderList(): void {
    list.replaceChildren();
    const labels = getLabels(projectId);
    if (labels.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'label-manager__empty';
      empty.textContent = 'No labels yet.';
      list.appendChild(empty);
    }
    for (const label of labels) {
      list.appendChild(createLabelRow(label));
    }
  }

  function createLabelRow(label: Label): HTMLElement {
    const row = document.createElement('div');
    row.className = 'label-manager__row';

    function showDisplay(): void {
      row.replaceChildren();
      const swatch = document.createElement('span');
      swatch.className = 'label-badge';
      swatch.style.backgroundColor = label.color;
      swatch.style.color = contrastTextColor(label.color);
      swatch.textContent = label.name;

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'voter-card__icon-btn';
      editBtn.setAttribute('aria-label', `Edit ${label.name}`);
      editBtn.textContent = '✎';
      editBtn.addEventListener('click', showEditor);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'voter-card__icon-btn';
      deleteBtn.setAttribute('aria-label', `Delete ${label.name}`);
      deleteBtn.textContent = '×';
      deleteBtn.addEventListener('click', async () => {
        const confirmed = await confirmDialog({
          title: 'Delete label',
          message: `Delete the label "${label.name}"? It will be removed from any voters that have it.`,
          confirmLabel: 'Delete',
          danger: true,
        });
        if (confirmed) {
          deleteLabel(projectId, label.id);
          renderList();
          rerender();
        }
      });

      row.append(swatch, editBtn, deleteBtn);
    }

    function showEditor(): void {
      row.replaceChildren();
      const form = document.createElement('form');
      form.className = 'label-manager__edit-form';

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.required = true;
      nameInput.value = label.name;

      const picker = createColorPicker(label.color);

      const errorText = document.createElement('p');
      errorText.className = 'form-error';
      errorText.hidden = true;

      const formActions = document.createElement('div');
      formActions.className = 'form-actions';
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'btn btn--secondary';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', showDisplay);
      const saveBtn = document.createElement('button');
      saveBtn.type = 'submit';
      saveBtn.className = 'btn btn--primary';
      saveBtn.textContent = 'Save';
      formActions.append(cancelBtn, saveBtn);

      form.append(nameInput, picker.el, errorText, formActions);
      row.appendChild(form);

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        if (!name) return;
        if (!updateLabel(projectId, label.id, name, picker.getColor())) {
          errorText.textContent = 'A label with this name already exists.';
          errorText.hidden = false;
          return;
        }
        renderList();
        rerender();
      });

      nameInput.focus();
      nameInput.select();
    }

    showDisplay();
    return row;
  }

  function showAddButton(): void {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn--secondary';
    button.textContent = '+ New label';
    button.addEventListener('click', showAddEditor);
    addSection.replaceChildren(button);
  }

  function showAddEditor(): void {
    const form = document.createElement('form');
    form.className = 'label-manager__add-form';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.required = true;
    nameInput.placeholder = 'Label name';

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
    cancelBtn.addEventListener('click', showAddButton);
    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.className = 'btn btn--primary';
    saveBtn.textContent = 'Add';
    formActions.append(cancelBtn, saveBtn);

    form.append(nameInput, picker.el, errorText, formActions);
    addSection.replaceChildren(form);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = nameInput.value.trim();
      if (!name) return;
      if (!createLabel(projectId, name, picker.getColor())) {
        errorText.textContent = 'A label with this name already exists.';
        errorText.hidden = false;
        return;
      }
      renderList();
      rerender();
      showAddButton();
    });

    nameInput.focus();
  }

  renderList();
  showAddButton();
}
