import type { Answers, CapabilityMapData } from '../types';

/**
 * Hand-crafted demo answer set + capability map. Used when ?demo=1 is in the
 * URL or when the id resolves to "demo". Now mirrors the AJ Milne /
 * Optio Capital story used as the homepage testimonial.
 *
 * Maps to CWU Shape 1 (Analysis and Judgment) — parallel research streams
 * feeding synthesis and human judgment.
 */
export const DEMO_ANSWERS: Partial<Answers> = {
  name: 'AJ Milne',
  company: 'Optio Capital',
  business_description:
    'Boutique investment advisory managing portfolios for high-net-worth clients',
  role: 'Founder / CEO',
  bottleneck_full: `"Every investment decision needs weeks of groundwork before anyone can make a call. Each deal needs market analysis, financial modelling, legal review, and competitive assessment. Our senior analysts spend most of their time on the groundwork instead of the judgment calls that actually move the firm forward."

[Follow-up: Where exactly does it break down?]
"It's the synthesis. Different analysts do different pieces of the work in different formats, and pulling it into a single investment thesis takes another week of partner time. By the time we make a call, the window has often closed. We need the groundwork done in parallel and presented in a single voice."`,
  ideal_outcome:
    "We could move on more deals without growing the team, and partners would spend their time on judgment and client relationships instead of editing analyst memos. Investment recommendations would land in days, not weeks.",
  work_shape:
    'Every deal opportunity hits the analyst pod. Two or three analysts run the groundwork pieces in parallel (market sizing, comparable transactions, financial modelling). Partners take it from there once the memo lands. Triggers off any inbound deal flow, plus our weekly pipeline review.',
  volume: 'A few a day',
  team_size: '6-15',
  context:
    'Team lives in Gmail, Excel, Google Docs, and Notion. Partners review every analyst memo before client send. Have tried hiring junior analysts before; turnover ate the leverage gains.',
  urgency: 'This week',
  email: 'aj@optio.capital',
};

export const DEMO_CAPABILITY_MAP: CapabilityMapData = {
  interpretation:
    "AJ, your investment process is shaped like analysis and judgment work, parallel research streams that feed a small set of high-stakes calls. By mapping it into capabilities, roughly 50% is structured groundwork that can run in parallel with agents, freeing your senior team for the judgment, client conversations, and final decisions that actually drive returns.",
  capabilities: [
    {
      label: 'Initial deal sourcing and qualification',
      allocation: 'agent',
      detail:
        'Scans the market against your investment criteria and surfaces a ranked shortlist for partner review.',
    },
    {
      label: 'Market sizing and trend analysis',
      allocation: 'agent',
      detail:
        'Pulls TAM, growth, and trend data from primary sources, structured for the investment memo.',
    },
    {
      label: 'Comparable transaction research',
      allocation: 'agent',
      detail:
        'Builds a comp set of recent transactions with multiples, structures, and outcomes.',
    },
    {
      label: 'Financial modelling first-pass',
      allocation: 'hybrid',
      detail: 'Agent builds the base model from filings; senior analyst stress-tests the assumptions.',
    },
    {
      label: 'Competitive landscape mapping',
      allocation: 'agent',
      detail: 'Identifies and profiles competitors, surfaces moat and exposure.',
    },
    {
      label: 'Legal document review and flagging',
      allocation: 'hybrid',
      detail: 'Agent reads the data room and flags clauses; counsel adjudicates the flags.',
    },
    {
      label: 'Compliance and regulatory verification',
      allocation: 'agent',
      detail: 'Runs sanctions, regulatory, and entity checks on every counterparty.',
    },
    {
      label: 'Risk assessment and synthesis',
      allocation: 'hybrid',
      detail: 'Agent assembles the risk register from the parallel workstreams; partner shapes it.',
    },
    {
      label: 'Investment thesis and recommendation',
      allocation: 'human',
      detail: 'The judgment call. Partner-led, informed by everything above.',
    },
    {
      label: 'Final valuation and pricing decision',
      allocation: 'human',
      detail: 'Partner-only call where market judgment, relationships, and risk meet.',
    },
    {
      label: 'Client-facing investment recommendations',
      allocation: 'human',
      detail: 'Trust-based conversations with HNW clients. Stays with you.',
    },
    {
      label: 'Deal pipeline and status tracking',
      allocation: 'agent',
      detail: 'Real-time view of where every live deal sits across the workstreams.',
    },
  ],
  percentages: { human: 25, hybrid: 25, agent: 50 },
  team: {
    human_owner: {
      name: 'AJ Milne',
      role: 'Investment thesis, valuation, client relationships, and final calls.',
    },
    team_leader: 'Flow',
    agents: [
      {
        name: 'Flow',
        role: 'Team Leader',
        short_desc:
          'Coordinates the deal pipeline, holds quality across the workstreams, and surfaces what needs partner judgment.',
      },
      {
        name: 'Duke',
        role: 'Investment Analyst',
        short_desc:
          'Builds first-pass financial models, pulls comparable transactions, and prepares the numbers for partner review.',
      },
      {
        name: 'Bec',
        role: 'Research Analyst',
        short_desc:
          'Maps market sizing, competitive landscape, and trend signals end-to-end, in a single voice.',
      },
      {
        name: 'Verity',
        role: 'Legal & Compliance',
        short_desc:
          'Reads data rooms, flags risk and clauses, and runs regulatory and compliance checks before signoff.',
      },
    ],
  },
  leverage_estimate: '3-5x',
  leverage_rationale:
    "Solving this with traditional hiring would require approximately 2 additional FTE (research analyst + junior associate) at $90,000-$120,000 each, plus partner time supervising the work. Your agent team achieves equivalent throughput, compressing the research-to-recommendation cycle from weeks to days and concentrating senior partner time on the judgment calls that drive returns.",
  pricing_indicative: {
    map: {
      label: 'Map',
      from: 5000,
      currency: 'AUD',
      description: 'Capability mapping and team design',
    },
    transform: {
      label: 'Transform',
      from: 10000,
      currency: 'AUD',
      description: 'Build, train, and deploy the agent team',
    },
    operate: {
      label: 'Operate',
      from: 999,
      currency: 'AUD',
      period: 'month',
      description: 'Ongoing agent team operation and optimisation',
    },
  },
  hiring_comparison: {
    equivalent_fte: 2,
    estimated_annual_cost: '180,000-240,000',
    currency: 'AUD',
    note: 'Plus recruitment, onboarding, leave, and partner supervision time',
  },
  shape_internal: 'Analysis and Judgment',
  shape_id: 1,
  generated_by: 'rule_based',
};
