import type { AddressViewMode } from './types';

export const MIN_ADDRESS_FONT_SIZE = 2; // rem
export const MAX_ADDRESS_FONT_SIZE = 5; // rem — any larger and a wrapped line can overflow the panel on common laptop screen heights
export const DEFAULT_ADDRESS_FONT_SIZE = 4; // rem — matches today's postcard-address__line max

export const DEFAULT_ADDRESS_VIEW_MODE: AddressViewMode = 'postcard';

export function clampAddressFontSize(size: number): number {
  return Math.min(MAX_ADDRESS_FONT_SIZE, Math.max(MIN_ADDRESS_FONT_SIZE, size));
}
