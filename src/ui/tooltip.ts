function attachTooltipElement(
  el: HTMLElement,
  tooltip: HTMLElement,
  delayMs: number,
  placement: 'below' | 'above',
  align: 'left' | 'right',
): void {
  const classes = ['tooltip'];
  if (placement === 'above') classes.push('tooltip--above');
  if (align === 'left') classes.push('tooltip--left');
  tooltip.className = classes.join(' ');
  tooltip.hidden = true;
  el.appendChild(tooltip);

  let showTimer: ReturnType<typeof setTimeout> | undefined;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  function show(): void {
    clearTimeout(hideTimer);
    showTimer = setTimeout(() => {
      tooltip.hidden = false;
    }, delayMs);
  }

  // Hiding after a short delay, rather than the instant the pointer leaves
  // `el`, gives the cursor time to cross the tooltip's own margin gap (the CSS
  // offset that separates it from `el`) and land on the tooltip itself —
  // needed to click a link inside a tooltip (e.g. the stamp tooltip) without
  // it vanishing first. Re-entering either `el` or the tooltip cancels it.
  function scheduleHide(): void {
    clearTimeout(showTimer);
    hideTimer = setTimeout(() => {
      tooltip.hidden = true;
    }, 150);
  }

  el.addEventListener('mouseenter', show);
  el.addEventListener('mouseleave', scheduleHide);
  tooltip.addEventListener('mouseenter', () => clearTimeout(hideTimer));
  tooltip.addEventListener('mouseleave', scheduleHide);
}

export function attachTooltip(el: HTMLElement, html: string, ariaLabel: string, delayMs: number): void {
  el.setAttribute('aria-label', ariaLabel);
  const tooltip = document.createElement('div');
  tooltip.innerHTML = html;
  attachTooltipElement(el, tooltip, delayMs, 'below', 'right');
}

/** Like `attachTooltip`, but for a button that already has its own visible label/aria-label — leaves it untouched. */
export function attachTextTooltip(
  el: HTMLElement,
  text: string,
  delayMs: number,
  placement: 'below' | 'above' = 'below',
  // 'right' anchors the tooltip's right edge to the element's right edge (grows
  // leftward) — right for elements near the right side of the screen. Elements
  // near the left side (e.g. the project title) need 'left' so the tooltip
  // grows rightward instead of overflowing off the left edge of the viewport.
  align: 'left' | 'right' = 'right',
): void {
  const tooltip = document.createElement('div');
  tooltip.textContent = text;
  attachTooltipElement(el, tooltip, delayMs, placement, align);
}
