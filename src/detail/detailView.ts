import stampImageUrl from '../assets/stamp.jpg';
import { openMessagePickerForm } from '../forms/messagePickerForm';
import { isRedoShortcut, isUndoShortcut } from '../keyboardShortcuts';
import {
  getColumns,
  getLabels,
  getProjectMessage,
  getVotersForProject,
  moveVoter,
  setProjectMessage,
  toggleVoterLabel,
} from '../storage';
import { DONE_STAY, type Voter } from '../types';
import { contrastTextColor } from '../ui/color';
import { createLabelPicker } from '../ui/labelPicker';
import { showToast } from '../ui/toast';
import { attachTextTooltip, attachTooltip } from '../ui/tooltip';

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

export function openDetailView(voter: Voter, projectId: string, rerender: () => void): void {
  // Lets mobile-portrait CSS rotate toasts to match the detail view's own forced-landscape
  // rotation (see .overlay--detail), rather than having them land right-side-up on top of it.
  document.body.classList.add('detail-view-open');

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
  overlay.className = 'overlay overlay--detail';

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

  const postcardFrame = document.createElement('div');
  postcardFrame.className = 'postcard-frame';

  const postcard = document.createElement('div');
  postcard.className = 'postcard';
  postcardFrame.appendChild(postcard);

  // The entire left side (including its padding, not just the ruled-lines box)
  // is the clickable target — role/tabIndex/listeners live on `message` itself.
  const message = document.createElement('div');
  message.className = 'postcard__message';
  message.tabIndex = 0;
  message.setAttribute('role', 'button');
  message.setAttribute('aria-label', 'Edit postcard message');
  message.addEventListener('click', openPicker);
  message.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPicker();
    }
  });

  let currentMessage = getProjectMessage(projectId);

  function showMessageDisplay(): void {
    const display = document.createElement('div');
    display.className = 'postcard__message-display';

    let text: HTMLElement | null = null;
    if (currentMessage) {
      text = document.createElement('span');
      text.className = 'postcard__message-text';
      text.textContent = currentMessage;
      display.appendChild(text);
    } else {
      const placeholder = document.createElement('span');
      placeholder.className = 'postcard__message-placeholder';
      placeholder.textContent = 'Your message goes here. Click this text to customize!';
      display.appendChild(placeholder);
    }

    const stack = document.createElement('div');
    stack.className = 'postcard__message-stack';
    stack.appendChild(display);

    if (currentMessage) {
      // A sibling of the ruled-lines box, not inside it, so it always sits
      // right after the last line of text instead of occupying a ruled line
      // of its own.
      const hint = document.createElement('span');
      hint.className = 'postcard__message-hint';
      hint.setAttribute('aria-hidden', 'true');
      const hintIcon = document.createElement('span');
      hintIcon.className = 'material-symbols-outlined postcard__message-hint-icon';
      hintIcon.textContent = 'edit';
      hint.append(hintIcon, document.createTextNode('Click to customize'));
      stack.appendChild(hint);
    }

    message.replaceChildren(stack);

    // Sizes the ruled-lines box to exactly the number of lines this message's
    // text wraps to, so there's never leftover blank ruled lines (short
    // message) or an overflowing/truncated line (long message). Requires
    // `message` to be attached to the document to measure real wrapped
    // height — the very first call happens before that, so it's re-run once
    // the overlay is appended.
    if (text && display.isConnected) {
      const lineHeight = parseFloat(getComputedStyle(text).lineHeight);
      const lines = Math.max(1, Math.round(text.offsetHeight / lineHeight));
      display.style.height = `${lines * lineHeight}px`;
    }
  }

  function openPicker(): void {
    openMessagePickerForm(currentMessage, (newMessage) => {
      currentMessage = newMessage;
      setProjectMessage(projectId, newMessage);
      showMessageDisplay();
    });
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

  const labelsContent = document.createElement('div');
  labelsContent.className = 'detail-panel__labels detail-panel__footer-labels';

  let labelPickerOpen = false;

  function refreshLabels(): void {
    renderLabelsSection();
    rerender();
  }

  function renderLabelsSection(): void {
    labelsContent.replaceChildren();

    const allLabels = getLabels(projectId);
    for (const label of allLabels.filter((l) => voter.labelIds.includes(l.id))) {
      const badge = document.createElement('span');
      badge.className = 'label-badge';
      badge.style.backgroundColor = label.color;
      badge.style.color = contrastTextColor(label.color);

      const text = document.createElement('span');
      text.textContent = label.name;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'label-badge__remove';
      removeBtn.setAttribute('aria-label', `Remove label ${label.name}`);
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => {
        toggleVoterLabel(voter.id, label.id);
        voter = { ...voter, labelIds: voter.labelIds.filter((id) => id !== label.id) };
        renderLabelsSection();
        rerender();
      });

      badge.append(text, removeBtn);
      labelsContent.appendChild(badge);
    }

    const picker = createLabelPicker(
      '+ Label',
      projectId,
      (id) => voter.labelIds.includes(id),
      (id) => {
        const hasLabel = voter.labelIds.includes(id);
        toggleVoterLabel(voter.id, id);
        voter = {
          ...voter,
          labelIds: hasLabel ? voter.labelIds.filter((existing) => existing !== id) : [...voter.labelIds, id],
        };
        renderLabelsSection();
        rerender();
      },
      refreshLabels,
      {
        startOpen: labelPickerOpen,
        onOpenChange: (open) => {
          labelPickerOpen = open;
        },
        panelTitle: 'Apply labels to this voter',
        placement: 'above',
      },
    );
    labelsContent.appendChild(picker);
  }

  renderLabelsSection();

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
  footer.appendChild(labelsContent);

  const footerActions = document.createElement('div');
  footerActions.className = 'detail-panel__footer-actions';
  footer.appendChild(footerActions);

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
    footerActions.append(doneBtn);
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
    footerActions.append(advanceBtn);
  }

  panel.append(closeRow, postcardFrame, footer);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  // Re-run now that `message` is actually attached, so the message box's
  // dynamic line-count measurement reflects real layout instead of skipping
  // (see the isConnected check inside showMessageDisplay).
  showMessageDisplay();

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
    document.body.classList.remove('detail-view-open');
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
