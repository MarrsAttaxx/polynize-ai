/**
 * THE THREE TEMPLATES, as data.
 *
 * One module read by three places that must agree: the picker on the image screen (client),
 * the system prompt April is briefed with (server), and the compositor that draws the slide
 * (server). A template that is described in one place and drawn in another drifts, and the
 * drift lands as "the picker promised a small photo and the render made a full bleed one".
 *
 * CLIENT SAFE and pure. It imports nothing but types, for the same reason slide-plan.ts does
 * not: the image screen is a 'use client' component and one store import puts `node:crypto`
 * in the browser bundle (see the D47 note in slide-propose.ts).
 */

import type { SlideTemplate } from './slide-plan';

/** What the template does with a generated picture. Decides whether a prompt is written at all. */
export type ImageRole = 'none' | 'small' | 'full';

export type TemplateSpec = {
  id: SlideTemplate;
  /** What he picks it by. Two or three words. */
  name: string;
  /** The one line under the name on the picker. */
  blurb: string;
  imageRole: ImageRole;
  /** Plain words for the picker's second line: how much writing this template carries. */
  textBudget: string;
  /** Hard limits the writer is briefed to and the fitter is sized for. */
  limits: {
    headlineWords: number;
    /** 0 means this template has no supporting line and ignores one if it arrives. */
    subWords: number;
    /** Characters of image prompt. 0 means no prompt is written for this template. */
    promptChars: number;
  };
  /** True when only SOME slides of the set carry a picture (the alternating set). */
  mixed: boolean;
};

export const TEMPLATE_SPECS: TemplateSpec[] = [
  {
    id: 'plate',
    name: 'Statement plate',
    blurb: 'No photo. One claim, set big, on the brand field.',
    imageRole: 'none',
    textBudget: 'A headline of up to 12 words and one supporting line. Nothing is generated.',
    limits: { headlineWords: 12, subWords: 18, promptChars: 0 },
    mixed: false,
  },
  {
    id: 'split',
    name: 'Split card',
    blurb: 'A photo in a window up top, the words underneath. Half the slides carry one.',
    imageRole: 'small',
    textBudget:
      'A headline of up to 10 words and one supporting line. A short photo subject, about 12 words, on the slides that take a photo.',
    limits: { headlineWords: 10, subWords: 16, promptChars: 220 },
    mixed: true,
  },
  {
    id: 'full',
    name: 'Full frame',
    blurb: 'One generated image edge to edge, the words over it.',
    imageRole: 'full',
    textBudget: 'A headline of up to 12 words, and a full scene brief for every slide.',
    limits: { headlineWords: 12, subWords: 0, promptChars: 700 },
    mixed: false,
  },
];

/**
 * WHAT A NEW SET IS WRITTEN AS, which is not the same thing as LEGACY_TEMPLATE.
 *
 * LEGACY_TEMPLATE is `full` because plans written before templates existed WERE composed full
 * bleed, and reading one back as anything else would redraw finished work. This is the default
 * for a set nobody has chosen a look for yet, and it is `split` because that is the look Marrs
 * described as the requirement: "on-brand graphically, with minimal text and a small image".
 * Full frame was the thing he allowed as one of the three, not the thing he asked for.
 *
 * It is also the cheapest sensible default: half the generations of a full frame set, and it
 * degrades to a statement plate on any slide with no photograph rather than failing.
 */
export const DEFAULT_TEMPLATE: SlideTemplate = 'split';

export function templateSpec(id: SlideTemplate): TemplateSpec {
  return TEMPLATE_SPECS.find((t) => t.id === id) ?? TEMPLATE_SPECS[0];
}

/**
 * How many generations a set of this template costs, for the line on the picker that stops
 * him choosing `full` for a ten slide set and then waiting through ten polls.
 */
export function generationsFor(id: SlideTemplate, count: number): number {
  if (id === 'plate') return 0;
  if (id === 'full') return count;
  return Math.min(count, Math.ceil(count / 2));
}

/**
 * WHAT CHANGING THE LOOK COSTS, once a set is already written.
 *
 * The template decides what April was asked for, so switching it is not always free. The three
 * answers are honest about which one you are getting:
 *
 * - `same`: it is already that.
 * - `reset`: the words and the photographs the set already has are enough. Every rendered slide
 *   is redrawn from the background it already has, which costs nothing and takes a second. The
 *   fitter resizes type that no longer fits, which is exactly what it is for.
 * - `rewrite`: the new look needs material this set does not have, so April writes it again.
 *
 * The asymmetry is real and it is not a bug. A statement plate has no photo subjects in it at
 * all, so a plate cannot become a full frame set without someone writing the scenes. A full
 * frame set can always become a plate, because a plate ignores photographs.
 *
 * `full` needs a prompt on EVERY slide, since it generates for every slide and a slide with no
 * subject generates something arbitrary. `split` needs only one somewhere, because a split
 * slide with no prompt is a deliberate type-only slide in a photo set and draws as a plate.
 */
export type SwitchKind = 'same' | 'reset' | 'rewrite';

export function switchKind(
  to: SlideTemplate,
  plan: { template: SlideTemplate; slides: { prompt: string }[] }
): SwitchKind {
  if (to === plan.template) return 'same';
  const spec = templateSpec(to);
  if (spec.imageRole === 'none') return 'reset';
  const have = plan.slides.filter((sl) => sl.prompt.trim().length > 0).length;
  const need = spec.mixed ? 1 : plan.slides.length;
  return have >= need ? 'reset' : 'rewrite';
}
