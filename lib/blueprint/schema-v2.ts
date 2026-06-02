/**
 * Stage 2 Blueprint Data Model — TypeScript types + Zod validators
 *
 * Source of truth: stage2-data-model.md §4, §5, §6, §10.
 *
 * - `CapabilityMapV05` is RE-EXPORTED from `lib/agents/capability-map-schema-v05.ts`
 *   (the polynize-ai canonical shape) so there is exactly one definition.
 * - All other shapes (EngagementModel, WorkPlan, ProjectTimeline, LockState)
 *   are defined here.
 *
 * Per the spec: every Stage 2 file imports from this module, so type changes
 * land in one place.
 */

import { z } from 'zod';

// ============================================================
// CapabilityMap re-exports (single source of truth)
// ============================================================

export {
  CapabilityMapV05Schema,
  CapabilityMapV05EnvelopeSchema,
  validateCapabilityMapV05,
} from '../agents/capability-map-schema-v05';

export type { ParsedCapabilityMapV05 } from '../agents/capability-map-schema-v05';

// A friendly alias so call sites can use `CapabilityMapV05` directly.
import type { ParsedCapabilityMapV05 } from '../agents/capability-map-schema-v05';
import { CapabilityMapV05EnvelopeSchema as _EnvelopeSchema } from '../agents/capability-map-schema-v05';
export type CapabilityMapV05 = ParsedCapabilityMapV05;

/**
 * Normalise a stored capability-map blob into the canonical v0.5 envelope
 * `{ capability_map: {...} }`.
 *
 * Supabase stores the map in `blueprints.data.data`. Empirically that is the
 * BARE v0.5 map (with `stage: "MAP_V0_5"` at the top level), NOT the
 * enveloped form. Older rows store the LEGACY flat shape (no `stage`). This
 * reconciles all three inputs so consumers (the lookup endpoint, the seed
 * flow) get one shape:
 *   - already `{ capability_map }`  → validated and returned
 *   - bare v0.5 (`stage` at top)    → wrapped, validated, returned
 *   - legacy / anything else        → null (not seedable as a 2.0 Blueprint)
 */
export function normalizeToV05Envelope(
  data: unknown
): { capability_map: ParsedCapabilityMapV05 } | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;

  // Already enveloped?
  if (obj.capability_map && typeof obj.capability_map === 'object') {
    const parsed = _EnvelopeSchema.safeParse(obj);
    return parsed.success ? parsed.data : null;
  }

  // Bare v0.5 (stage at the top level)?
  if (obj.stage === 'MAP_V0_5') {
    const parsed = _EnvelopeSchema.safeParse({ capability_map: obj });
    return parsed.success ? parsed.data : null;
  }

  // Legacy flat shape or unknown — there is no v0.5 envelope to produce.
  return null;
}

// ============================================================
// Lenient read schema (Console loader) — "strict on generate, liberal
// on read" (Postel's law).
//
// The website's generation quality-gate (`validateCapabilityMapV05`,
// used only by /api/capability-map/generate) stays STRICT. The Console
// LOADER (loadBlueprintV2) instead parses with this lenient schema so it
// accepts the broader real-world vocabulary that Shourov's capability
// blueprints — and, later, Cognitive Studio and Ben — produce.
//
// It validates STRUCTURE and the two enums the renderer is load-bearing
// on (allocation drives the heatmap lane; completeness drives the cell
// treatment). Everything else is liberal: work_shape.type, delta_status,
// shape_internal, leverage_estimate, failure_cost, confidence, gap_type,
// cluster_type, resolution, etc. are free strings, and pricing_indicative
// / hiring_comparison (unused by the Console) are optional.
// ============================================================

const LenientWorkShapeSchema = z.object({
  type: z.string(),
  inputs: z.array(z.string()).default([]),
  output: z.string().default(''),
  trigger: z.string().default(''),
});

const LenientCapabilityRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  cluster_id: z.string(),
  description: z.string().default(''),
  allocation: z.enum(['Agent', 'Hybrid', 'Human']), // load-bearing (heatmap)
  allocation_detail: z.string().nullable().optional(),
  reason: z.string().default(''),
  failure_cost: z.string().default('N/A'),
  failure_cost_note: z.string().default(''),
  work_shape: LenientWorkShapeSchema,
  edge_cases: z.array(z.string()).default([]),
  evidence: z
    .array(z.object({ source_id: z.string(), quote: z.string() }))
    .default([]),
  human_handoff: z
    .object({
      emit_artifact: z.string(),
      completion_action: z.string(),
      feedback_signals: z.array(z.string()).default([]),
    })
    .nullable()
    .default(null),
  confidence: z.string().default('Medium'),
  completeness: z.enum(['COMPLETE', 'PARTIAL', 'STUB', 'GHOST']), // load-bearing
  gaps_to_close: z
    .array(
      z.object({
        gap_type: z.string(),
        question: z.string(),
        blocking: z.boolean().default(false),
      })
    )
    .default([]),
  delta_status: z.string().default('added'),
});

const LenientCapabilityMapSchema = z.object({
  stage: z.string(),
  scope_brief: z.object({
    name: z.string(),
    statement: z.string().default(''),
    scope_inclusions: z.array(z.string()).default([]),
    scope_exclusions: z.array(z.string()).default([]),
    resolution: z.string().default('team_unit'),
  }),
  interpretation: z.string().default(''),
  clusters: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      order: z.number(),
      cluster_type: z.string(),
      trigger_clusters: z.array(z.string()).optional(),
    })
  ),
  capabilities: z.array(LenientCapabilityRowSchema).min(1),
  allocation_summary: z.object({
    by_row_count: z.object({
      agent: z.number(),
      hybrid: z.number(),
      human: z.number(),
    }),
    row_count_total: z.number(),
    ghost_count: z.number(),
    percentages: z.object({
      agent: z.number(),
      hybrid: z.number(),
      human: z.number(),
    }),
    notes: z.string().default(''),
  }),
  map_reflection: z.object({
    scope_uncertainty: z
      .array(z.object({ topic: z.string(), question: z.string() }))
      .default([]),
    cross_cutting_candidates: z
      .array(
        z.object({
          item: z.string(),
          reading: z.string(),
          question: z.string(),
        })
      )
      .default([]),
    decisions_deferred: z
      .array(z.object({ topic: z.string(), reason: z.string() }))
      .default([]),
  }),
  excluded_capabilities: z
    .array(z.object({ name: z.string(), reason: z.string() }))
    .default([]),
  delta_summary: z.object({
    mode: z.string(),
    narrative: z.string().default(''),
    rows_added: z.array(z.string()).default([]),
    rows_removed: z.array(z.unknown()).default([]),
    rows_modified: z.array(z.unknown()).default([]),
    rows_promoted: z.array(z.unknown()).default([]),
  }),
  team: z.object({
    human_owner: z.object({ name: z.string(), role: z.string() }),
    agents: z
      .array(
        z.object({
          name: z.string(),
          role: z.string(),
          short_desc: z.string().default(''),
        })
      )
      .min(1),
    team_leader: z.string().optional(),
  }),
  leverage_estimate: z.string().default(''),
  leverage_rationale: z.string().default(''),
  pricing_indicative: z.unknown().optional(),
  hiring_comparison: z.unknown().optional(),
  shape_internal: z.string().default(''),
  shape_id: z.number().optional(),
});

export const LenientCapabilityMapV05EnvelopeSchema = z.object({
  capability_map: LenientCapabilityMapSchema,
});

// ============================================================
// Schema version (legacy vs Stage 2)
// ============================================================

export type BlueprintSchemaVersion = '1.0' | '1.1' | '2.0';

export const BlueprintSchemaVersionSchema = z.union([
  z.literal('1.0'),
  z.literal('1.1'),
  z.literal('2.0'),
]);

// ============================================================
// Lock state (spec §6)
// ============================================================

export interface LockState {
  locked: boolean;
  locked_at: string | null;
  locked_by: string | null;
  lock_version: number;
  unlock_reason: string | null;
}

export const LockStateSchema = z.object({
  locked: z.boolean(),
  locked_at: z.string().nullable(),
  locked_by: z.string().nullable(),
  lock_version: z.number().int().min(0),
  unlock_reason: z.string().nullable(),
});

export const UNLOCKED_INITIAL: LockState = {
  locked: false,
  locked_at: null,
  locked_by: null,
  lock_version: 0,
  unlock_reason: null,
};

// ============================================================
// Engagement Model (spec §4.2)
// ============================================================

export type UpliftNeeded =
  | 'At Benchmark'
  | 'Low'
  | 'Moderate'
  | 'High'
  | 'Major';

export type RowStatus = 'draft' | 'agreed' | 'locked';

export interface EngagementRow {
  capability_id: string; // "01"
  current_state: string;
  benchmark: string;
  uplift_needed: UpliftNeeded;
  uplift_moves: {
    people_train: string | null;
    process_transform: string | null;
    ai_deploy: string | null;
  };
  held: boolean;
  row_status: RowStatus;
}

export const EngagementRowSchema = z.object({
  capability_id: z.string().regex(/^[0-9]{2}$/),
  current_state: z.string(),
  benchmark: z.string(),
  uplift_needed: z.enum(['At Benchmark', 'Low', 'Moderate', 'High', 'Major']),
  uplift_moves: z.object({
    people_train: z.string().nullable(),
    process_transform: z.string().nullable(),
    ai_deploy: z.string().nullable(),
  }),
  held: z.boolean(),
  row_status: z.enum(['draft', 'agreed', 'locked']),
});

export type MotionId = 'agent_deploy' | 'training' | 'transform';

export interface Motion {
  id: MotionId;
  label: string;
  accent: 'amber' | 'teal' | 'white';
  description: string;
  covers: {
    capability_ids: string[];
    cluster_ids: string[];
    cross_cutting: string[];
  };
}

export const MotionSchema = z.object({
  id: z.enum(['agent_deploy', 'training', 'transform']),
  label: z.string(),
  accent: z.enum(['amber', 'teal', 'white']),
  description: z.string(),
  covers: z.object({
    capability_ids: z.array(z.string().regex(/^[0-9]{2}$/)),
    cluster_ids: z.array(z.string().regex(/^C[0-9]+$/)),
    cross_cutting: z.array(z.string()),
  }),
});

export interface EngagementModel {
  schema_version: '1.0';
  generated_from: string;
  last_updated: string;
  lock_state: LockState;
  rows: { [capabilityId: string]: EngagementRow };
  motions: Motion[];
}

export const EngagementModelSchema = z.object({
  schema_version: z.literal('1.0'),
  generated_from: z.string(),
  last_updated: z.string(),
  lock_state: LockStateSchema,
  rows: z.record(z.string().regex(/^[0-9]{2}$/), EngagementRowSchema),
  motions: z.array(MotionSchema),
});

// ============================================================
// Work Plan (spec §5.1)
// ============================================================

export type SprintStageId =
  | 'sprint_map'
  | 'cognition_design'
  | 'cognition_install'
  | 'internal_testing'
  | 'external_testing'
  | 'refine'
  | 'handoff'
  | 'operate';

export const SPRINT_STAGE_ORDER: SprintStageId[] = [
  'sprint_map',
  'cognition_design',
  'cognition_install',
  'internal_testing',
  'external_testing',
  'refine',
  'handoff',
  'operate',
];

export const SPRINT_STAGE_LABELS: Record<SprintStageId, string> = {
  sprint_map: 'Sprint Map',
  cognition_design: 'Cognition Design',
  cognition_install: 'Cognition Install',
  internal_testing: 'Internal Testing',
  external_testing: 'External Testing',
  refine: 'Refine',
  handoff: 'Handoff',
  operate: 'Operate',
};

export interface SprintStage {
  id: SprintStageId;
  label: string;
  status: 'pending' | 'active' | 'complete';
  note: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export const SprintStageSchema = z.object({
  id: z.enum([
    'sprint_map',
    'cognition_design',
    'cognition_install',
    'internal_testing',
    'external_testing',
    'refine',
    'handoff',
    'operate',
  ]),
  label: z.string(),
  status: z.enum(['pending', 'active', 'complete']),
  note: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
});

export interface WorkPlan {
  id: string;
  title: string;
  deliverable_type: 'agent' | 'training' | 'transform';
  covers_capabilities: string[];
  status: 'not_started' | 'in_progress' | 'operate' | 'archived';
  current_stage: SprintStageId | null;
  sprint_stages: SprintStage[];
  requirements: {
    context: string | null;
    functional: string | null;
    integrations: string | null;
    non_functional: string | null;
  };
  dependencies: string[];
  depends_on_stage: SprintStageId | null;
  progress_pct: number;
  created_at: string;
  last_updated: string;
}

export const WorkPlanSchema = z.object({
  id: z.string(),
  title: z.string(),
  deliverable_type: z.enum(['agent', 'training', 'transform']),
  covers_capabilities: z.array(z.string().regex(/^[0-9]{2}$/)),
  status: z.enum(['not_started', 'in_progress', 'operate', 'archived']),
  current_stage: z
    .enum([
      'sprint_map',
      'cognition_design',
      'cognition_install',
      'internal_testing',
      'external_testing',
      'refine',
      'handoff',
      'operate',
    ])
    .nullable(),
  sprint_stages: z.array(SprintStageSchema),
  requirements: z.object({
    context: z.string().nullable(),
    functional: z.string().nullable(),
    integrations: z.string().nullable(),
    non_functional: z.string().nullable(),
  }),
  dependencies: z.array(z.string()),
  depends_on_stage: z
    .enum([
      'sprint_map',
      'cognition_design',
      'cognition_install',
      'internal_testing',
      'external_testing',
      'refine',
      'handoff',
      'operate',
    ])
    .nullable(),
  progress_pct: z.number().min(0).max(100),
  created_at: z.string(),
  last_updated: z.string(),
});

// ============================================================
// Project Timeline (spec §10)
// ============================================================

export interface TimelineItem {
  id: string;
  label: string;
  item_type: 'infrastructure' | 'work_plan' | 'milestone';
  work_plan_id: string | null;
  start: string; // ISO 8601 date
  duration_days: number;
  dependencies: string[];
  status: 'not_started' | 'in_progress' | 'complete' | 'blocked';
  lane: number;
  progress_pct: number;
}

export const TimelineItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  item_type: z.enum(['infrastructure', 'work_plan', 'milestone']),
  work_plan_id: z.string().nullable(),
  start: z.string(),
  duration_days: z.number().int().min(0),
  dependencies: z.array(z.string()),
  status: z.enum(['not_started', 'in_progress', 'complete', 'blocked']),
  lane: z.number().int().min(0),
  progress_pct: z.number().min(0).max(100),
});

export interface ProjectTimeline {
  schema_version: '1.0';
  items: TimelineItem[];
}

export const ProjectTimelineSchema = z.object({
  schema_version: z.literal('1.0'),
  items: z.array(TimelineItemSchema),
});

// ============================================================
// Work Plan Registry (in client-config.yaml)
// ============================================================

export interface WorkPlanRegistryEntry {
  id: string;
  title: string;
  deliverable_type: 'agent' | 'training' | 'transform';
  covers_capabilities: string[];
  status: 'not_started' | 'in_progress' | 'operate' | 'archived';
}

export const WorkPlanRegistryEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  deliverable_type: z.enum(['agent', 'training', 'transform']),
  covers_capabilities: z.array(z.string().regex(/^[0-9]{2}$/)),
  status: z.enum(['not_started', 'in_progress', 'operate', 'archived']),
});

// ============================================================
// client-config.yaml v2 additions (spec §7)
// ============================================================

export type EngagementStatus = 'lead' | 'client' | 'archived';
export type EngagementPhase =
  | 'marketing'
  | 'mapping'
  | 'modelling'
  | 'building'
  | 'operate'
  | 'archive';

export const EngagementStatusSchema = z.enum(['lead', 'client', 'archived']);
export const EngagementPhaseSchema = z.enum([
  'marketing',
  'mapping',
  'modelling',
  'building',
  'operate',
  'archive',
]);

/**
 * Parsed shape of client-config.yaml (Stage 2 fields included).
 *
 * Legacy fields (slug, display_name, phase, gate, RAG block) are intentionally
 * not enumerated here — the existing load-clients.ts handles them. This shape
 * adds the Stage 2 additions; merging happens at the loader level.
 */
export interface ClientConfigV2Additions {
  engagement_status?: EngagementStatus;
  engagement_phase?: EngagementPhase;
  prospect_blueprint_id?: string | null;
  prospect_email?: string | null;
  prospect_first_name?: string | null;
  lock?: LockState;
  work_plan_registry?: WorkPlanRegistryEntry[];
  blueprint_schema_version?: BlueprintSchemaVersion;
}

export const ClientConfigV2AdditionsSchema = z.object({
  engagement_status: EngagementStatusSchema.optional(),
  engagement_phase: EngagementPhaseSchema.optional(),
  prospect_blueprint_id: z.string().nullable().optional(),
  prospect_email: z.string().nullable().optional(),
  prospect_first_name: z.string().nullable().optional(),
  lock: LockStateSchema.optional(),
  work_plan_registry: z.array(WorkPlanRegistryEntrySchema).optional(),
  blueprint_schema_version: BlueprintSchemaVersionSchema.optional(),
});
