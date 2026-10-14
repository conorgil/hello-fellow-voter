import { MESSAGE_PRESETS, isCustomMessage } from '../postcardMessages';
import { confirmDialog } from '../ui/confirmDialog';

type Selection = { kind: 'preset'; id: 'A' | 'B' | 'C' } | { kind: 'custom' };

/** The longest of the three proven-effective presets — anything past this risks not fitting. */
const WARNING_LENGTH = Math.max(...MESSAGE_PRESETS.map((p) => p.text.length));

export function openMessagePickerForm(currentMessage: string, onSave: (message: string) => void): void {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';

  const panel = document.createElement('div');
  panel.className = 'panel form-panel message-picker-panel';

  const title = document.createElement('h2');
  title.textContent = 'Choose your postcard message';

  const introPara1 = document.createElement('p');
  introPara1.className = 'message-picker__intro';
  introPara1.textContent =
    'Please consider writing one of the proven messages below. Many studies have found that nonpartisan messages about the voting process are more effective at boosting turnout than messages that discuss candidates or issues.';

  const introPara2 = document.createElement('p');
  introPara2.className = 'message-picker__intro';
  introPara2.textContent =
    "Do your best to write clearly and avoid cursive. Leave about a finger's width of white space on the bottom of the postcard because that is where the USPS bar code will be placed by the post office.";

  const optionsList = document.createElement('div');
  optionsList.className = 'message-picker__options';

  const customTextarea = document.createElement('textarea');
  customTextarea.className = 'message-picker__textarea';
  customTextarea.maxLength = 1000;
  customTextarea.placeholder = 'Write your own message...';

  const lengthWarning = document.createElement('p');
  lengthWarning.className = 'form-warning';
  lengthWarning.hidden = true;
  lengthWarning.textContent =
    'This message is longer than our longest proven-effective message — it might not fit on the postcard, or people may not read the whole thing.';

  const errorText = document.createElement('p');
  errorText.className = 'form-error';
  errorText.hidden = true;

  const wasCustom = isCustomMessage(currentMessage);
  let selection: Selection = wasCustom
    ? { kind: 'custom' }
    : { kind: 'preset', id: MESSAGE_PRESETS.find((p) => p.text === currentMessage)?.id ?? 'A' };
  customTextarea.value = wasCustom ? currentMessage : '';

  const optionButtons = new Map<string, HTMLButtonElement>();

  function makeOption(key: string, label: string, preview: string): HTMLButtonElement {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'message-picker__option';
    option.setAttribute('role', 'radio');

    const optLabel = document.createElement('span');
    optLabel.className = 'message-picker__option-label';
    optLabel.textContent = label;

    const optPreview = document.createElement('span');
    optPreview.className = 'message-picker__option-preview';
    optPreview.textContent = preview;

    option.append(optLabel, optPreview);
    optionButtons.set(key, option);
    return option;
  }

  for (const preset of MESSAGE_PRESETS) {
    const option = makeOption(preset.id, preset.label, preset.text);
    option.addEventListener('click', () => {
      selection = { kind: 'preset', id: preset.id };
      updateSelectionUI();
    });
    optionsList.appendChild(option);
  }

  const customOption = makeOption('custom', 'Custom message', 'Write your own message below.');
  customOption.addEventListener('click', () => {
    selection = { kind: 'custom' };
    updateSelectionUI();
  });
  optionsList.appendChild(customOption);

  function updateSelectionUI(): void {
    for (const [key, button] of optionButtons) {
      const isSelected = selection.kind === 'preset' ? key === selection.id : key === 'custom';
      button.classList.toggle('message-picker__option--selected', isSelected);
      button.setAttribute('aria-checked', String(isSelected));
    }
    customTextarea.hidden = selection.kind !== 'custom';
    if (selection.kind === 'custom') {
      updateLengthWarning();
    } else {
      lengthWarning.hidden = true;
    }
    errorText.hidden = true;
  }

  function updateLengthWarning(): void {
    lengthWarning.hidden = customTextarea.value.trim().length <= WARNING_LENGTH;
  }

  customTextarea.addEventListener('input', updateLengthWarning);

  const actions = document.createElement('div');
  actions.className = 'form-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn--secondary';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', close);

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn btn--primary';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', handleSave);

  actions.append(cancelBtn, saveBtn);

  panel.append(
    title,
    introPara1,
    introPara2,
    optionsList,
    customTextarea,
    lengthWarning,
    errorText,
    actions,
  );
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  updateSelectionUI();

  async function handleSave(): Promise<void> {
    let newMessage: string;
    if (selection.kind === 'preset') {
      const presetId = selection.id;
      newMessage = MESSAGE_PRESETS.find((p) => p.id === presetId)!.text;
    } else {
      newMessage = customTextarea.value.trim();
      if (!newMessage) {
        errorText.textContent = 'Please write a message, or choose one of the options above.';
        errorText.hidden = false;
        return;
      }
    }

    const replacingCustomWithPreset = wasCustom && selection.kind === 'preset' && newMessage !== currentMessage;
    if (replacingCustomWithPreset) {
      const confirmed = await confirmDialog({
        title: 'Replace your custom message?',
        message: 'Switching to a preset will delete the custom message you wrote.',
        confirmLabel: 'Replace message',
        danger: true,
      });
      if (!confirmed) return;
    }

    onSave(newMessage);
    close();
  }

  function close(): void {
    overlay.remove();
    document.removeEventListener('keydown', onKeydown, true);
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  }
  document.addEventListener('keydown', onKeydown, true);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
}
