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

export function attachTooltip(el: HTMLElement, html: string, ariaLabel: string, delayMs: number): void {
  el.setAttribute('aria-label', ariaLabel);
  const tooltip = document.createElement('div');
  tooltip.innerHTML = html;
  attachTooltipElement(el, tooltip, delayMs, 'below');
}

/** Like `attachTooltip`, but for a button that already has its own visible label/aria-label — leaves it untouched. */
export function attachTextTooltip(
  el: HTMLElement,
  text: string,
  delayMs: number,
  placement: 'below' | 'above' = 'below',
): void {
  const tooltip = document.createElement('div');
  tooltip.textContent = text;
  attachTooltipElement(el, tooltip, delayMs, placement);
}
