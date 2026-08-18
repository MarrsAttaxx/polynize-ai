import { z } from 'zod';

/**
 * The job blueprint: one job description broken into the capabilities it actually asks
 * for, each allocated human, hybrid or agent.
 *
 * THREE LANES, NOT FOUR (Marrs, 12 Aug 2026). The brief listed four things a reader wants
 * to know: what AI can do, what agentic workflows can do, what stays human, what is
 * hybrid. That is four ideas but it is still three lanes, because coral = human,
 * amber = hybrid, mint = agent is the token contract across this entire site and the
 * Console. The AI-versus-agentic distinction is carried by `mechanism` on each capability
 * instead: a short plain phrase saying how the work actually gets done. "AI drafts, you
 * approve" and "runs end to end without you" both sit in the agent lane and read as
 * completely different jobs, which is the distinction the brief was after.
 *
 * EVERY FIELD USES .catch(). Same posture as the sales blueprint: a model that omits or
 * malforms one field should cost that field, not the whole document. `validateJobBlueprint`
 * then drops capabilities that came back empty, because a blank row in a table a stranger
 * is reading is worse than a shorter table.
 */

const Allocation = z.enum(['human', 'hybrid', 'agent']).catch('hybrid');

const Capability = z.object({
  id: z.string().catch(''),
  name: z.string().catch(''),
  /** The part of the job this belongs to, e.g. "Pipeline", "Reporting". Groups the table. */
  cluster: z.string().catch('Capabilities'),
  allocation: Allocation,
  /**
   * How the work actually gets done, in one short phrase. This is where the AI-assisted
   * versus fully-agentic distinction lives; see the module comment.
   */
  mechanism: z.string().catch(''),
  /** Two or three sentences on what this capability involves in this role. */
  detail: z.string().catch(''),
  /** The concrete tasks inside it. Shown when a row is opened. */
  tasks: z.array(z.string()).catch([]),
  /** Rough share of the role, as a percentage. Indicative, and labelled as such. */
  time_share: z.coerce.number().catch(0),
  /** Why it landed in this lane. The reader has to be able to argue with it. */
  reasoning: z.string().catch(''),
});

export const JobBlueprintSchema = z.object({
  role_title: z.string().catch('This role'),
  /** One line: what this job actually is, so the document does not open on a table. */
  role_summary: z.string().catch(''),
  seniority: z.string().catch(''),
  function: z.string().catch(''),
  capabilities: z.array(Capability).catch([]),
  /** One paragraph per lane, read across the whole role. */
  lane_summary: z
    .object({
      human: z.string().catch(''),
      hybrid: z.string().catch(''),
      agent: z.string().catch(''),
    })
    .catch({ human: '', hybrid: '', agent: '' }),
  /**
   * How much of the role is already addressable. Deliberately a three-value read with a
   * sentence attached rather than a score: a number here would be a made-up precision
   * about somebody's livelihood.
   */
  exposure: z
    .object({
      level: z.enum(['low', 'moderate', 'high']).catch('moderate'),
      line: z.string().catch(''),
    })
    .catch({ level: 'moderate', line: '' }),
  /** The judgment that has to stay with a person, named explicitly. */
  keep_human: z.array(z.string()).catch([]),
  /** What to get good at next, given everything above. */
  learn_next: z.array(z.string()).catch([]),
  /** Short narrative: what a week in this role looks like once the map is applied. */
  what_changes: z.string().catch(''),
});

export type JobBlueprint = z.infer<typeof JobBlueprintSchema>;
export type JobCapability = z.infer<typeof Capability>;

export function validateJobBlueprint(
  input: unknown
): { ok: true; data: JobBlueprint } | { ok: false; error: string } {
  const parsed = JobBlueprintSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid' };

  // A capability with no name is not a capability. Drop it rather than render a blank row.
  const usable = parsed.data.capabilities.filter((c) => c.name.trim().length > 0);
  if (usable.length < 3) {
    return { ok: false, error: `only ${usable.length} usable capabilities` };
  }
  return { ok: true, data: { ...parsed.data, capabilities: usable } };
}
