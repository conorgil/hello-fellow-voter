import { createProject } from '../storage';

export function openNewProjectForm(rerender: () => void): void {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';

  const panel = document.createElement('div');
  panel.className = 'panel form-panel';

  const title = document.createElement('h2');
  title.textContent = 'New project';

  const hint = document.createElement('p');
  hint.className = 'form-hint';
  hint.textContent = 'Projects are a way to organize your voter lists. You can name a project anything you want, create multiple projects, and switch between projects anytime.';

  const form = document.createElement('form');

  const field = document.createElement('label');
  field.className = 'form-field';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.required = true;
  field.append(nameInput);

  const errorText = document.createElement('p');
  errorText.className = 'form-error';
  errorText.hidden = true;

  const actions = document.createElement('div');
  actions.className = 'form-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn--secondary';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', close);

  const createBtn = document.createElement('button');
  createBtn.type = 'submit';
  createBtn.className = 'btn btn--primary';
  createBtn.textContent = 'Create';

  actions.append(cancelBtn, createBtn);

  // Cancel/Create live outside this scrollable area so they stay visible even
  // when the content overflows the panel's max height.
  const scrollArea = document.createElement('div');
  scrollArea.className = 'form-panel__scroll';
  scrollArea.append(title, hint, field, errorText);

  form.append(scrollArea, actions);
  panel.append(form);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

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
    const name = nameInput.value.trim();
    if (!name) return;
    const project = createProject(name);
    if (!project) {
      errorText.textContent = 'A project with this name already exists.';
      errorText.hidden = false;
      return;
    }
    close();
    rerender();
  });

  nameInput.focus();
}
