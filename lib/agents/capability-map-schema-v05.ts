import { z } from 'zod';

/**
 * Zod validator for the Cap Matrix v0.5 capability-map schema.
 * Mirrors `03_capability_map_schema.json` (JSON Schema Draft 2020-12) from
 * Shourov's redesign brief. Strict superset of the Mapping Studio row schema.
 */

const AllocationV05Schema = z.enum(['Agent', 'Hybrid', 'Human']);
const FailureCostSchema = z.enum(['Low', 'Medium', 'High', 'N/A']);
const CompletenessSchema = z.enum(['COMPLETE', 'PARTIAL', 'STUB', 'GHOST']);
const ConfidenceSchema = z.enum(['High', 'Medium', 'Low']);
const ClusterTypeSchema = z.enum(['sequential', 'off_cycle']);

const EvidencePointerSchema = z.object({
  source_id: z.enum([
    'q01_business',
    'q03_bottleneck',
    'q04_outcome',
    'q05_work_shape',
    'q06_volume',
    'q08_context',
  ]),
  quote: z.string(),
});

const WorkShapeSchema = z.object({
  type: z
    .string()
    .regex(
      /^(Classification \+ routing|Drafting \+ approval|Calculation against rules|Pattern detection \+ escalation|Decision support|Monitoring \+ alerting|Data lookup \+ assembly|Multi-turn conversation|Other: .+)$/
    ),
  inputs: z.array(z.string()).min(1).max(4),
  output: z.string(),
  trigger: z.string(),
});

const HumanHandoffSchema = z.object({
  emit_artifact: z.string(),
  completion_action: z.string(),
  feedback_signals: z.array(z.string()),
});

const GapSchema = z.object({
  gap_type: z.enum([
    'ALLOCATION',
    'DEFINITION',
    'INCLUSION',
    'WORK_SHAPE',
    'EDGE_CASES',
    'HANDOFF',
    'EVIDENCE',
  ]),
  question: z.string(),
  blocking: z.boolean(),
});

const CapabilityRowSchema = z.object({
  id: z.string().regex(/^[0-9]{2}$/),
  name: z.string().min(1).max(60),
  cluster_id: z.string().regex(/^C[0-9]+$/),
  description: z.string(),
  allocation: AllocationV05Schema,
  allocation_detail: z.string().nullable().optional(),
  reason: z.string(),
  failure_cost: FailureCostSchema,
  failure_cost_note: z.string(),
  work_shape: WorkShapeSchema,
  edge_cases: z.array(z.string().max(200)).max(5),
  evidence: z.array(EvidencePointerSchema).max(3),
  human_handoff: HumanHandoffSchema.nullable(),
  confidence: ConfidenceSchema,
  completeness: CompletenessSchema,
  gaps_to_close: z.array(GapSchema),
  delta_status: z.literal('added'),
});

const ClusterSchema = z.object({
  id: z.string().regex(/^C[0-9]+$/),
  name: z.string().min(1).max(30),
  order: z.number().int().min(1),
  cluster_type: ClusterTypeSchema,
  trigger_clusters: z.array(z.string().regex(/^C[0-9]+$/)).optional(),
});

const ScopeBriefSchema = z.object({
  name: z.string(),
  statement: z.string(),
  scope_inclusions: z.array(z.string()),
  scope_exclusions: z.array(z.string()),
  resolution: z.literal('team_unit'),
});

const AllocationSummarySchema = z.object({
  by_row_count: z.object({
    agent: z.number().int().min(0),
    hybrid: z.number().int().min(0),
    human: z.number().int().min(0),
  }),
  row_count_total: z.number().int().min(7).max(13),
  ghost_count: z.number().int().min(0),
  percentages: z.object({
    agent: z.number().int().min(0).max(100),
    hybrid: z.number().int().min(0).max(100),
    human: z.number().int().min(0).max(100),
  }),
  notes: z.string(),
});

const MapReflectionSchema = z.object({
  scope_uncertainty: z.array(
    z.object({ topic: z.string(), question: z.string() })
  ),
  cross_cutting_candidates: z.array(
    z.object({
      item: z.string(),
      reading: z.enum(['interface', 'doctrine', 'missing_row']),
      question: z.string(),
    })
  ),
  decisions_deferred: z.array(
    z.object({ topic: z.string(), reason: z.string() })
  ),
});

const ExcludedCapabilitySchema = z.object({
  name: z.string(),
  reason: z.string(),
});

const DeltaSummarySchema = z.object({
  mode: z.literal('COLD_START'),
  rows_added: z.array(z.string().regex(/^[0-9]{2}$/)),
  rows_modified: z.array(z.unknown()).max(0),
  rows_promoted: z.array(z.unknown()).max(0),
  rows_removed: z.array(z.unknown()).max(0),
  narrative: z.string(),
});

const TeamSchema = z.object({
  human_owner: z.object({
    name: z.string(),
    role: z.string(),
  }),
  agents: z
    .array(
      z.object({
        name: z.string(),
        role: z.string(),
        short_desc: z.string(),
      })
    )
    .min(2)
    .max(6),
  // Optional: names the agent that leads the team (must match an entry in
  // `agents` by `name`). Drives the org-chart's tier-2 (team leader agent)
  // in the canonical 3-tier CWU. Omitted for grandfathered units like
  // Roxbury, which render two tiers (human owner → workers). Optional, so
  // existing maps without it validate unchanged.
  team_leader: z.string().optional(),
});

const PricingIndicativeSchema = z.object({
  map: z.object({
    label: z.literal('Map'),
    from: z.literal(5000),
    currency: z.literal('AUD'),
    description: z.string(),
  }),
  transform: z.object({
    label: z.literal('Transform'),
    from: z.literal(10000),
    currency: z.literal('AUD'),
    description: z.string(),
  }),
  operate: z.object({
    label: z.literal('Operate'),
    from: z.literal(999),
    currency: z.literal('AUD'),
    period: z.literal('month'),
    description: z.string(),
  }),
});

const HiringComparisonSchema = z.object({
  equivalent_fte: z.number().min(0),
  estimated_annual_cost: z.string(),
  currency: z.literal('AUD'),
  note: z.string(),
});

const ShapeInternalSchema = z.enum([
  'Analysis and Judgment',
  'Pipeline and Conversion',
  'Execution and Delivery',
  'Executive Leverage',
  'Relationship Continuity',
  'High-Volume Operations',
  'Creative Direction',
  'Learning and Capability',
]);

export const CapabilityMapV05Schema = z.object({
  stage: z.literal('MAP_V0_5'),
  scope_brief: ScopeBriefSchema,
  interpretation: z.string(),
  clusters: z.array(ClusterSchema).min(2).max(4),
  capabilities: z.array(CapabilityRowSchema).min(7).max(13),
  allocation_summary: AllocationSummarySchema,
  map_reflection: MapReflectionSchema,
  excluded_capabilities: z.array(ExcludedCapabilitySchema),
  delta_summary: DeltaSummarySchema,
  team: TeamSchema,
  leverage_estimate: z.enum(['1.5-2x', '2-4x', '3-5x', '5x+']),
  leverage_rationale: z.string(),
  pricing_indicative: PricingIndicativeSchema,
  hiring_comparison: HiringComparisonSchema,
  shape_internal: ShapeInternalSchema,
  shape_id: z.number().int().min(1).max(8),
});

export const CapabilityMapV05EnvelopeSchema = z.object({
  capability_map: CapabilityMapV05Schema,
});

export type ParsedCapabilityMapV05 = z.infer<typeof CapabilityMapV05Schema>;

export function validateCapabilityMapV05(
  json: unknown
): { ok: true; data: ParsedCapabilityMapV05 } | { ok: false; error: string } {
  const parsed = CapabilityMapV05EnvelopeSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; '),
    };
  }

  const map = parsed.data.capability_map;

  // Cross-field validations beyond the schema:

  // 1. Percentages should sum ~100 (allow 95-105 for rounding).
  const sum =
    map.allocation_summary.percentages.agent +
    map.allocation_summary.percentages.hybrid +
    map.allocation_summary.percentages.human;
  if (sum < 95 || sum > 105) {
    return { ok: false, error: `percentages sum to ${sum}, expected ~100` };
  }

  // 2. Every cluster_id referenced by a row must exist in clusters.
  const clusterIds = new Set(map.clusters.map((c) => c.id));
  for (const row of map.capabilities) {
    if (!clusterIds.has(row.cluster_id)) {
      return {
        ok: false,
        error: `capability ${row.id} references unknown cluster_id "${row.cluster_id}"`,
      };
    }
  }

  // 3. Agent rows must have human_handoff: null.
  // 4. Hybrid/Human rows must have non-null human_handoff OR a HANDOFF gap.
  for (const row of map.capabilities) {
    if (row.allocation === 'Agent' && row.human_handoff !== null) {
      return {
        ok: false,
        error: `Agent row ${row.id} must have human_handoff: null`,
      };
    }
    if (row.allocation !== 'Agent' && row.human_handoff === null) {
      const hasHandoffGap = row.gaps_to_close.some(
        (g) => g.gap_type === 'HANDOFF'
      );
      if (!hasHandoffGap && row.completeness === 'COMPLETE') {
        return {
          ok: false,
          error: `Row ${row.id} (${row.allocation}) has null human_handoff but is COMPLETE without a HANDOFF gap`,
        };
      }
    }
  }

  // 5. Row ids must be unique and sequential.
  const ids = map.capabilities.map((r) => r.id);
  const expected = Array.from({ length: ids.length }, (_, i) =>
    String(i + 1).padStart(2, '0')
  );
  if (JSON.stringify(ids) !== JSON.stringify(expected)) {
    return {
      ok: false,
      error: `row ids not unique-and-sequential (got ${ids.join(',')})`,
    };
  }

  return { ok: true, data: map };
}
