/** Curated preset palette for labels, spanning the hue wheel. Reuses the app's semantic colors where they fit. */
export const LABEL_PRESET_COLORS: string[] = [
  '#d73a4a', // red (--color-danger)
  '#fb8c00', // orange
  '#fbca04', // yellow
  '#2da44e', // green (--color-success)
  '#0969da', // blue (--color-primary)
  '#8250df', // purple
  '#bf3989', // pink
  '#6e7781', // gray
];

/** Picks black or white text for readable contrast against an arbitrary background color, via YIQ luminance. */
export function contrastTextColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#000000' : '#ffffff';
}
