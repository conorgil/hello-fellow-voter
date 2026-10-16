import './style.css';
import { renderBoardView } from './board/render';
import { clearSelection, getSelectedCount } from './board/selection';
import { isRedoShortcut, isUndoShortcut } from './keyboardShortcuts';
import { renderProjectList } from './projects/projectListView';
import { isSplashPermanentlyDismissed } from './splash/splashPrefs';
import { openSplash } from './splash/splashView';
import { getActiveProject, redo, undo } from './storage';
import { attachTextTooltip } from './ui/tooltip';

const app: HTMLDivElement =
  document.querySelector<HTMLDivElement>('#app') ??
  (() => {
    throw new Error('#app root element not found');
  })();

function render(): void {
  const board = app.querySelector<HTMLElement>('.board');
  const scrollLeft = board?.scrollLeft ?? 0;
  const columnScrollTops = new Map<string, number>();
  if (board) {
    for (const col of board.querySelectorAll<HTMLElement>('.column')) {
      const body = col.querySelector<HTMLElement>('.column__body');
      if (col.dataset.columnId && body) {
        columnScrollTops.set(col.dataset.columnId, body.scrollTop);
      }
    }
  }

  app.innerHTML = '';
  const activeProject = getActiveProject();
  if (!activeProject) {
    renderProjectList(app, render);
  } else {
    renderBoardView(app, activeProject, render);
  }

  const newBoard = app.querySelector<HTMLElement>('.board');
  if (newBoard) {
    newBoard.scrollLeft = scrollLeft;
    for (const col of newBoard.querySelectorAll<HTMLElement>('.column')) {
      const body = col.querySelector<HTMLElement>('.column__body');
      const savedTop = col.dataset.columnId ? columnScrollTops.get(col.dataset.columnId) : undefined;
      if (body && savedTop !== undefined) body.scrollTop = savedTop;
    }
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && getSelectedCount() > 0) {
    clearSelection();
    render();
    return;
  }

  const isUndo = isUndoShortcut(e);
  const isRedo = isRedoShortcut(e);
  if (!isUndo && !isRedo) return;

  const target = e.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
  e.preventDefault();

  const applied = isUndo ? undo() : redo();
  if (applied) {
    clearSelection();
    render();
  }
});

render();

const ghCorner = document.querySelector<HTMLAnchorElement>('.gh-corner');
if (ghCorner) {
  attachTextTooltip(ghCorner, 'This tool is open-source! Check out the code on GitHub.', 400);
}

if (!isSplashPermanentlyDismissed()) {
  openSplash();
}
