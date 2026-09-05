/**
 * THE SIX USE CASES, AS DATA (D96, step 4 of the plan in analytics-and-scale.md).
 *
 * Marrs, 3 September: the team's word is USE CASE, not lane. In this codebase `lane` already means
 * the stream (whose board a narrative sits on), so the new axis is named `use_case` everywhere and
 * never `lane`, or the two would be confused in a week.
 *
 * WHAT A USE CASE IS. What a post is about and who it is for: hiring managers, sales leaders, the
 * person who owns security. The content strategy v0.2 (section 09) defines six, each with a Kit
 * segment, a lead magnet and a landing page. The lead nurture design (docs/handoff/
 * leo-lead-nurture-design.md) uses the same six segment ids, so the id here IS the Kit segment id
 * and a lead tagged from a link needs no translation.
 *
 * WHY DATA AND NOT PROSE. Three readers need the same list and must never disagree: Gate 1 (the
 * picker), the link builder (utm_campaign), and the site (which use case a lead belongs to). One
 * array, three imports.
 *
 * PURE. No store, no fetch, so the picker can import it in the browser and the tests can assert
 * it without a network.
 */

export type UseCase = {
  /** The Kit segment id from the strategy. Persisted on narratives, pieces, entries and leads. */
  id: string;
  /** What the operator sees. */
  label: string;
  /** One line for April and for the picker's hint. */
  hint: string;
  /**
   * WHERE THE LINK LANDS. A path on polynize.ai, never a full url: the origin is decided once by
   * the link builder so a staging build cannot bake a production host into a stored link.
   *
   * Two use cases have no magnet yet (the strategy says TO_BUILD and undefined), so their links
   * land on the home page. The strategy's own rule is "no magnet, no post"; the console does not
   * enforce that here because a post with a labelled link to the home page still tells us which
   * post earned the click, and refusing to prepare it would hide the gap rather than measure it.
   */
  landing: string;
  /** The magnet's name, for the picker. Absent when there is none yet. */
  magnet?: string;
  /**
   * WORDS THAT SUGGEST THIS USE CASE, lowercase. Used only to pre-select a default at Gate 1 from
   * the idea text, which the operator then confirms or changes. A guess that is shown and editable
   * is a convenience; a guess that is silently stored would be a lie about intent.
   */
  cues: string[];
};

export const USE_CASES: readonly UseCase[] = [
  {
    id: 'ai_capability_lead',
    label: 'AI capability',
    hint: 'Teams working out what AI changes in their work',
    landing: '/map-your-team',
    magnet: 'Map your team',
    cues: ['ai', 'agent', 'agents', 'automation', 'llm', 'copilot', 'capability map', 'strip the ai'],
  },
  {
    id: 'sales_lead',
    label: 'Sales capability',
    hint: 'Sales leaders and their teams',
    landing: '/map-your-team',
    magnet: 'Capability map your team',
    cues: ['sales', 'pipeline', 'quota', 'deal', 'prospect', 'revenue', 'sdr', 'closing'],
  },
  {
    id: 'ld_lead',
    label: 'Leadership development',
    hint: 'L&D and people leaders',
    landing: '/map-your-team',
    magnet: 'Capability map your team',
    cues: ['leadership', 'leader', 'l&d', 'learning', 'development', 'training', 'coaching', 'manager'],
  },
  {
    id: 'hiring_manager',
    label: 'Hiring assessment',
    hint: 'Hiring managers assessing a role or a candidate',
    landing: '/agents',
    magnet: 'Map a bottleneck',
    cues: ['hiring', 'hire', 'recruit', 'candidate', 'interview', 'job description', 'role', 'headcount'],
  },
  {
    id: 'security_lead',
    label: 'Cybersecurity',
    hint: 'Security leads and their teams. No magnet yet.',
    landing: '/',
    cues: ['security', 'cyber', 'ciso', 'threat', 'breach', 'compliance', 'soc'],
  },
  {
    id: 'deal_side',
    label: 'Acquisition diagnostic',
    hint: 'Buyers and advisers on a deal. No magnet yet.',
    landing: '/',
    cues: ['acquisition', 'acquire', 'm&a', 'merger', 'due diligence', 'investor', 'portfolio', 'private equity'],
  },
];

const BY_ID = new Map(USE_CASES.map((u) => [u.id, u]));

export function isUseCaseId(x: unknown): x is string {
  return typeof x === 'string' && BY_ID.has(x);
}

export function labelForUseCase(id: string | undefined): string {
  return (id && BY_ID.get(id)?.label) || 'No use case';
}

export function findUseCase(id: string | undefined): UseCase | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/**
 * Where a link for this use case should land, as a path. Unknown or absent falls back to the home
 * page rather than throwing: a link that lands somewhere is worth more than a prepare that fails.
 */
export function landingFor(id: string | undefined): string {
  return findUseCase(id)?.landing ?? '/';
}

/**
 * THE DEFAULT AT GATE 1. The use case whose cues appear most in the idea; undefined when none do,
 * so the picker shows "pick one" rather than a wrong guess dressed as a choice.
 *
 * Word-boundary matching, so "ai" does not fire on "said" and "role" does not fire on "roles"
 * missing is accepted: recall is deliberately low, because the cost of a wrong default that gets
 * confirmed by a tired click is a mislabelled fortnight of posts.
 */
export function guessUseCase(idea: string): string | undefined {
  const text = ` ${idea.toLowerCase().replace(/\s+/g, ' ')} `;
  let best: { id: string; hits: number } | undefined;
  for (const u of USE_CASES) {
    let hits = 0;
    for (const cue of u.cues) {
      const re = new RegExp(`(^|[^a-z0-9])${cue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`, 'i');
      if (re.test(text)) hits += 1;
    }
    if (hits > 0 && (!best || hits > best.hits)) best = { id: u.id, hits };
  }
  return best?.id;
}
