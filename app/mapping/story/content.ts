/**
 * Copy for the scroll-story variant of /mapping.
 *
 * Everything the two pages share is imported from ../content rather than copied,
 * so a copy fix on /mapping cannot silently drift from /mapping/story. Only the
 * problem section differs (restated per Marrs), plus the story beats, which exist
 * only here.
 *
 * Same house rules as the parent: never "training", never "workshop" as the product
 * noun, never name the technology company, never a price, Australian spelling,
 * no em-dashes.
 */

import { mappingContent, type MappingContent } from '../content';
import type { Silo } from '../SiloDiagram';

/** One scroll beat. Roughly one thought per screen. */
export type Beat = {
  /** Small mono label above the line. */
  kicker?: string;
  /** The thought itself, set large. */
  line: string;
  /** Optional supporting sentence underneath. */
  sub?: string;
  /** Optional three-panel moment (the people / processes / technology argument). */
  panels?: Silo[];
  /** The turn. Rendered in mint, and it lands the arc. */
  turn?: boolean;
};

/** The three questions nobody in the room can answer. */
const ARGUMENT: Silo[] = [
  { kind: 'people', label: 'People', note: 'Can they actually do it?' },
  { kind: 'process', label: 'Processes', note: 'Is this where the work breaks?' },
  { kind: 'technology', label: 'Technology', note: 'Will any of this pay?' },
];

export const storyBeats: Beat[] = [
  {
    kicker: 'The problem',
    line: 'You do not know where you are.',
  },
  {
    line: 'And you do not know what good looks like.',
    sub: 'Almost no organisation holds real data on what its people can actually do, and fewer still hold a benchmark for what good would look like.',
  },
  {
    line: 'So every decision is an opinion.',
    sub: 'Without a position and without a destination, the call comes down to whoever is most confident in the room.',
  },
  {
    kicker: 'Then AI arrived',
    line: 'The most ambiguous tool your organisation has ever bought.',
    sub: 'Capable of going almost anywhere, which means nobody can say where it will actually pay.',
  },
  {
    line: 'So the argument starts.',
    sub: 'Three problems that are really one.',
    panels: ARGUMENT,
  },
  {
    kicker: 'And it keeps moving',
    line: 'The work will not hold still.',
    sub: 'A document is out of date the week it is written. You do not need a snapshot of your organisation, you need a live model of it.',
  },
  {
    line: 'You cannot go where you need to go without a map.',
    turn: true,
  },
];

/**
 * The shared sections, with the problem section restated. The prose version is kept
 * (not just the beats) so the page still reads without motion, and so search engines
 * and anyone with JS or scroll animations unavailable get the full argument.
 */
export const storyContent: MappingContent = {
  ...mappingContent,
  /**
   * The story page renders the matrix as live DOM rather than the screenshot, and
   * its figures are synthetic, so the parent's "A real capability map" caption would
   * be false here. Overridden rather than edited upstream, because /mapping still
   * ships the genuine screenshot and that caption is true there.
   */
  matrixImage: {
    ...mappingContent.matrixImage,
    caption:
      'An example capability map. Every person against every part of the work, scored and coloured, with the gaps showing up plainly. Select any cell to see how that capability was read. The figures shown are illustrative.',
  },
  problem: {
    h2: 'You do not know where you are, or what good looks like.',
    paras: [
      'Almost no organisation holds real data on what its people can actually do, and fewer still hold a benchmark for what good would look like. Without a position and without a destination, every decision about capability comes down to the most confident opinion in the room.',
      'AI has made that harder. It is the most ambiguous tool your organisation has ever bought, capable of going almost anywhere, which means nobody can say where it will actually pay. That uncertainty lands as an argument between people, processes and technology, and the three get treated as separate problems when they are one.',
      'Meanwhile the work keeps moving. A document is out of date the week it is written. You do not need a snapshot of your organisation, you need a live model of it.',
      'You cannot go where you need to go without a map.',
    ],
    silos: ARGUMENT,
  },
};
