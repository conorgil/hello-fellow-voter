const KEEP_UPPER_TOKENS = new Set(['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW', 'PO']);
const ORDINAL_SUFFIX = /^(\d+)(ST|ND|RD|TH)$/i;

function titleCaseToken(token: string): string {
  if (!token) return token;
  const ordinal = ORDINAL_SUFFIX.exec(token);
  if (ordinal) return ordinal[1] + ordinal[2].toLowerCase();
  if (/\d/.test(token)) return token;
  const upper = token.toUpperCase();
  if (KEEP_UPPER_TOKENS.has(upper)) return upper;
  return token.replace(/[A-Za-z]+/g, (seg) => seg[0].toUpperCase() + seg.slice(1).toLowerCase());
}

/**
 * Formats ALL-CAPS (or any-case) name/address text as Title Case for display —
 * county voter files and tools like Vote Forward/Signs of Justice commonly
 * export in ALL CAPS. Leaves directional abbreviations (N/S/E/W/NE/NW/SE/SW),
 * "PO", and ordinal suffixes (1st/2nd/3rd...) uppercase/lowercase as
 * conventional, and any token containing a digit (unit/apartment numbers)
 * untouched.
 *
 * Display-only: never apply this to a value before storing it. Voter records
 * keep their exact original casing so the app's own HFV-EXPORT-V1 export/
 * re-import round trip stays byte-for-byte faithful.
 */
export function titleCase(value: string): string {
  return value.split(' ').map(titleCaseToken).join(' ');
}
