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

export type Card = { title: string; body: string };
export type WalkawayItem = { n: string; title: string; body: string };
export type Stage = { n: string; title: string; what: string; who: string };

export type MappingContent = {
  hero: {
    h1: string;
    subhead: string;
    primaryCta: string;
    secondaryLabel: string;
  };
  problem: { h2: string; paras: string[] };
  whatItIs: { h2: string; paras: string[]; cards: Card[] };
  walkaway: { h2: string; intro: string; items: WalkawayItem[]; footnote: string };
  howItRuns: { h2: string; stages: Stage[]; line: string };
  video: { h2: string; src: string; poster: string; caption: string };
  proof: { h2: string; paras: string[]; stat: string };
  examples: { h2: string; intro: string; cards: Card[] };
  audience: { h2: string; paras: string[] };
  leads: { h2: string; paras: string[]; linkLabel: string; linkHref: string };
  finalCta: { h2: string; body: string; button: string };
};

export const BOOKING_URL = 'https://calendar.app.google/rw8Vpd7BkJh5wwig9';

export const mappingContent: MappingContent = {
  hero: {
    h1: 'Map what your team can actually do.',
    subhead:
      'A three hour session that shows you where your team’s capability sits against the work that matters, so you can see where to invest next. You leave with the map, the data, and a report.',
    primaryCta: 'Book a discovery call',
    secondaryLabel: 'See how it works',
  },

  problem: {
    h2: 'You cannot normally see your own organisation.',
    paras: [
      'Most companies think about work in silos. People over here, processes over there, technology somewhere else. IT knows nothing about the people. A consultant fixes your workflows without knowing your team. Everyone holds one piece.',
      'So when a decision comes up, where should AI go, where do people need to stay in charge, who is ready and who is not, there is nothing to make the decision against.',
      'You cannot go where you need to go without a map.',
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
        body: 'Not a survey, not a self assessment. Scenarios drawn from the work your team does every week.',
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

  howItRuns: {
    h2: 'How it runs.',
    stages: [
      {
        n: '01',
        title: 'Discovery',
        what: 'We work out what is worth mapping, and what a result would be worth to you.',
        who: 'You, and whoever holds the budget',
      },
      {
        n: '02',
        title: 'Agreement',
        what: 'Scope and price confirmed.',
        who: 'You',
      },
      {
        n: '03',
        title: 'Input and setup',
        what: 'We build the scenarios from your real work. Either a short session or online, whichever suits.',
        who: 'Your project lead',
      },
      {
        n: '04',
        title: 'The session',
        what: 'Three hours. Your team works through the scenarios and the map builds live.',
        who: 'Your team',
      },
      {
        n: '05',
        title: 'Handover showcase',
        what: 'One hour. We walk your leadership through the map, the report, and what we would do next.',
        who: 'Your leadership',
      },
    ],
    line: 'No cap on how many people take part. We scope that with you up front.',
  },

  video: {
    h2: 'What the map actually shows.',
    src: '/mapping/capability-mapping.mp4',
    poster: '/mapping/poster.jpg',
    caption:
      'Shourov Bhattacharya and Marrs Coiro, co founders, on reading a capability map. From the Humans, Amplified podcast.',
  },

  proof: {
    h2: 'One of the world’s biggest technology companies used this to find out where to invest in its people.',
    paras: [
      'Before taking a new product to global market, they mapped the real capability of their go to market leadership. They benchmarked it, found where the gaps actually were, and used that to decide where investment would move the numbers.',
    ],
    stat: 'Ninety minutes. One team. A decision they could act on.',
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
    button: 'Book a discovery call',
  },
};
