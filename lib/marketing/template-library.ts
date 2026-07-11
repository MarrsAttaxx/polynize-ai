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
    recipe: [
      'Open with the tension or objection the reader already feels, stated plainly. No throat-clearing.',
      'First line must earn the second: a contrarian or surprising claim, under 12 words if possible.',
      'Middle: 2-3 short paragraphs grounding the claim in the concept\'s proof or story. Concrete over abstract.',
      'Land on agency, not reassurance: what the reader can now see or do differently.',
      'Line breaks between thoughts. No hashtags unless the concept demands one. No emoji.',
    ].join('\n'),
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
    recipe: [
      'Structure: HOOK, then 3-5 BEATS, then CTA, then one final emphasis line (the last line always gets punched in the edit, so write one worth punching).',
      'Hook states the objection or surprise out loud, then flips it.',
      'Beats are spoken language: short sentences, no subclauses that die on camera.',
      'CTA is one action. Close with a single emphatic line after it.',
    ].join('\n'),
  },
];

export function getLibraryTemplate(id: string): LibraryTemplate | undefined {
  return LIBRARY_TEMPLATES.find((t) => t.template_id === id);
}

/** Ref format stored on pieces: stream templates use the storage key; library templates use `library:{id}`. */
export function libraryRef(id: string): string {
  return `library:${id}`;
}
