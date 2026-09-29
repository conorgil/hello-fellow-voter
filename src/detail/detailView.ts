import stampImageUrl from '../assets/stamp.jpg';
import { isRedoShortcut, isUndoShortcut } from '../keyboardShortcuts';
import { getColumns, getProjectMessage, getVotersForProject, moveVoter, setProjectMessage } from '../storage';
import type { Voter } from '../types';
import { showToast } from '../ui/toast';

/**
 * Shrinks every line to the same font size — the smallest size that keeps the
 * longest-overflowing line on one line — so the three address lines never
 * appear at mismatched sizes.
 */
function shrinkLinesToFit(lines: HTMLElement[]): void {
  const scales = lines.map((line) =>
    line.scrollWidth <= line.clientWidth ? 1 : (line.clientWidth / line.scrollWidth) * 0.97,
  );
  const minScale = Math.min(...scales);
  if (minScale >= 1) return;

  const baseFontSize = parseFloat(getComputedStyle(lines[0]).fontSize);
  const fittedFontSize = `${baseFontSize * minScale}px`;
  for (const line of lines) {
    line.style.fontSize = fittedFontSize;
  }
}

function attachTooltip(el: HTMLElement, html: string, ariaLabel: string, delayMs: number): void {
  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip';
  tooltip.innerHTML = html;
  tooltip.hidden = true;
  el.setAttribute('aria-label', ariaLabel);
  el.appendChild(tooltip);

  let timer: ReturnType<typeof setTimeout> | undefined;

  el.addEventListener('mouseenter', () => {
    timer = setTimeout(() => {
      tooltip.hidden = false;
    }, delayMs);
  });

  el.addEventListener('mouseleave', () => {
    clearTimeout(timer);
    tooltip.hidden = true;
  });
}

export function openDetailView(voter: Voter, projectId: string, rerender: () => void): void {
  const columns = getColumns(projectId);
  const firstColumn = columns[0];
  const secondColumn = columns[1];
  const thirdColumn = columns[2];

  if (firstColumn && secondColumn && voter.status === firstColumn.id) {
    moveVoter(voter.id, secondColumn.id, null);
    voter = { ...voter, status: secondColumn.id };
    showToast(`Moved ${voter.name} to the ${secondColumn.label} column`, 'success');
    rerender();
  }

  const overlay = document.createElement('div');
  overlay.className = 'overlay';

  const panel = document.createElement('div');
  panel.className = 'panel detail-panel';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'detail-panel__close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', close);

  const closeRow = document.createElement('div');
  closeRow.className = 'detail-panel__close-row';
  closeRow.appendChild(closeBtn);

  const postcard = document.createElement('div');
  postcard.className = 'postcard';

  const message = document.createElement('div');
  message.className = 'postcard__message';

  let currentMessage = getProjectMessage(projectId);

  function showMessageDisplay(): void {
    // A real <button> vertically centers its content via Chromium's internal
    // layout for button elements, which can't be overridden with CSS on the
    // button itself — use a div+role="button" instead, matching the voter-card
    // clickable-area pattern in src/board/voter.ts.
    const clickable = document.createElement('div');
    clickable.className = 'postcard__message-display';
    clickable.tabIndex = 0;
    clickable.setAttribute('role', 'button');
    clickable.setAttribute('aria-label', 'Edit postcard message');

    if (currentMessage) {
      const text = document.createElement('span');
      text.className = 'postcard__message-text';
      text.textContent = currentMessage;
      clickable.appendChild(text);
    } else {
      const placeholder = document.createElement('span');
      placeholder.className = 'postcard__message-placeholder';
      placeholder.textContent = 'Your message goes here. Click this text to customize!';
      clickable.appendChild(placeholder);
    }

    clickable.addEventListener('click', showMessageEditor);
    clickable.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showMessageEditor();
      }
    });
    message.replaceChildren(clickable);
  }

  function showMessageEditor(): void {
    const form = document.createElement('form');
    const textarea = document.createElement('textarea');
    textarea.className = 'postcard__message-textarea';
    textarea.value = currentMessage;
    textarea.maxLength = 500;
    form.appendChild(textarea);
    message.replaceChildren(form);

    let cancelled = false;

    function commit(): void {
      currentMessage = textarea.value.trim();
      setProjectMessage(projectId, currentMessage);
      showMessageDisplay();
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      commit();
    });

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        cancelled = true;
        showMessageDisplay();
      }
    });

    textarea.addEventListener('blur', () => {
      if (cancelled) return;
      commit();
    });

    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }

  showMessageDisplay();

  const right = document.createElement('div');
  right.className = 'postcard__right';

  const stamp = document.createElement('div');
  stamp.className = 'postcard__stamp';
  const stampImg = document.createElement('img');
  stampImg.className = 'postcard__stamp-img';
  stampImg.src = stampImageUrl;
  stampImg.alt = 'Stamp';
  stamp.appendChild(stampImg);
  attachTooltip(
    stamp,
    'This is where the stamp goes. To save money, make sure to buy a <strong>postcard stamp</strong> ($0.65) instead of a normal letter stamp ($0.82). You can buy postcard stamps at the post office or online at <a href="https://store.usps.com/store/stamps/postcard/_/N-16jpffz" target="_blank" rel="noopener noreferrer">usps.com</a>.',
    'This is where the stamp goes. To save money, buy a postcard stamp instead of a normal letter stamp.',
    1000,
  );

  const address = document.createElement('div');
  address.className = 'postcard-address';

  const nameLine = document.createElement('div');
  nameLine.className = 'postcard-address__line';
  nameLine.textContent = voter.name;

  const streetLine = document.createElement('div');
  streetLine.className = 'postcard-address__line';
  streetLine.textContent = voter.street;

  const cityLine = document.createElement('div');
  cityLine.className = 'postcard-address__line';
  cityLine.textContent = `${voter.city}, ${voter.state} ${voter.zip}`;

  address.append(nameLine, streetLine, cityLine);
  right.append(stamp, address);
  postcard.append(message, right);

  const columnIndex = columns.findIndex((c) => c.id === voter.status);
  const isLast = columnIndex === -1 || columnIndex === columns.length - 1;

  const footer = document.createElement('div');
  footer.className = 'detail-panel__footer';

  if (secondColumn && thirdColumn && voter.status === secondColumn.id) {
    const doneBtn = document.createElement('button');
    doneBtn.className = 'btn btn--secondary detail-panel__advance';
    doneBtn.textContent = 'Done';
    doneBtn.addEventListener('click', () => {
      moveVoter(voter.id, thirdColumn.id, null);
      close();
      rerender();
    });
    footer.append(doneBtn);
  }

  const advanceBtn = document.createElement('button');
  advanceBtn.className = 'btn btn--primary detail-panel__advance';
  advanceBtn.textContent = 'Next voter';
  advanceBtn.disabled = isLast;
  advanceBtn.addEventListener('click', goToNextVoter);
  footer.append(advanceBtn);

  panel.append(closeRow, postcard, footer);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  shrinkLinesToFit([nameLine, streetLine, cityLine]);

  function goToNextVoter(): void {
    if (isLast) return;
    const originalStatus = voter.status;
    const nextColumn = columns[columnIndex + 1];
    moveVoter(voter.id, nextColumn.id, null);
    showToast(`Moved previous voter (${voter.name}) to the ${nextColumn.label} column`, 'success');

    // Only the todo/writing stage auto-pulls in the next voter; later
    // stages (stamping, mailing) just advance the current voter.
    const isWritingStage =
      !!firstColumn && !!secondColumn && (originalStatus === firstColumn.id || originalStatus === secondColumn.id);

    const nextVoter =
      isWritingStage && firstColumn
        ? getVotersForProject(projectId)
            .filter((v) => v.status === firstColumn.id && v.id !== voter.id)
            .sort((a, b) => a.order - b.order)[0]
        : undefined;

    if (nextVoter && secondColumn) {
      moveVoter(nextVoter.id, secondColumn.id, null);
    }

    close();
    rerender();

    if (nextVoter) {
      const updatedNextVoter = getVotersForProject(projectId).find((v) => v.id === nextVoter.id);
      if (updatedNextVoter) openDetailView(updatedNextVoter, projectId, rerender);
    }
  }

  function close(): void {
    overlay.remove();
    document.removeEventListener('keydown', onKeydown);
  }

  function onKeydown(e: KeyboardEvent): void {
    const active = document.activeElement;
    if (active instanceof HTMLTextAreaElement && panel.contains(active)) return;

    // The global undo/redo shortcut (main.ts) has already mutated storage by the
    // time this listener runs (it was registered first), but it only re-renders
    // the board underneath — this modal is a standalone overlay, so its message
    // display needs its own refresh to pick up the reverted/reapplied value.
    if (isUndoShortcut(e) || isRedoShortcut(e)) {
      currentMessage = getProjectMessage(projectId);
      showMessageDisplay();
    }

    if (e.key === 'Escape') {
      close();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      goToNextVoter();
    }
  }
  document.addEventListener('keydown', onKeydown);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  closeBtn.focus();
}
