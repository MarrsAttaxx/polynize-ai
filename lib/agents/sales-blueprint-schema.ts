import { z } from 'zod';

/**
 * Sales Blueprint envelope (working-session capability map).
 *
 * This is the client-facing artifact generated at /blueprint. It is a richer,
 * consultative cousin of the /agents capability map: same allocation semantics
 * (coral = human, amber = hybrid, mint = agent) but extended into benchmark,
 * transformation, team-design, and (stretch) build/outcome sections so Marrs can
 * walk a client through an approximation of what real capability mapping looks
 * like in a live session.
 *
 * Parsing is deliberately TOLERANT. The prompt asks the model to approximate and
 * to leave thin fields as "Not enough information", so a single dropped field on
 * one row must never nuke the whole map. Every field has a `.catch()` default,
 * and normalizeSalesBlueprint() drops only genuinely unusable capability rows
 * (no name) and re-sequences ids. The single hard requirement is at least one
 * usable capability row; below that we surface a retryable error.
 */

const Allocation = z.enum(['human', 'hybrid', 'agent']).catch('hybrid');
const Confidence = z.enum(['high', 'medium', 'low']).catch('medium');
const Completeness = z.enum(['complete', 'partial', 'stub', 'ghost']).catch('partial');
const Risk = z.enum(['low', 'mod', 'high', 'maj']).catch('mod');

const WorkflowStep = z.object({
  label: z.string().catch(''),
  risk: Risk,
});

const WorkflowPhase = z.object({
  name: z.string().catch('Phase'),
  steps: z.array(WorkflowStep).catch([]),
});

const Capability = z.object({
  id: z.string().catch(''),
  name: z.string().catch(''),
  cluster: z.string().catch('Capabilities'),
  allocation: Allocation,
  detail: z.string().catch(''),
  /** Point-form breakdown of what the capability involves; shown in the row dropdown. */
  tasks: z.array(z.string()).catch([]),
  current_level: z.coerce.number().catch(40),
  benchmark_level: z.coerce.number().catch(85),
  confidence: Confidence,
  completeness: Completeness,
  gap_question: z.string().nullable().catch(null),
  transformation: z
    .object({
      person_led: z.string().catch(''),
      agent_move: z.string().catch('Not enough information'),
    })
    .catch({ person_led: '', agent_move: 'Not enough information' }),
});

const TeamAgent = z.object({
  name: z.string().catch(''),
  role: z.string().catch(''),
  desc: z.string().catch(''),
});

export const SalesBlueprintSchema = z.object({
  client: z.string().catch('Not enough information'),
  session: z.string().catch(''),
  purpose: z.string().catch(''),
  bottleneck: z.string().catch(''),
  current_workflow: z
    .object({
      narrative: z.string().catch(''),
      phases: z.array(WorkflowPhase).catch([]),
    })
    .catch({ narrative: '', phases: [] }),
  capabilities: z.array(Capability).catch([]),
  benchmark_summary: z.string().catch(''),
  team_design: z
    .object({
      status: z.literal('proposed_to_confirm').catch('proposed_to_confirm'),
      agents: z.array(TeamAgent).catch([]),
    })
    .catch({ status: 'proposed_to_confirm', agents: [] }),
  build_plan: z.string().catch('Not enough information'),
  outcomes: z.string().catch('Not enough information'),
  what_good_looks_like: z.string().catch(''),
});

export type SalesBlueprint = z.infer<typeof SalesBlueprintSchema>;

/**
 * Parse tolerantly, then normalize: drop capability rows without a usable name,
 * clamp levels to 0-100, and re-sequence ids C01.. so the renderer and the
 * benchmark bars stay consistent. Returns an error only when nothing usable
 * survives (so the UI can offer a retry).
 */
export function validateSalesBlueprint(
  json: unknown
): { ok: true; data: SalesBlueprint } | { ok: false; error: string } {
  const parsed = SalesBlueprintSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first?.path?.join('.') || '(root)';
    return { ok: false, error: `${where}: ${first?.message ?? 'invalid shape'}` };
  }

  const data = parsed.data;

  const usable = data.capabilities
    .filter((c) => c.name.trim().length > 0)
    .map((c, i) => ({
      ...c,
      id: `C${String(i + 1).padStart(2, '0')}`,
      current_level: clamp(c.current_level),
      benchmark_level: clamp(c.benchmark_level),
    }));

  if (usable.length === 0) {
    return { ok: false, error: 'no usable capability rows in model output' };
  }

  return { ok: true, data: { ...data, capabilities: usable } };
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 40;
  return Math.max(0, Math.min(100, Math.round(n)));
}
