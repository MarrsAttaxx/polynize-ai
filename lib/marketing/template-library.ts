/**
 * The built-in starter template library (D25). Templates any stream can use
 * directly or copy into its own library and refine. Curated over time (proven
 * formats graduate in; flops go). Referenced on a piece as `library:{id}`.
 *
 * Only templates whose format module is BUILT should be `active`; video-heavy
 * templates that depend on the unbuilt edit middle stay `developing` so the
 * picker is honest about what one-shots today.
 */

import type { ContentTemplate } from './template-store';

/** A library template is a template without a home stream. */
export type LibraryTemplate = Omit<ContentTemplate, 'stream' | 'created_at' | 'updated_at'>;

export const LIBRARY_TEMPLATES: LibraryTemplate[] = [
  {
    template_id: 'linkedin-insight-post',
    name: 'LinkedIn insight post',
    description:
      'A sharp thought-leadership post from a core concept: contrarian open, concrete middle, one clear landing point.',
    status: 'active',
    format: 'linkedin_text',
    platforms: ['linkedin'],
    inputs: 'A core concept (nothing else).',
    outputs: 'One LinkedIn post in the stream voice, ready to queue.',
    hook_recipe: [
      'Line 1: state the belief or objection the reader already holds, plainly, as if you agree with it.',
      'Line 2: flip it. A contrarian or surprising claim, under 12 words, that earns the next line.',
    ].join('\n'),
    recipe: [
      '2 to 3 short paragraphs grounding the flip in the concept\'s actual proof or story. Concrete over abstract.',
      'One idea per line break. No hashtags unless the concept demands one. No emoji.',
    ].join('\n'),
    cta_recipe:
      'Land on agency, not reassurance: one line on what the reader can now see or do differently. A challenge or a question, never a summary.',
    length: 'A standard in-depth post is 150 to 250 words. Cut any line that does not earn its place.',
    example: 'See the "Strip the AI out first" LinkedIn post.',
  },
  {
    template_id: 'short-form-script',
    name: 'Short-form video script',
    description:
      'A HOOK / BEATS / CTA script for a talking-head vertical video, written to be read on the teleprompter.',
    status: 'active',
    format: 'short_form_video',
    platforms: ['instagram', 'tiktok', 'youtube', 'linkedin'],
    inputs: 'A core concept; you record the script on camera.',
    outputs: 'A teleprompter-ready script (recording and edit follow the video pipeline).',
    hook_recipe: [
      'Spoken hook (first breath): state the objection or surprise out loud, then flip it.',
      'On-screen text hook: a different, punchier line that stops the scroll, in different words from the spoken hook.',
    ].join('\n'),
    recipe: [
      '3 to 5 BEATS in spoken language: short sentences, no subclauses that die on camera.',
      'Each beat carries one concrete point from the concept.',
    ].join('\n'),
    cta_recipe:
      'One clear action, then a single emphatic final line worth punching (the last line always gets the emphasis in the edit).',
    length: 'Aim for 45 to 90 seconds spoken (roughly 120 to 220 words). Never over 3 minutes.',
  },
];

export function getLibraryTemplate(id: string): LibraryTemplate | undefined {
  return LIBRARY_TEMPLATES.find((t) => t.template_id === id);
}

/** Ref format stored on pieces: stream templates use the storage key; library templates use `library:{id}`. */
export function libraryRef(id: string): string {
  return `library:${id}`;
}
