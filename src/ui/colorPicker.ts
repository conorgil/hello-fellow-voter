import { LABEL_PRESET_COLORS } from './color';

export function createColorPicker(initialColor: string): { el: HTMLElement; getColor: () => string } {
  const wrap = document.createElement('div');
  wrap.className = 'color-swatch-grid';

  let selectedColor = initialColor;
  const isPreset = LABEL_PRESET_COLORS.includes(initialColor);
  const swatches: HTMLButtonElement[] = [];

  const customInput = document.createElement('input');
  customInput.type = 'color';
  customInput.className = 'color-swatch-grid__custom-input';
  customInput.value = isPreset ? LABEL_PRESET_COLORS[0] : initialColor;
  customInput.hidden = isPreset;

  const customSwatch = document.createElement('button');
  customSwatch.type = 'button';
  customSwatch.className = 'color-swatch color-swatch--custom';
  customSwatch.setAttribute('aria-label', 'Custom color');

  function selectColor(color: string, swatch: HTMLButtonElement): void {
    selectedColor = color;
    for (const s of swatches) s.classList.toggle('color-swatch--selected', s === swatch);
    customInput.hidden = swatch !== customSwatch;
  }

  for (const color of LABEL_PRESET_COLORS) {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'color-swatch';
    swatch.style.backgroundColor = color;
    swatch.setAttribute('aria-label', color);
    if (color === initialColor) swatch.classList.add('color-swatch--selected');
    swatch.addEventListener('click', () => selectColor(color, swatch));
    swatches.push(swatch);
    wrap.appendChild(swatch);
  }

  if (!isPreset) customSwatch.classList.add('color-swatch--selected');
  customSwatch.addEventListener('click', () => selectColor(customInput.value, customSwatch));
  swatches.push(customSwatch);
  wrap.appendChild(customSwatch);

  customInput.addEventListener('input', () => {
    selectedColor = customInput.value;
  });

  wrap.appendChild(customInput);

  return { el: wrap, getColor: () => selectedColor };
}
