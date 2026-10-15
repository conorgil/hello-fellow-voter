export interface MessageFontOption {
  id: string;
  label: string;
  /** CSS font-family value, including a cursive fallback. */
  fontFamily: string;
}

export const MESSAGE_FONTS: MessageFontOption[] = [
  { id: 'patrick-hand', label: 'Patrick Hand', fontFamily: "'Patrick Hand', cursive" },
  { id: 'architects-daughter', label: 'Architects Daughter', fontFamily: "'Architects Daughter', cursive" },
  { id: 'caveat', label: 'Caveat', fontFamily: "'Caveat', cursive" },
  { id: 'kalam', label: 'Kalam', fontFamily: "'Kalam', cursive" },
  { id: 'gochi-hand', label: 'Gochi Hand', fontFamily: "'Gochi Hand', cursive" },
];

export const DEFAULT_MESSAGE_FONT = MESSAGE_FONTS[0].id;

export function getFontFamily(fontId: string): string {
  return MESSAGE_FONTS.find((f) => f.id === fontId)?.fontFamily ?? MESSAGE_FONTS[0].fontFamily;
}
