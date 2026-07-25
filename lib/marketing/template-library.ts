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
  {
    // The 9:16 hero (D29): one idea, made visual on the touchscreen, in one setup.
    template_id: 'touchscreen-concept-flip',
    name: 'Concept flip (split-screen short)',
    description:
      'The 9:16 hero format: one counter-intuitive idea, proved on the touchscreen. You up top, the screen below, the visual turning as you talk.',
    status: 'active',
    format: 'split_screen_short',
    platforms: ['instagram', 'tiktok', 'youtube', 'linkedin'],
    inputs: 'A core concept with one sharp idea (and a number or a real moment if it has one).',
    outputs:
      'A two-track script: the words to camera plus the screen brief per beat (what is shown, what the touch does).',
    hook_recipe: [
      'Spoken hook: name the belief the viewer already holds, flatly, as if you agree. Under 12 words.',
      'On-screen text hook: the flip, in different words from the spoken hook, so the two together open a gap.',
      'Screen at the hook: the belief written as ONE bold word or phrase, nothing else on the screen yet.',
    ].join('\n'),
    recipe: [
      '3 to 4 beats, one idea each, and the screen changes on every beat.',
      'Beat 1 flips the belief with a single sharp claim; the touch breaks the hook visual apart to match the flip.',
      'Middle beats prove the flip with the concept\'s own example or number; the screen shows that number or a simple two-part diagram, revealed by touch, never a bullet list.',
      'Last beat lands what the viewer can now see differently; the screen resolves to the one phrase you want remembered.',
    ].join('\n'),
    cta_recipe:
      'One line on what to do or notice next, not a summary. Then one short emphatic line worth punching, with the screen holding the final phrase.',
    length:
      'Aim for 45 to 75 seconds spoken (roughly 120 to 190 words). Never over 90 seconds.',
  },
  {
    // The 16:9 hero (D29): depth, told through the screen.
    template_id: 'touchscreen-walkthrough',
    name: 'Walkthrough (screen-record long)',
    description:
      'The 16:9 hero format: open to camera, then work the idea through on the screen with your head in the corner. For depth and authority.',
    status: 'active',
    format: 'screen_record_long',
    platforms: ['youtube', 'linkedin'],
    inputs: 'A core concept with enough substance to develop over several minutes.',
    outputs:
      'A two-track script: the full-screen intro, then each screen section with its spoken lines and screen brief.',
    hook_recipe: [
      'Intro, full screen to camera, no screen visual: open on the problem the viewer is living with, in one or two lines.',
      'Then state plainly what they will be able to do or see by the end. No preamble about yourself, no "in this video".',
    ].join('\n'),
    recipe: [
      '3 to 5 sections, each one step of the argument, each with its own screen visual.',
      'Build the visual cumulatively across sections: the screen should assemble into one picture by the end rather than resetting each time.',
      'Ground every section in the concept\'s own material. Mark "SHOT: overhead" on the one or two sections where the physical touch is the point.',
      'Say the thing others hedge on: this format earns authority by being specific.',
    ].join('\n'),
    cta_recipe:
      'Close by pointing at the single next step, then one sharp final line worth punching, with the assembled screen visual held on screen.',
    length: 'Aim for 4 to 8 minutes spoken (roughly 600 to 1200 words).',
  },
];

export function getLibraryTemplate(id: string): LibraryTemplate | undefined {
  return LIBRARY_TEMPLATES.find((t) => t.template_id === id);
}

/** Ref format stored on pieces: stream templates use the storage key; library templates use `library:{id}`. */
export function libraryRef(id: string): string {
  return `library:${id}`;
}
