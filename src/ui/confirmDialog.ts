export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive (red) instead of primary. */
  danger?: boolean;
}

/** Themed replacement for the native `confirm()` dialog; resolves true/false. */
export function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';

    const panel = document.createElement('div');
    panel.className = 'panel form-panel confirm-dialog';

    const title = document.createElement('h2');
    title.textContent = options.title ?? 'Are you sure?';

    const message = document.createElement('p');
    message.className = 'confirm-dialog__message';
    message.textContent = options.message;

    const actions = document.createElement('div');
    actions.className = 'form-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn--secondary';
    cancelBtn.textContent = options.cancelLabel ?? 'Cancel';
    cancelBtn.addEventListener('click', () => finish(false));

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = `btn ${options.danger ? 'btn--danger' : 'btn--primary'}`;
    confirmBtn.textContent = options.confirmLabel ?? 'Confirm';
    confirmBtn.addEventListener('click', () => finish(true));

    actions.append(cancelBtn, confirmBtn);
    panel.append(title, message, actions);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    function finish(result: boolean): void {
      overlay.remove();
      document.removeEventListener('keydown', onKeydown, true);
      resolve(result);
    }

    function onKeydown(e: KeyboardEvent): void {
      if (e.key === 'Escape' || e.key === 'Enter') {
        // Capture phase so this intercepts the key before any overlay underneath
        // (e.g. the detail view or label manager) reacts to the same keypress.
        e.stopPropagation();
        finish(e.key === 'Enter');
      }
    }
    document.addEventListener('keydown', onKeydown, true);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish(false);
    });

    confirmBtn.focus();
  });
}
