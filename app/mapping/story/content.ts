/**
 * Copy for the scroll-story variant of /mapping.
 *
 * Rewritten to the 6 Aug founder call. Four decisions drive it:
 *  1. Sharpen to AI. The page is now about what your people can do with AI, not
 *     capability in general. Narrower door, deliberately.
 *  2. "Map before you invest" is the spine, and the word invest earns its place.
 *  3. Current state only. Leave them with the diagnosis so "how do we fix this"
 *     becomes their question, which is what "What comes next" is for.
 *  4. Less is more. Example sessions and Who it is for are gone.
 *
 * The medical framing (MRI, clinic, diagnosis) stays internal per Shourov. It is
 * not on this page.
 *
 * Shared sections still come from ../content so a fix there cannot drift; anything
 * the story rewrites is overridden below.
 *
 * House rules unchanged: never "training", never "workshop" as the product noun,
 * never name the technology company, never a price, Australian spelling, no em-dashes.
 */

import { mappingContent, type MappingContent } from '../content';
import type { Silo } from '../SiloDiagram';

/** One scroll beat. Roughly one thought per screen. */
export type Beat = {
  /** Chapter marker above the line. Set large enough to read while scrolling. */
  kicker?: string;
  line: string;
  sub?: string;
  panels?: Silo[];
  /** Small diagram that draws the beat's argument, shown under the sub-line. */
  figure?: FigureKind;
  /** The turn. Rendered in mint, and it hands over to the map. */
  turn?: boolean;
};

/** The four story diagrams, one per beat before the turn. */
export type FigureKind = 'scatter' | 'ambiguity' | 'coordinates' | 'guess';

/** The three inputs the engagement asks for, per the call. */
const INPUTS: Silo[] = [
  { kind: 'people', label: 'People', note: 'The roles, and what good looks like in each.' },
  { kind: 'process', label: 'Process', note: 'The work as it is actually done.' },
  { kind: 'technology', label: 'Technology', note: 'The tools and agents already in play.' },
];

/**
 * The five beats.
 *
 * Each one has a job: 1 condition, 2 cause, 3 diagnosis, 4 cost, 5 turn. The arc has
 * to escalate and then pivot, so nothing here is interchangeable.
 *
 * DECISIONS THAT SHOULD NOT BE QUIETLY UNDONE:
 * - Beat 1 uses the language of being lost on purpose. It is what licenses the route
 *   beside it to scribble; without the word "lost" that animation is decoration.
 * - Beat 1 opens with "We get it", which is deliberate: it makes the diagnosis
 *   sympathetic rather than accusing, before the arc turns hard.
 * - Beat 2 names AI as the subject outright. It went through "Adoption is not
 *   capability" (rejected 2026-08-06) and an unnamed-subject version before landing
 *   here. Do not reinstate either. The line "you would not measure a chef by the gas
 *   they burn" was lost along the way and is worth another home.
 * - Beat 4 says "guess", not "opinion". Marrs's correction, and he is right: an opinion
 *   is a position you can defend, a guess is what is left when you have no information.
 * - Beat 5 gets no kicker and no sub. Kickers render in mint and the turn is the only
 *   mint line in the arc, so a marker above it would spend that moment twice.
 */
export const storyBeats: Beat[] = [
  {
    kicker: 'The problem',
    line: 'We get it. Like most, you are lost on your AI journey.',
    sub: 'Licences bought, pilots running, budget committed. None of it adds up to a direction.',
    figure: 'scatter',
  },
  {
    line: 'AI is the most ambiguous tool your organisation has ever bought.',
    sub: 'Capable of going almost anywhere, which means nobody can say where it will actually pay.',
    figure: 'ambiguity',
  },
  {
    kicker: 'No landmarks',
    line: 'You do not know where you are, or what good looks like.',
    sub: 'No real data on what your people can do with these tools. Nothing to measure it against.',
    figure: 'coordinates',
  },
  {
    line: 'So every investment decision is a guess.',
    sub: 'Which licences to renew, which teams to back, where the next dollar goes. The call goes to whoever is most confident in the room.',
    figure: 'guess',
  },
  {
    line: 'You cannot go where you need to go without a map.',
    turn: true,
  },
];

/** What you keep. Fleshed out, and each one gets a visual. */
export type ArtefactKind = 'matrix' | 'data' | 'report';
export type Artefact = {
  n: string;
  kind: ArtefactKind;
  title: string;
  body: string;
  /** One line on what you actually do with it. */
  use: string;
};

export const artefacts: Artefact[] = [
  {
    n: '01',
    kind: 'matrix',
    title: 'The capability matrix',
    body: 'Your team’s completed map, exactly as it was built. Every person against every part of the work, scored against the benchmark, with the gaps and the strengths showing up plainly. Open any cell and you can see how that reading was reached.',
    use: 'Decide where the next dollar goes, and defend the decision.',
  },
  {
    n: '02',
    kind: 'data',
    title: 'Your data, exported',
    body: 'The full data set behind the model, exported and yours. Every scenario, every response, every score. Not a summary of the findings, the findings themselves.',
    use: 'Take it into your own reporting, or hand it to your own analysts.',
  },
  {
    n: '03',
    kind: 'report',
    title: 'The capability report',
    body: 'Our read on what the map shows. Where the strength is, where the gaps are, what is worth investing in first and what is not worth investing in at all. Written by us, not generated.',
    use: 'Put it in front of leadership without rewriting it.',
  },
];

export const artefactsIntro = 'Three things, and none of them is a slide deck.';
export const artefactsFootnote =
  'Everyone who takes part also receives their own individual report.';

export const storyContent: MappingContent = {
  ...mappingContent,

  hero: {
    h1: 'Map what your team can actually do with AI.',
    subhead:
      'Before you invest another dollar in AI, see what your people can genuinely do with it, benchmarked against what good looks like.',
    primaryCta: 'Book a demo',
    secondaryLabel: 'See how it works',
  },

  /**
   * The turn says you need a map. This section has to answer it immediately, so the
   * eyebrow names the product and the heading hands straight over to the matrix.
   */
  whatItIs: {
    h2: 'This is the map.',
    paras: [
      'We take your team through scenarios built from the work they actually do. They respond in their own words, in real situations, and the platform reads what capability they are genuinely demonstrating.',
      'Documents and process maps are a snapshot. They are what people say about the work. This is what people do in the work, which is why the map is accurate.',
    ],
    cards: mappingContent.whatItIs.cards,
  },

  /**
   * The story page renders the matrix as live DOM with synthetic figures, so the
   * parent's "A real capability map" caption would be false here.
   */
  matrixImage: {
    ...mappingContent.matrixImage,
    caption:
      'An example capability map. Every person against every part of the work, scored and coloured, with the gaps showing up plainly. Select any cell to see how that capability was read. The figures shown are illustrative.',
  },

  /**
   * Three steps, not five. Discovery and Agreement are sales cycle, not product,
   * so they came off per the call. Renumbered from 01 rather than left at 03.
   */
  howItRuns: {
    h2: 'How it runs.',
    stages: [
      {
        n: '01',
        title: 'Inputs',
        what: 'Three things from you: people, process and technology. Drafts and internal working documents are fine. We would rather have the real imperfect material than a polished version.',
        who: 'Your project lead',
        icon: 'setup',
      },
      {
        n: '02',
        title: 'Scenarios',
        what: 'Your team works through scenarios built from their real work. In the room together, or in their own time across a week if they are spread across time zones.',
        who: 'Your team',
        icon: 'session',
      },
      {
        n: '03',
        title: 'Readout',
        what: 'We walk your leadership through the map, the report, and what we would do about it next.',
        who: 'Your leadership',
        icon: 'handover',
      },
    ],
    line: 'About an hour of each person’s time. We scope the number of roles with you up front.',
  },

  finalCta: {
    ...mappingContent.finalCta,
    button: 'Book a demo',
  },
};

export const storyInputs = INPUTS;
