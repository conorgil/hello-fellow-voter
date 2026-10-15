export interface MessagePreset {
  id: 'A' | 'B' | 'C';
  label: string;
  text: string;
}

export const MESSAGE_PRESETS: MessagePreset[] = [
  {
    id: 'A',
    label: 'Most effective',
    text: 'Thank you for being a voter! Who you vote for is private, but whether you vote is public record. Please vote in the Tues. Nov 3 election!\n- [Your Name]',
  },
  {
    id: 'B',
    label: 'Plan-making',
    text: 'Thank you for being a voter! When will you vote in the Tues. Nov 3 election? Please plan ahead!\n- [Your Name]',
  },
  {
    id: 'C',
    label: 'Friends-and-family',
    text: 'Thank you for being a voter! Your friends and family may need your reminder to vote. Please ask them to vote in the Tues. Nov 3 election!\n- [Your Name]',
  },
];

export const DEFAULT_MESSAGE = MESSAGE_PRESETS[0].text;

/** A message counts as "custom" when it's non-empty and doesn't exactly match any preset. */
export function isCustomMessage(message: string): boolean {
  return message.trim() !== '' && !MESSAGE_PRESETS.some((p) => p.text === message);
}
