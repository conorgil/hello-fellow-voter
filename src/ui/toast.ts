export type ToastKind = 'success' | 'error';

function getToastContainer(): HTMLElement {
  let container = document.querySelector<HTMLElement>('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message: string, kind: ToastKind): void {
  const toast = document.createElement('div');
  toast.className = `toast toast--${kind}`;
  toast.setAttribute('role', 'status');
  toast.textContent = message;

  const close = document.createElement('button');
  close.className = 'toast__close';
  close.setAttribute('aria-label', 'Dismiss');
  close.textContent = '×';
  close.addEventListener('click', () => toast.remove());
  toast.appendChild(close);

  getToastContainer().appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
