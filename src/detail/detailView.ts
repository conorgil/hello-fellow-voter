import stampImageUrl from '../assets/stamp.jpg';
import { isRedoShortcut, isUndoShortcut } from '../keyboardShortcuts';
import { getColumns, getProjectMessage, getVotersForProject, moveVoter, setProjectMessage } from '../storage';
import { DONE_STAY, type Voter } from '../types';
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

function attachTooltipElement(el: HTMLElement, tooltip: HTMLElement, delayMs: number, placement: 'below' | 'above'): void {
  tooltip.className = placement === 'above' ? 'tooltip tooltip--above' : 'tooltip';
  tooltip.hidden = true;
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

function attachTooltip(el: HTMLElement, html: string, ariaLabel: string, delayMs: number): void {
  el.setAttribute('aria-label', ariaLabel);
  const tooltip = document.createElement('div');
  tooltip.innerHTML = html;
  attachTooltipElement(el, tooltip, delayMs, 'below');
}

/** Like `attachTooltip`, but for a button that already has its own visible label/aria-label — leaves it untouched. */
function attachTextTooltip(el: HTMLElement, text: string, delayMs: number, placement: 'below' | 'above' = 'below'): void {
  const tooltip = document.createElement('div');
  tooltip.textContent = text;
  attachTooltipElement(el, tooltip, delayMs, placement);
}

export function openDetailView(voter: Voter, projectId: string, rerender: () => void): void {
  const columns = getColumns(projectId);
  const openingColumn = columns.find((c) => c.id === voter.status);
  const onOpenTargetColumn = openingColumn?.automation.onOpenMoveTo
    ? columns.find((c) => c.id === openingColumn.automation.onOpenMoveTo)
    : undefined;

  if (onOpenTargetColumn) {
    moveVoter(voter.id, onOpenTargetColumn.id, null);
    voter = { ...voter, status: onOpenTargetColumn.id };
    showToast(`Moved ${voter.name} to the ${onOpenTargetColumn.label} column`, 'success');
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
  attachTextTooltip(closeBtn, 'Closes address view without any automations', 400);

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

  // Governed by the column the voter was opened from, not where an onOpen bump
  // may have just landed them — so a column's own Done/Next-voter settings
  // apply to voters that started there, instead of being silently superseded
  // by whatever they get auto-moved into.
  const automation = openingColumn?.automation;
  const doneStaysInPlace = automation?.doneMoveTo === DONE_STAY;
  const doneTargetColumn =
    automation?.doneMoveTo && automation.doneMoveTo !== DONE_STAY
      ? columns.find((c) => c.id === automation.doneMoveTo)
      : undefined;
  const nextTargetColumn = automation?.nextVoterMoveTo
    ? columns.find((c) => c.id === automation.nextVoterMoveTo)
    : undefined;

  const pullFromColumn = automation?.pullFrom ? columns.find((c) => c.id === automation.pullFrom) : undefined;
  const pullToColumn = automation?.pullTo ? columns.find((c) => c.id === automation.pullTo) : undefined;
  const pullCandidate =
    pullFromColumn && pullToColumn
      ? getVotersForProject(projectId)
          .filter((v) => v.status === pullFromColumn.id && v.id !== voter.id)
          .sort((a, b) => a.order - b.order)[0]
      : undefined;

  const displayFromColumn = automation?.displayNextFrom ? columns.find((c) => c.id === automation.displayNextFrom) : undefined;
  const existingDisplayCandidate = displayFromColumn
    ? getVotersForProject(projectId)
        .filter((v) => v.status === displayFromColumn.id && v.id !== voter.id)
        .sort((a, b) => a.order - b.order)[0]
    : undefined;
  // If the move step is about to land a voter into the very column we're
  // displaying from, and nobody's already waiting there, that pulled voter is
  // who ends up shown next.
  const displayCandidate =
    existingDisplayCandidate ?? (pullToColumn?.id === displayFromColumn?.id ? pullCandidate : undefined);
  // When the automation is configured to auto-display the next voter from a
  // column and that column has nobody left, the voter being viewed is already
  // the last one — showing a "Next voter" button would just advance into an
  // empty queue with nothing to open next, so hide it and leave only Done.
  const displayQueueEmpty = !!displayFromColumn && !displayCandidate;

  const footer = document.createElement('div');
  footer.className = 'detail-panel__footer';

  if (doneStaysInPlace || doneTargetColumn) {
    const doneBtn = document.createElement('button');
    doneBtn.className = 'btn btn--secondary detail-panel__advance';
    doneBtn.textContent = 'Done';
    const doneTooltip = doneTargetColumn
      ? `Moves ${voter.name} to ${doneTargetColumn.label} and closes address view`
      : `Closes address view without moving ${voter.name}`;
    attachTextTooltip(doneBtn, doneTooltip, 400, 'above');
    doneBtn.addEventListener('click', () => {
      if (doneTargetColumn) {
        moveVoter(voter.id, doneTargetColumn.id, null);
        showToast(`Moved ${voter.name} to the ${doneTargetColumn.label} column`, 'success');
      }
      close();
      rerender();
    });
    footer.append(doneBtn);
  }

  if (nextTargetColumn && !displayQueueEmpty) {
    const advanceBtn = document.createElement('button');
    advanceBtn.className = 'btn btn--primary detail-panel__advance';
    advanceBtn.textContent = 'Next voter';
    let nextTooltip = `Moves ${voter.name} to ${nextTargetColumn.label}`;
    if (pullCandidate && pullFromColumn && pullToColumn) {
      nextTooltip += ` and ${pullCandidate.name} from ${pullFromColumn.label} to ${pullToColumn.label}`;
    }
    if (displayCandidate && displayFromColumn && displayCandidate.id !== pullCandidate?.id) {
      nextTooltip += `, then shows ${displayCandidate.name} from ${displayFromColumn.label}`;
    }
    attachTextTooltip(advanceBtn, nextTooltip, 400, 'above');
    advanceBtn.addEventListener('click', goToNextVoter);
    footer.append(advanceBtn);
  }

  panel.append(closeRow, postcard, footer);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  shrinkLinesToFit([nameLine, streetLine, cityLine]);

  function goToNextVoter(): void {
    if (!nextTargetColumn) return;

    moveVoter(voter.id, nextTargetColumn.id, null);
    showToast(`Moved previous voter (${voter.name}) to the ${nextTargetColumn.label} column`, 'success');

    if (pullCandidate && pullToColumn) {
      moveVoter(pullCandidate.id, pullToColumn.id, null);
    }

    close();
    rerender();

    if (displayFromColumn) {
      const nextToShow = getVotersForProject(projectId)
        .filter((v) => v.status === displayFromColumn.id && v.id !== voter.id)
        .sort((a, b) => a.order - b.order)[0];
      if (nextToShow) openDetailView(nextToShow, projectId, rerender);
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
