/**
 * Copy + structure for the Team Capability Mapping landing page.
 *
 * This is deliberately a plain data object so buyer-specific variants
 * (/mapping/<variant>) can import it and override only the sections that change,
 * without touching the section components. Section order is the array order the
 * page renders.
 *
 * House rules baked in (see BUILD BRIEF §1): never the word "training", never
 * "workshop" as the product noun (use "session"), never name the technology
 * company, never a price, Australian spelling, no em-dashes, human led.
 */

import type { CardIcon, StageIcon } from './icons';
import type { SiloIcon } from './icons';

/** People / process / technology, as a labelled item. Used by the story's Inputs row.
    It used to live in SiloDiagram, which was deleted with the old landing page. */
export type Silo = { kind: SiloIcon; label: string; note: string };

/**
 * One scroll beat. Roughly one thought per screen.
 *
 * `figure` is a plain string rather than a union because each landing page brings its
 * own figure registry (see BeatFigure). A page can only draw figures its own module
 * declares, and naming one it did not supply renders nothing rather than throwing.
 */
export type Beat = {
  /** Chapter marker above the line. Set large enough to read while scrolling. */
  kicker?: string;
  line: string;
  sub?: string;
  /** Diagram shown in its own band under the beat. Key into the page's registry. */
  figure?: string;
  /** The turn. Rendered in mint, and it hands over to the result section. */
  turn?: boolean;
};

/** What the engagement leaves behind. Each page names its own three. */
export type ArtefactKind = 'matrix' | 'data' | 'report' | 'workmodel' | 'capmap' | 'benchmark';
export type Artefact = {
  n: string;
  kind: ArtefactKind;
  title: string;
  body: string;
  /** One line on what you actually do with it. */
  use: string;
};

/** `icon` is optional: a page with nothing sensible to draw should draw nothing. */
export type Card = { title: string; body: string; icon?: CardIcon };
export type WalkawayItem = { n: string; title: string; body: string };
export type Stage = {
  n: string;
  title: string;
  what: string;
  who: string;
  icon: StageIcon;
  /**
   * How much of the client's own time this phase costs, e.g. "2 to 3 hours". It answers
   * the question the Gantt raises and cannot itself answer: the bars show elapsed days,
   * and a reader looking at a two week chart needs to know they are not being asked for
   * two weeks of their people.
   */
  duration: string;
  /**
   * Where the phase sits on the timeline, as inclusive 1-indexed working days out of
   * ten. `[1, 3]` is the first three days. Ten because two weeks is the engagement and
   * days give enough resolution to overlap phases honestly; a phase that hands over
   * mid-week should look like it does.
   */
  span?: [number, number];
};
export type Person = { name: string; src: string };

export type MappingContent = {
  hero: {
    h1: string;
    subhead: string;
    primaryCta: string;
    secondaryLabel: string;
  };
  problem: { h2: string; paras: string[]; silos: Silo[] };
  whatItIs: { h2: string; paras: string[]; cards: Card[] };
  matrixImage: { src: string; alt: string; caption: string; width: number; height: number };
  walkaway: { h2: string; intro: string; items: WalkawayItem[]; footnote: string };
  howItRuns: {
    h2: string;
    /** One line under the heading, framing the three phases before they are listed. */
    lead: string;
    stages: Stage[];
    /** Optional closing line. A section that has said everything should not add a coda. */
    line?: string;
    /**
     * The lane that runs the whole way across the chart, drawn dashed above the phases.
     * Optional: a page with nothing genuinely continuous should not invent one.
     */
    spanning?: { label: string; note: string; text: string };
  };
  video: {
    eyebrow: string;
    h2: string;
    src: string;
    poster: string;
    caption: string;
    people: Person[];
  };
  proof: { h2: string; paras: string[]; stat: string };
  examples: { h2: string; intro: string; cards: Card[] };
  audience: { h2: string; paras: string[] };
  leads: { h2: string; paras: string[]; linkLabel: string; linkHref: string };
  finalCta: { h2: string; body: string; button: string };
};

export const BOOKING_URL = 'https://calendar.app.google/rw8Vpd7BkJh5wwig9';

/**
 * The mapping flow. Every primary CTA on the site points here now: nobody books a call
 * off a landing page, they want to see the thing work on their own business first.
 */
export const MAP_URL = '/map-your-team';

export const mappingContent: MappingContent = {
  hero: {
    h1: 'Map what your team can actually do.',
    subhead:
      'A three hour session that shows you where your team’s capability sits against the work that matters, so you can see where to invest next. You leave with the map, the data, and a report.',
    primaryCta: 'Map your team',
    secondaryLabel: 'See how it works',
  },

  problem: {
    h2: 'You cannot normally see your own organisation.',
    paras: [
      'Most companies think about work in silos. People over here, processes over there, technology somewhere else. IT knows nothing about the people. A consultant fixes your workflows without knowing your team. Everyone holds one piece.',
      'So when a decision comes up, where should AI go, where do people need to stay in charge, who is ready and who is not, there is nothing to make the decision against.',
      'You cannot go where you need to go without a map.',
    ],
    silos: [
      { kind: 'people', label: 'People', note: 'Who is ready, and who is not.' },
      { kind: 'process', label: 'Processes', note: 'Mapped without the people.' },
      { kind: 'technology', label: 'Technology', note: 'Chosen without either.' },
    ],
  },

  whatItIs: {
    h2: 'Three hours. Your real work. Your real team.',
    paras: [
      'We take your team through scenarios built from the work they actually do. They respond in their own words, in real situations, and the platform analyses what capability they are genuinely demonstrating.',
      'Documents and process maps are a snapshot. They are what people say about the work. This is what people do in the work, which is why the map is accurate.',
    ],
    cards: [
      {
        title: 'Built from real work',
        body: 'Scenarios drawn from the work your team does every week.',
      },
      {
        title: 'People, work and technology together',
        body: 'The map holds all three at once, because you cannot change one without moving the others.',
      },
      {
        title: 'Your team comes in cold',
        body: 'No preparation, no homework, no rehearsal. That is what makes the reading honest.',
      },
    ],
  },

  walkaway: {
    h2: 'Three things you keep.',
    intro: 'Not a slide deck.',
    items: [
      {
        n: '01',
        title: 'The capability matrix',
        body: 'Access to your team’s completed map, exactly as it was built in the session. Yours to return to, share internally, and make decisions from.',
      },
      {
        n: '02',
        title: 'Your data, exported',
        body: 'The full data set behind the model, exported and yours. If you have internal capability to work with it, work with it.',
      },
      {
        n: '03',
        title: 'The team capability report',
        body: 'Our read on what the map shows. Where the strength is, where the gaps are, and what we would do about it. Written by us, not generated.',
      },
    ],
    footnote: 'Everyone who takes part also receives their own individual report.',
  },

  /**
   * THE PROCESS, taken from the version running at polynize.io/mapping (12 Aug 2026).
   *
   * That page is an iframe of a static export of this one which had been hand-edited
   * after export, so it had drifted ahead of the repo. Marrs asked for its version to
   * come back, and this is that copy verbatim rather than a rewrite of it.
   *
   * IT REPLACED "Model / Train / Deploy", which is a different argument. That version
   * said: build the model, lift the humans, then hand the rest to agents. This one says:
   * build the model, MEASURE people against it, hand back the matrix. Both landing pages
   * now carry this, so a change here changes both.
   *
   * The spans are the .io chart's, converted into this component's coordinates (it has a
   * label column and .io's did not): .io drew columns 1/4, 3/9 and 8/11 across ten days.
   */
  howItRuns: {
    h2: 'How It Works.',
    lead: 'Simple three-step process, powered by the Polynize Capability Platform.',
    stages: [
      {
        n: '01',
        title: 'Model',
        span: [1, 3],
        what: 'We build the model with you from your documents, roles, people and process, and from conversation, to create realistic scenarios. You set the benchmark.',
        who: 'Your project lead',
        duration: '2 to 3 hours',
        icon: 'model',
      },
      {
        n: '02',
        title: 'Measure',
        span: [3, 8],
        what: 'Your team works through the work scenarios in their own words and at their own pace. Their capability is measured and uplifted in the flow of work, relative to the benchmark.',
        who: 'Your team',
        duration: 'Under 1 hour per participant',
        icon: 'measure',
      },
      {
        n: '03',
        title: 'Matrix',
        span: [8, 10],
        what: 'You receive the completed capability matrix, showing capability and uplift, and a capability report for your leadership, investment and decision-making.',
        who: 'Your leadership',
        duration: '1 to 2 hours',
        icon: 'matrix',
      },
    ],
  },

  matrixImage: {
    src: '/mapping/capability-matrix.jpg',
    alt: 'A team capability matrix: people down the side, work scenarios across the top, each capability scored and coloured from strong to gap.',
    caption:
      'A real capability map. Every person against every part of the work, scored and coloured, with the gaps showing up plainly.',
    width: 1920,
    height: 908,
  },

  /**
   * The 8:40 cut, Aug 2026. Re-encoded for web: the master was 960x540 at 6.9 Mbps
   * (453 MB), which is roughly eight times what this resolution needs and far too big to
   * put in front of anyone. CRF 27 with faststart brings it to 24 MB with no visible
   * loss on the screen-share, and the moov atom at the front means it starts playing
   * before it has finished downloading.
   *
   * The previous cut stays at /mapping/capability-mapping.mp4 because the standalone
   * HTML exports already sent out reference it by absolute URL.
   */
  video: {
    eyebrow: 'Capability Mapping',
    h2: 'What the map actually shows.',
    src: '/mapping/capability-mapping-2026.mp4',
    poster: '/mapping/poster-2026.jpg',
    caption:
      'Shourov Bhattacharya and Marrs Coiro, co founders, on reading a capability map. About nine minutes.',
    people: [
      { name: 'Shourov Bhattacharya', src: '/mapping/avatar-shourov.jpg' },
      { name: 'Marrs Coiro', src: '/mapping/avatar-marrs.jpg' },
    ],
  },

  /**
   * Marrs's copy, verbatim (11 Aug 2026), numbers included and cleared by him.
   *
   * Two house rules bend here and he made both calls: it uses "train" as a verb, and it
   * ends on an emoji. Neither is decoration. The tone is the point of the last line, and
   * the whole section works because it withholds the names rather than despite it.
   *
   * The GitHub mark came off with this rewrite. A logo and "we can't tell you who yet"
   * on the same screen contradict each other, and the mark was the louder of the two.
   */
  proof: {
    h2: 'Used by one of the big four consultancies to train 38,000 practitioners, and a world leading tech brand to train a $200M ARR sales team.',
    paras: ['We can’t tell you who yet, but soon. 🤫'],
    stat: '',
  },


  examples: {
    h2: 'What teams map.',
    intro: 'Examples, not a menu. We build the session around the decision you are trying to make.',
    cards: [
      {
        title: 'The tool you already bought',
        body: 'You have paid for AI licences across the team. Map who can actually use them well and who cannot, and find out whether that spend is working.',
      },
      {
        title: 'Sales capability',
        body: 'Map how your sales team actually performs against the parts of the cycle that close deals, and see where capability is costing you revenue.',
      },
      {
        title: 'AI readiness',
        body: 'Before restructuring any work around AI, map what your team can do today so the plan is built on evidence rather than assumption.',
      },
      {
        title: 'Going to market with one voice',
        body: 'Map whether your team can genuinely articulate what you do, and find out who is getting it right.',
      },
    ],
  },

  audience: {
    h2: 'Who this is for.',
    paras: [
      'Team leaders, heads of function, and managers who want a real read on their own team.',
      'It works for a single team inside a large organisation just as well as it works for a whole department in a smaller business. If you are responsible for a group of people and a body of work, there is a map here for you.',
    ],
  },

  leads: {
    h2: 'Where it leads.',
    paras: [
      'Mapping one team is a decision about one team. When you want the same view across your whole organisation, workflows, people and technology together, that is capability modelling, and this is the first step into it.',
      'Your map stays open in read only. When you are ready to build on it, we pick up from there.',
    ],
    linkLabel: 'Capability modelling',
    linkHref: '/',
  },

  finalCta: {
    h2: 'Start with a conversation.',
    body: 'Tell us what you are trying to decide, and we will tell you whether mapping your team will help.',
    button: 'Map your team',
  },
};
