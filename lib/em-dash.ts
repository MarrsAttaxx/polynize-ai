// Consume horizontal whitespace around the em-dash so "a — b" becomes "a, b"
// rather than "a ,  b". [ \t] (not \s) so a line-leading em-dash never swallows
// the preceding newline.
const EM_DASH = /[ \t]*—[ \t]*/g;

export function stripEmDashes(input: string): string {
  return input.replace(EM_DASH, ', ');
}

export const NO_EM_DASH_INSTRUCTION =
  'Never use the em-dash character (U+2014). Use a comma, a period, or a pair of commas instead. This is a strict brand voice rule.';
