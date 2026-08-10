import {
  mappingContent,
  type Artefact,
  type Beat,
  type MappingContent,
  type Silo,
} from './content-base';

/**
 * Copy for /capability-mapping.
 *
 * THE DIFFERENCE FROM /mapping IN ONE LINE. That page asks what your people can do with
 * AI and answers with a matrix of people against capabilities. This page asks a
 * different question, which is where AI belongs in the work at all, and answers with
 * the capability map: every capability in one bottleneck, split human, hybrid, agentic.
 * Two products, two audiences, one layout (see StoryLanding).
 *
 * SOURCE. Written from Marrs's capability-mapping thesis (10 Aug 2026). The thesis is
 * source material, not page copy, so the beats below are a compression of it rather
 * than quotations. The load-bearing claims it makes and this page repeats:
 *   - organisations cannot describe their own work at the level a decision needs
 *   - AI is a force multiplier, so unmapped work gets worse faster, not better
 *   - training built before the work changes trains people for a job that has gone
 *   - the sequence is fixed: model, then train, then deploy
 *   - it targets one bottleneck first and scales from there, never a top-down inventory
 *   - the human lane gets the same rigour as the other two
 *
 * CLAIMS DELIBERATELY LEFT OFF. The thesis carries several numbers that would be strong
 * here and are not used: roughly 20 minutes to a live map, 1,500 data points per
 * practitioner, billions of data points at enterprise scale. They stay off until Marrs
 * confirms they are public and attributable, because a number on a marketing page is a
 * promise. Ask before adding them.
 *
 * House rules unchanged: never "training" as the product noun, never "workshop", never
 * name the technology company, never a price, Australian spelling, no em-dashes.
 */

/** The figures this page declares. See figures-work.tsx for the registry. */
export type WorkFigureKind = 'lost' | 'blackbox' | 'amplify' | 'gamble';

/** The three inputs the engagement asks for. Same three, different emphasis. */
const INPUTS: Silo[] = [
  { kind: 'process', label: 'The bottleneck', note: 'One piece of work that is costing you. Not the whole company.' },
  { kind: 'people', label: 'Whatever you have', note: 'Documents, frameworks, half-finished spreadsheets. Real and imperfect beats polished.' },
  { kind: 'technology', label: 'The decision makers', note: 'The people who can say yes in the room while it is being built.' },
];

/**
 * The five beats.
 *
 * Jobs: 1 condition, 2 consequence, 3 the mechanism that makes it worse, 4 the cost,
 * 5 the turn. Same arc shape as /mapping, which is why they can share a layout, but
 * every line is about the work rather than about the tools.
 *
 * DECISIONS THAT SHOULD NOT BE QUIETLY UNDONE:
 * - Beats 1, 2, 4 and 5 are Marrs's own lines (10 Aug 2026). Beat 1 went through "Most
 *   organisations cannot describe their own work" and then "don't know where AI fits in
 *   their work" before landing on "lost in their AI journey". Do not paraphrase any of
 *   them. The SUB-LINES under 1, 2 and 4 are mine, written to the brief he gave for
 *   each, and are the parts most likely to want his hand.
 * - Beat 3 is the load-bearing one. Amplification is the mechanism that turns an
 *   unmapped process from a slow problem into a fast one, and it is the reason the
 *   sequence has to be model, then train, then deploy rather than any other order.
 * - Beat 4 is the pivot of the whole page: the reader arrived believing they have a
 *   technology problem, and this is the line that tells them they do not. Its sub-line
 *   has to say WHY, which is that AI cuts across the org structure rather than sitting
 *   inside it. Weaken that and the beat becomes an assertion.
 * - Beat 5 gets no kicker and no sub, same as its sibling page: kickers render in mint
 *   and the turn is the only mint line in the arc.
 */
export const workBeats: Beat[] = [
  {
    kicker: 'The problem',
    line: 'Most organisations are lost in their AI journey.',
    sub: 'Tools bought, pilots run, budgets committed. No agreed picture of where any of it belongs in the work.',
    figure: 'lost',
  },
  {
    line: 'Too many tools, too many options, too many opinions.',
    sub: 'One expert says start with the tooling. The next says start with the people. Everyone in the room has a view and none of them is based on your work.',
    figure: 'options',
  },
  {
    kicker: 'What it costs',
    line: 'AI amplifies whatever it is given.',
    sub: 'Point it at work nobody has mapped and it does not fix the process. It runs the same broken process faster.',
    figure: 'amplify',
  },
  {
    line: 'This is not a technology problem. It is an organisation design problem.',
    sub: 'AI does not fit the shape your company is already in. It cuts across the roles and the reporting lines you have, which is exactly why putting it inside them keeps not working.',
    figure: 'misfit',
  },
  {
    line: 'You can’t decide where AI fits until you map the work.',
    turn: true,
  },
];

export const workArtefacts: Artefact[] = [
  {
    n: '01',
    kind: 'workmodel',
    title: 'The work model',
    body: 'Your bottleneck broken into the scenarios and the steps it is actually made of. Built from your own material, so every part of it traces back to something you gave us rather than to a template.',
    use: 'Finally have one description of the work that everyone agrees with.',
  },
  {
    n: '02',
    kind: 'capmap',
    title: 'The capability map',
    body: 'Every capability in that work, allocated human, hybrid or agentic, with the reasoning attached. The human column is treated with the same rigour as the other two, because the point is finding where judgment has to stay.',
    use: 'Decide what to automate, what to leave alone, and defend both.',
  },
  {
    n: '03',
    kind: 'benchmark',
    title: 'The benchmark',
    body: 'Where each capability sits today against what good looks like for it. Current state and future state side by side, so the gap is a measurement rather than an opinion.',
    use: 'Know which gap to close first, and what closing it is worth.',
  },
];

export const workArtefactsIntro = 'Three things, and all of them are yours.';
export const workArtefactsFootnote =
  'Everything traces back to material you gave us. Nothing here is a template with your name on it.';

export const workContent: MappingContent = {
  ...mappingContent,

  /**
   * A different frame of the same video: 1:02, where the matrix is up on the screen
   * behind him. Overridden here rather than in content-base so /mapping keeps its own.
   */
  video: { ...mappingContent.video, poster: '/mapping/poster-1m02.jpg' },

  hero: {
    h1: 'See How Your Work Actually Works.',
    subhead:
      'Before you decide where AI belongs, map the work into its capabilities and see which are human, which are agentic, and which are both.',
    primaryCta: 'Book a call',
    secondaryLabel: 'See how it works',
  },

  /**
   * The turn says you cannot decide until you can see the work. This section has to
   * answer it immediately, so the heading hands straight over to the map.
   */
  /**
   * The eyebrow is "The fix" rather than the product name: the four beats above have
   * just spent the reader's attention on a problem, and what they want next is the
   * answer, not a noun.
   */
  whatItIs: {
    h2: 'This is your map.',
    paras: [
      'We map one team at a time. Every capability the work asks of them, broken out and allocated: human, hybrid or agentic. Every allocation carries the reasoning behind it, so you can argue with it.',
    ],
    cards: [
      {
        title: 'Built from your material',
        body: 'Documents, frameworks, half-finished spreadsheets. Everything the map says traces back to something you gave us.',
      },
      {
        title: 'One team at a time',
        body: 'Not a top-down inventory of the whole company in one go. Map a team properly, then run the same method across the next one.',
      },
      {
        title: 'The human column matters',
        body: 'The map is as much about protecting judgment as it is about finding automation. Both get the same scrutiny.',
      },
    ],
  },

  /**
   * The fixed sequence from the thesis: model, then train, then deploy.
   *
   * ON THE TIMELINE, AND THIS NEEDS A DECISION. The chart frames two weeks, which is
   * honest for Model and is the length of a mapping engagement. Train and Deploy are the
   * rest of the transformation and plainly do not finish inside a fortnight; they are
   * drawn here because Marrs asked for the same treatment on both pages and to keep the
   * existing data. Flagged to him on 10 Aug 2026. The better version is probably Model
   * filling the frame with the other two running off the right-hand edge, which would
   * say "mapping fits in two weeks and the rest follows" rather than implying all three
   * do. Do not quietly harden this into a delivery promise.
   */
  howItRuns: {
    h2: 'The sequence is fixed.',
    spanning: {
      label: 'Working sessions',
      note: 'Throughout',
      text: 'Built with your people in the room',
    },
    stages: [
      {
        n: '01',
        title: 'Model',
        span: [1, 6],
        what: 'We take your inputs in whatever state they are in, pick the bottleneck, and build the work model. Then the capability map, then the benchmark.',
        who: 'Your project lead',
        icon: 'setup',
      },
      {
        n: '02',
        title: 'Train',
        span: [5, 9],
        what: 'Lift the human capability the map says has to stay human. This comes second on purpose. Doing it first builds for a job the agents are about to change.',
        who: 'Your team',
        icon: 'session',
      },
      {
        n: '03',
        title: 'Deploy',
        span: [8, 10],
        what: 'Agents take the capabilities the map allocated to them, designed around the people who own the rest. Only possible once the gaps are known.',
        who: 'Your leadership',
        icon: 'handover',
      },
    ],
    line: 'Skip a step and you are building the plane while you are flying it.',
  },

  proof: mappingContent.proof,

  finalCta: {
    ...mappingContent.finalCta,
    button: 'Book a call',
  },
};

export const workInputs = INPUTS;
