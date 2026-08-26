/**
 * POST COPY IS PLAIN TEXT, NOT MARKDOWN.
 *
 * Marrs: "in the written pieces, don't use any star symbols for bolding because that doesn't work
 * here." His draft opened with `**The Future nobody Can See**`, asterisks and all.
 *
 * He is right in both places it matters. The console shows a draft in a textarea, which renders
 * nothing, and LinkedIn, Instagram, TikTok and YouTube captions have no rich text either: what
 * goes in the box is what people read. So `**bold**` is not formatting anywhere in this pipeline,
 * it is four stray characters wrapped around a headline.
 *
 * TWO HALVES, LIKE THE EM-DASH RULE, and for the same reason: the instruction stops most of it
 * and a model under a long prompt still reaches for a heading now and then, so the strip is what
 * makes it never reach a post. Belt and braces on the way out is cheaper than noticing later.
 *
 * WHAT THIS MUST NOT TOUCH. Two things in this codebase use markdown on purpose:
 *
 * 1. Concept docs (`body_md`), which are freeform Markdown by design and are read by April rather
 *    than posted.
 * 2. The slide grammar, where a phrase wrapped in *single asterisks* means "set this in the brand
 *    accent" and is parsed by `parseLine` in text-overlay.tsx.
 *
 * So this is applied at the POST COPY boundaries only: the draft writer, the article writer, and
 * April's chat edits to a draft. It is deliberately NOT in `lib/llm/index.ts` next to the em-dash
 * instruction, because that appends to every system prompt in the app and would tell the concept
 * writer to stop writing markdown.
 */

/**
 * The emphasis markers, longest first so `***both***` is not left holding a stray asterisk.
 *
 * The content is required to start and end with a non-space character, which is what keeps
 * arithmetic and stray punctuation intact: "5 * 3 * 2" has a space after its first asterisk, so
 * it does not match. `[^*\n]` keeps every match inside one line, so a line-leading bullet with no
 * partner on its own line cannot pair up with one three lines down.
 */
const EMPHASIS: [RegExp, string][] = [
  [/\*\*\*(?!\s)([^*\n]*[^*\s])\*\*\*/g, '$1'],
  [/\*\*(?!\s)([^*\n]*[^*\s])\*\*/g, '$1'],
  [/\*(?!\s)([^*\n]*[^*\s])\*/g, '$1'],
  [/___(?!\s)([^_\n]*[^_\s])___/g, '$1'],
  [/__(?!\s)([^_\n]*[^_\s])__/g, '$1'],
  /**
   * Single underscores need word boundaries or `hero_url` loses its middle. Markdown itself has
   * the same rule for the same reason.
   */
  [/(?<![\w*_])_(?!\s)([^_\n]*[^_\s])_(?![\w*_])/g, '$1'],
];

/** A heading marker at the start of a line. The words stay, the hashes go. */
const HEADING = /^[ \t]{0,3}#{1,6}[ \t]+/gm;

/**
 * Strip markdown emphasis and heading marks from copy that will be read as plain text.
 *
 * Only the markers are removed and never the words, so this is safe to run on anything: on copy
 * that never had a marker in it, it is the identity function.
 */
export function stripMarkdownEmphasis(input: string): string {
  let out = input.replace(HEADING, '');
  for (const [rx, to] of EMPHASIS) out = out.replace(rx, to);
  return out;
}

export const NO_MARKDOWN_INSTRUCTION =
  'Write plain text, never markdown. No asterisks for bold or italics, no underscores for ' +
  'emphasis, no # headings, no backticks. The words go into a post box that shows every ' +
  'character literally, so **like this** posts the asterisks. To give a line weight, put it on ' +
  'its own line, or use CAPS for a single short label. This is a strict rule.';
