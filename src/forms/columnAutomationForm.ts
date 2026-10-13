import { createLabel, getColumns, getLabels, setColumnAutomation } from '../storage';
import { DONE_STAY, type Column, type ColumnAutomation } from '../types';
import { LABEL_PRESET_COLORS } from '../ui/color';
import { createColorPicker } from '../ui/colorPicker';

const NONE = '';
const CREATE_LABEL = '__create__';

export function openColumnAutomationForm(projectId: string, column: Column, rerender: () => void): void {
  const columns = getColumns(projectId);
  const labels = getLabels(projectId);
  const automation = column.automation;

  const overlay = document.createElement('div');
  overlay.className = 'overlay';

  const panel = document.createElement('div');
  panel.className = 'panel form-panel automation-panel';

  const title = document.createElement('h2');
  title.textContent = `Automation for the ${column.label} column`;

  function bold(text: string): HTMLElement {
    const strong = document.createElement('strong');
    strong.textContent = text;
    return strong;
  }

  const form = document.createElement('form');

  const selectsToSize: HTMLSelectElement[] = [];

  function measureTextWidth(text: string, referenceEl: Element): number {
    const span = document.createElement('span');
    span.style.visibility = 'hidden';
    span.style.position = 'absolute';
    span.style.whiteSpace = 'pre';
    span.style.font = getComputedStyle(referenceEl).font;
    span.textContent = text;
    document.body.appendChild(span);
    const width = span.getBoundingClientRect().width;
    span.remove();
    return width;
  }

  // Native <select> elements size themselves to their widest *option*, not the
  // selected one, which leaves a lot of dead space for short selections (e.g.
  // "Writing") when another option is a long sentence (e.g. "(Don't show a
  // Done button)"). Explicitly size the box to the selected option instead.
  function syncSelectWidth(select: HTMLSelectElement): void {
    const selectedOption = select.options[select.selectedIndex];
    const text = selectedOption?.textContent ?? '';
    select.style.width = `${measureTextWidth(text, select) + 40}px`;
  }

  function buildColumnSelect(
    noneLabel: string | null,
    selected: string | null,
    extraOptions: { value: string; label: string }[] = [],
  ): HTMLSelectElement {
    const select = document.createElement('select');
    if (noneLabel !== null) {
      const noneOption = document.createElement('option');
      noneOption.value = NONE;
      noneOption.textContent = noneLabel;
      select.appendChild(noneOption);
    }
    for (const extra of extraOptions) {
      const option = document.createElement('option');
      option.value = extra.value;
      option.textContent = extra.label;
      select.appendChild(option);
    }
    for (const c of columns) {
      const option = document.createElement('option');
      option.value = c.id;
      option.textContent = c.label;
      select.appendChild(option);
    }
    select.value = selected ?? NONE;
    select.addEventListener('change', () => syncSelectWidth(select));
    selectsToSize.push(select);
    return select;
  }

  function buildLabelSelect(selected: string | null): HTMLSelectElement {
    const select = document.createElement('select');
    const noneOption = document.createElement('option');
    noneOption.value = NONE;
    noneOption.textContent = "(Don't assign a label)";
    select.appendChild(noneOption);
    const createOption = document.createElement('option');
    createOption.value = CREATE_LABEL;
    createOption.textContent = '+ Create new label...';
    select.appendChild(createOption);
    for (const l of labels) {
      const option = document.createElement('option');
      option.value = l.id;
      option.textContent = l.name;
      select.appendChild(option);
    }
    select.value = selected ?? NONE;
    select.addEventListener('change', () => syncSelectWidth(select));
    selectsToSize.push(select);
    return select;
  }

  function buildLabelCreateForm(select: HTMLSelectElement): HTMLDivElement {
    let priorValue = select.value;

    const wrap = document.createElement('div');
    wrap.className = 'automation-label-create';
    wrap.hidden = true;

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
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
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn btn--primary';
    addBtn.textContent = 'Add';
    formActions.append(cancelBtn, addBtn);

    wrap.append(nameInput, picker.el, errorText, formActions);

    function closeForm(): void {
      wrap.hidden = true;
      select.value = priorValue;
      syncSelectWidth(select);
    }

    function addLabel(): void {
      const name = nameInput.value.trim();
      if (!name) return;
      const newLabel = createLabel(projectId, name, picker.getColor());
      if (!newLabel) {
        errorText.textContent = 'A label with this name already exists.';
        errorText.hidden = false;
        return;
      }
      labels.push(newLabel);
      const option = document.createElement('option');
      option.value = newLabel.id;
      option.textContent = newLabel.name;
      select.appendChild(option);
      select.value = newLabel.id;
      priorValue = newLabel.id;
      wrap.hidden = true;
      syncSelectWidth(select);
    }

    cancelBtn.addEventListener('click', closeForm);
    addBtn.addEventListener('click', addLabel);
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addLabel();
      }
    });

    select.addEventListener('change', () => {
      if (select.value === CREATE_LABEL) {
        wrap.hidden = false;
        nameInput.value = '';
        errorText.hidden = true;
        nameInput.focus();
      } else {
        priorValue = select.value;
      }
    });

    return wrap;
  }

  function buildField(labelContent: (string | Node)[], select: HTMLSelectElement): HTMLLabelElement {
    const field = document.createElement('label');
    field.className = 'form-field automation-field';
    const labelSpan = document.createElement('span');
    labelSpan.className = 'automation-action-label';
    labelSpan.append(...labelContent);
    field.append(labelSpan, select);
    return field;
  }

  function buildTextAction(text: string): HTMLSpanElement {
    const span = document.createElement('span');
    span.className = 'automation-action-label';
    span.textContent = text;
    return span;
  }

  function buildActionList(actions: HTMLElement[]): HTMLUListElement {
    const list = document.createElement('ul');
    list.className = 'automation-actions';
    for (const action of actions) {
      const item = document.createElement('li');
      item.className = 'automation-action';
      item.appendChild(action);
      list.appendChild(item);
    }
    return list;
  }

  function buildGroup(legendContent: (string | Node)[], actionList: HTMLUListElement): HTMLFieldSetElement {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'automation-group';
    const legend = document.createElement('legend');
    legend.append(...legendContent);
    fieldset.append(legend, actionList);
    return fieldset;
  }

  const onOpenSelect = buildColumnSelect("(Don't move the voter)", automation.onOpenMoveTo);
  const onOpenField = buildField(['Move the voter to'], onOpenSelect);
  const onOpenGroup = buildGroup(
    ['When a voter is clicked'],
    buildActionList([buildTextAction('Open the voter address view'), onOpenField]),
  );

  const doneSelect = buildColumnSelect("(Don't show a Done button)", automation.doneMoveTo, [
    { value: DONE_STAY, label: '(Do not move current voter)' },
  ]);
  const doneField = buildField(['Move the current voter to'], doneSelect);
  const doneGroup = buildGroup(
    ['When ', bold('Done'), ' button is clicked'],
    buildActionList([buildTextAction('Close the voter address view'), doneField]),
  );

  const nextMoveSelect = buildColumnSelect("(Don't show a Next voter button)", automation.nextVoterMoveTo);
  const nextMoveField = buildField(['Move the current voter to'], nextMoveSelect);

  const displaySelect = buildColumnSelect("(Don't automatically display a voter)", automation.displayNextFrom);
  const displayField = buildField(['Display next voter in'], displaySelect);

  const pullFromSelect = buildColumnSelect("(Don't move another voter)", automation.pullFrom);
  const pullFromField = buildField(['Move voter from'], pullFromSelect);

  const pullToSelect = buildColumnSelect(null, automation.pullTo ?? columns[0]?.id ?? null);
  const pullToField = buildField(['into'], pullToSelect);

  const pullAction = document.createElement('div');
  pullAction.className = 'automation-pull-action';
  pullAction.append(pullFromField, pullToField);

  const nextGroup = buildGroup(
    ['When ', bold('Next voter'), ' button is clicked'],
    buildActionList([nextMoveField, pullAction, displayField]),
  );

  function syncPullToVisible(): void {
    pullToField.hidden = pullFromSelect.value === NONE;
  }
  pullFromSelect.addEventListener('change', syncPullToVisible);
  syncPullToVisible();

  const labelSelect = buildLabelSelect(automation.assignLabelOnEntry);
  const labelField = buildField(['Assign the label'], labelSelect);
  const labelCreateForm = buildLabelCreateForm(labelSelect);
  const labelAction = document.createElement('div');
  labelAction.append(labelField, labelCreateForm);
  const labelGroup = buildGroup(['Whenever a voter enters this column'], buildActionList([labelAction]));

  const actions = document.createElement('div');
  actions.className = 'form-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn--secondary';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', close);

  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.className = 'btn btn--primary';
  saveBtn.textContent = 'Save';

  actions.append(cancelBtn, saveBtn);
  form.append(onOpenGroup, doneGroup, nextGroup, labelGroup, actions);
  panel.append(title, form);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  for (const select of selectsToSize) {
    syncSelectWidth(select);
  }

  function close(): void {
    overlay.remove();
    document.removeEventListener('keydown', onKeydown);
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
  }
  document.addEventListener('keydown', onKeydown);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const next: ColumnAutomation = {
      onOpenMoveTo: onOpenSelect.value || null,
      doneMoveTo: doneSelect.value || null,
      nextVoterMoveTo: nextMoveSelect.value || null,
      displayNextFrom: displaySelect.value || null,
      pullFrom: pullFromSelect.value || null,
      pullTo: pullFromSelect.value ? pullToSelect.value || null : null,
      assignLabelOnEntry: labelSelect.value && labelSelect.value !== CREATE_LABEL ? labelSelect.value : null,
    };
    setColumnAutomation(projectId, column.id, next);
    close();
    rerender();
  });
}
