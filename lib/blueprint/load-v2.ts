/**
 * Stage 2 Blueprint loader — assembles a unified BlueprintV2 object from
 * the JSON canonical files in a client's GitHub repo.
 *
 * Source files (paths inside the engagement repo):
 *   modelling/capability-map.json    — v0.5 envelope (required for 2.0)
 *   modelling/engagement-model.json  — benchmarking + uplift + motions (Modelling+)
 *   work-plans/<id>/work-plan.json   — one per Work Plan (Build+)
 *   work-plans/<id>/progress.md      — narrative log (Build+)
 *   timeline.json                    — project Gantt (Build+ or earlier)
 *   .polynize/client-config.yaml     — engagement metadata
 *
 * Missing-file handling:
 * - Lead (Mapping phase): only capability-map.json exists. engagementModel,
 *   workPlans, timeline are all null/empty. Loader does NOT throw.
 * - Modelling phase: capability-map.json + engagement-model.json. No work
 *   plans or timeline yet.
 * - Build/Operate: full set.
 */

import YAML from 'yaml';
import {
  readClientFile,
  readClientFileLastCommit,
} from '../github-client';
import {
  LenientCapabilityMapV05EnvelopeSchema,
  EngagementModelSchema,
  WorkPlanSchema,
  ProjectTimelineSchema,
  ClientConfigV2AdditionsSchema,
  type CapabilityMapV05,
  type EngagementModel,
  type EngagementRow,
  type Motion,
  type WorkPlan,
  type ProjectTimeline,
  type TimelineItem,
  type LockState,
  type ClientConfigV2Additions,
  type BlueprintSchemaVersion,
  type EngagementStatus,
  type EngagementPhase,
  type WorkPlanRegistryEntry,
  type SprintStageId,
  type SprintStage,
  type UpliftNeeded,
  type RowStatus,
  type MotionId,
  SPRINT_STAGE_ORDER,
  SPRINT_STAGE_LABELS,
  STAGE_WEIGHTS,
  UNLOCKED_INITIAL,
} from './schema-v2';

// ============================================================
// Unified BlueprintV2 shape
// ============================================================

export interface BlueprintV2 {
  slug: string;
  capabilityMap: CapabilityMapV05;
  engagementModel: EngagementModel | null;
  workPlans: { plan: WorkPlan; progressLog: string }[];
  timeline: ProjectTimeline | null;
  config: ClientConfigV2 | null;
  /** Source file modification timestamps for visibility / Refresh UX. */
  lastUpdated: {
    capabilityMap: Date | null;
    engagementModel: Date | null;
    timeline: Date | null;
  };
}

export interface ClientConfigV2 {
  client?: {
    slug?: string;
    name?: string;
    display_name?: string;
    lead_human?: string;
    lead_email?: string;
  };
  engagement?: {
    phase?: string;
    sub_phase?: string;
    gate_next?: string;
  };
  // Stage 2 additions
  engagement_status?: EngagementStatus;
  engagement_phase?: EngagementPhase;
  prospect_blueprint_id?: string | null;
  prospect_email?: string | null;
  prospect_first_name?: string | null;
  lock?: LockState;
  work_plan_registry?: WorkPlanRegistryEntry[];
  blueprint_schema_version?: BlueprintSchemaVersion;
  // RAG status (Step 7A.1)
  status?: {
    rag?: string | null;
    rag_reason?: string | null;
    rag_set_at?: string | null;
    rag_set_by?: string | null;
  } | null;
  // Allow any legacy fields without strict typing
  [key: string]: unknown;
}

// ============================================================
// Per-file loaders (each returns null on missing/malformed)
// ============================================================

async function safeRead(slug: string, path: string): Promise<string | null> {
  try {
    return await readClientFile(slug, path);
  } catch (err) {
    // 404 etc. — file simply not present. Anything else logs and returns null.
    const msg = err instanceof Error ? err.message : String(err);
    if (!/Not Found|404/i.test(msg)) {
       
      console.error(`[load-v2] read ${slug}:${path} failed`, msg);
    }
    return null;
  }
}

async function loadCapabilityMap(
  slug: string
): Promise<CapabilityMapV05 | null> {
  const raw = await safeRead(slug, 'modelling/capability-map.json');
  if (!raw) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
     
    console.error(`[load-v2] capability-map.json JSON.parse failed for ${slug}`, err);
    return null;
  }
  // Liberal on read: parse with the lenient schema so real-world maps in
  // Shourov's broader vocabulary load. The website's strict generation gate
  // (validateCapabilityMapV05) is unaffected. The lenient parse validates
  // structure + the render-load-bearing enums (allocation, completeness);
  // the cast reconciles the liberally-typed fields (work_shape.type,
  // delta_status, optional pricing/hiring, etc.) with the strict
  // CapabilityMapV05 type the renderer is written against. Those fields are
  // either displayed as plain strings or unused by the Console, so the cast
  // is safe.
  const parsed = LenientCapabilityMapV05EnvelopeSchema.safeParse(json);
  if (!parsed.success) {
     
    console.error(
      `[load-v2] capability-map.json schema mismatch for ${slug}`,
      parsed.error.issues.slice(0, 3)
    );
    return null;
  }
  return parsed.data.capability_map as unknown as CapabilityMapV05;
}

async function loadEngagementModel(
  slug: string
): Promise<EngagementModel | null> {
  const raw = await safeRead(slug, 'modelling/engagement-model.json');
  if (!raw) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
     
    console.error(`[load-v2] engagement-model.json parse failed for ${slug}`, err);
    return null;
  }
  const parsed = EngagementModelSchema.safeParse(json);
  if (!parsed.success) {
     
    console.error(
      `[load-v2] engagement-model.json schema mismatch for ${slug}`,
      parsed.error.issues.slice(0, 3)
    );
    return null;
  }
  return parsed.data;
}

async function loadTimeline(
  slug: string
): Promise<ProjectTimeline | null> {
  const raw = await safeRead(slug, 'timeline.json');
  if (!raw) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
     
    console.error(`[load-v2] timeline.json parse failed for ${slug}`, err);
    return null;
  }
  const parsed = ProjectTimelineSchema.safeParse(json);
  if (!parsed.success) {
     
    console.error(
      `[load-v2] timeline.json schema mismatch for ${slug}`,
      parsed.error.issues.slice(0, 3)
    );
    return null;
  }
  return parsed.data;
}

async function loadClientConfig(slug: string): Promise<ClientConfigV2 | null> {
  const raw = await safeRead(slug, '.polynize/client-config.yaml');
  if (!raw) return null;
  try {
    const parsed = YAML.parse(raw) ?? {};
    // Validate the Stage 2 additions slice but allow extra keys.
    ClientConfigV2AdditionsSchema.partial().safeParse(parsed);
    return parsed as ClientConfigV2;
  } catch (err) {
     
    console.error(`[load-v2] client-config.yaml parse failed for ${slug}`, err);
    return null;
  }
}

async function loadWorkPlans(
  slug: string,
  registry: WorkPlanRegistryEntry[]
): Promise<{ plan: WorkPlan; progressLog: string }[]> {
  if (!registry.length) return [];
  const loaded = await Promise.all(
    registry.map(async (entry) => {
      const planRaw = await safeRead(
        slug,
        `work-plans/${entry.id}/work-plan.json`
      );
      if (!planRaw) return null;
      let json: unknown;
      try {
        json = JSON.parse(planRaw);
      } catch {
         
        console.error(
          `[load-v2] work-plans/${entry.id}/work-plan.json parse failed for ${slug}`
        );
        return null;
      }
      const parsed = WorkPlanSchema.safeParse(json);
      if (!parsed.success) {
         
        console.error(
          `[load-v2] work-plans/${entry.id}/work-plan.json schema mismatch for ${slug}`,
          parsed.error.issues.slice(0, 3)
        );
        return null;
      }
      const progressLog =
        (await safeRead(slug, `work-plans/${entry.id}/progress.md`)) ?? '';
      return { plan: parsed.data, progressLog };
    })
  );
  return loaded.filter(
    (x): x is { plan: WorkPlan; progressLog: string } => x !== null
  );
}

// ============================================================
// Top-level: loadBlueprintV2(slug)
// ============================================================

export async function loadBlueprintV2(slug: string): Promise<BlueprintV2 | null> {
  // capability-map.json is the spine; without it there is no v2 Blueprint.
  const [capabilityMap, engagementModel, timeline, config] = await Promise.all([
    loadCapabilityMap(slug),
    loadEngagementModel(slug),
    loadTimeline(slug),
    loadClientConfig(slug),
  ]);

  if (!capabilityMap) return null;

  const registry = config?.work_plan_registry ?? [];
  const workPlans = await loadWorkPlans(slug, registry);

  // Last-updated stamps. Best-effort; failure → null.
  const [capUpdated, emUpdated, tlUpdated] = await Promise.all([
    readClientFileLastCommit(slug, 'modelling/capability-map.json'),
    readClientFileLastCommit(slug, 'modelling/engagement-model.json'),
    readClientFileLastCommit(slug, 'timeline.json'),
  ]);

  return {
    slug,
    capabilityMap,
    engagementModel,
    workPlans,
    timeline,
    config: config ?? null,
    lastUpdated: {
      capabilityMap: capUpdated,
      engagementModel: emUpdated,
      timeline: tlUpdated,
    },
  };
}

// ============================================================
// Display helpers
// ============================================================

/**
 * Display helper: v0.5 envelope uses 'Agent'/'Hybrid'/'Human'; Console
 * displays 'AGENTIC'/'HYBRID'/'HUMAN' in column headers and labels.
 */
export function displayAllocation(
  allocation: 'Agent' | 'Hybrid' | 'Human'
): 'AGENTIC' | 'HYBRID' | 'HUMAN' {
  if (allocation === 'Agent') return 'AGENTIC';
  if (allocation === 'Hybrid') return 'HYBRID';
  return 'HUMAN';
}

// ============================================================
// Derived view: Gap Register (spec §9.10)
// ============================================================

export type DerivedGapKind =
  | 'capability_gap'
  | 'scope_uncertainty'
  | 'decision_deferred';

export interface DerivedGap {
  kind: DerivedGapKind;
  source_capability_id: string | null;
  capability_name: string | null;
  topic: string | null;
  gap_type: string | null;
  question: string;
  blocking: boolean;
  reason: string | null;
  /**
   * Stable reference identifying the gap's source position, used by the
   * mark-addressed endpoint. Forms:
   *   cap.<capId>.<indexWithinCapability>
   *   scope.<index>
   *   decision.<index>
   */
  ref: string;
}

export interface DerivedGapRegister {
  blocking: DerivedGap[];
  nonBlockingByCapability: { capabilityId: string; gaps: DerivedGap[] }[];
  scopeUncertainties: DerivedGap[];
  decisionsDeferred: DerivedGap[];
  openCount: number;
  blockingCount: number;
}

/**
 * Derive a Gap Register from a BlueprintV2's three sources:
 *   1. capabilities[].gaps_to_close[]
 *   2. map_reflection.scope_uncertainty[]
 *   3. map_reflection.decisions_deferred[]
 *
 * Pure function, render-time only. Nothing stored.
 */
export function deriveGapRegister(
  blueprint: Pick<BlueprintV2, 'capabilityMap'>
): DerivedGapRegister {
  const cm = blueprint.capabilityMap;
  const blocking: DerivedGap[] = [];
  const nonBlockingMap = new Map<string, DerivedGap[]>();

  for (const row of cm.capabilities) {
    row.gaps_to_close.forEach((gap, idx) => {
      const derived: DerivedGap = {
        kind: 'capability_gap',
        source_capability_id: row.id,
        capability_name: row.name,
        topic: null,
        gap_type: gap.gap_type,
        question: gap.question,
        blocking: gap.blocking,
        reason: null,
        ref: `cap.${row.id}.${idx}`,
      };
      if (gap.blocking) {
        blocking.push(derived);
      } else {
        const arr = nonBlockingMap.get(row.id) ?? [];
        arr.push(derived);
        nonBlockingMap.set(row.id, arr);
      }
    });
  }

  const scopeUncertainties: DerivedGap[] = cm.map_reflection.scope_uncertainty.map(
    (s, idx) => ({
      kind: 'scope_uncertainty',
      source_capability_id: null,
      capability_name: null,
      topic: s.topic,
      gap_type: null,
      question: s.question,
      blocking: false,
      reason: null,
      ref: `scope.${idx}`,
    })
  );

  const decisionsDeferred: DerivedGap[] = cm.map_reflection.decisions_deferred.map(
    (d, idx) => ({
      kind: 'decision_deferred',
      source_capability_id: null,
      capability_name: null,
      topic: d.topic,
      gap_type: null,
      question: d.topic,
      blocking: false,
      reason: d.reason,
      ref: `decision.${idx}`,
    })
  );

  const nonBlockingByCapability = Array.from(nonBlockingMap.entries())
    .map(([capabilityId, gaps]) => ({ capabilityId, gaps }))
    .sort((a, b) => a.capabilityId.localeCompare(b.capabilityId));

  const nonBlockingCount = nonBlockingByCapability.reduce(
    (sum, group) => sum + group.gaps.length,
    0
  );
  const openCount =
    blocking.length +
    nonBlockingCount +
    scopeUncertainties.length +
    decisionsDeferred.length;

  return {
    blocking,
    nonBlockingByCapability,
    scopeUncertainties,
    decisionsDeferred,
    openCount,
    blockingCount: blocking.length,
  };
}

// ============================================================
// Derived: WorkPlan progress %
// ============================================================

/**
 * Derive progress_pct from sprint stage completion, WEIGHTED.
 *
 * Spec §5.1 / Judgment Call 5 (revisited): stages are not equal-weight, so
 * this is a weighted sum (STAGE_WEIGHTS, summing to 100) rather than
 * complete/8. The cognition and skills build stages are heavy; the testing
 * and handoff tail is lighter. The sprint ends at handoff; refinement
 * happens post-handoff in the operate phase, which is not a tracked sprint
 * stage. Universal across all work plans.
 *
 *   complete stage   → full weight
 *   active stage     → a proportion of its weight: the stage's own
 *                      progress_pct if set, else 50% (half) by default
 *   pending stage    → 0
 *
 * Returns a number rounded to one decimal.
 */
export function deriveProgressPct(plan: WorkPlan): number {
  let earned = 0;
  for (const stage of plan.sprint_stages) {
    const weight = STAGE_WEIGHTS[stage.id] ?? 0;
    if (stage.status === 'complete') {
      earned += weight;
    } else if (stage.status === 'active') {
      const frac =
        typeof stage.progress_pct === 'number'
          ? Math.max(0, Math.min(100, stage.progress_pct)) / 100
          : 0.5;
      earned += weight * frac;
    }
    // pending → 0
  }
  return Math.round(earned * 10) / 10;
}

// ============================================================
// Sprint stage convenience
// ============================================================

/**
 * Construct the canonical 8 sprint stages, all pending. Useful when
 * seeding a new Work Plan.
 */
export function defaultSprintStages(): SprintStage[] {
  return SPRINT_STAGE_ORDER.map((id) => ({
    id,
    label: SPRINT_STAGE_LABELS[id],
    status: 'pending' as const,
    note: null,
    started_at: null,
    completed_at: null,
  }));
}

// ============================================================
// Re-export common types so callers only need one import
// ============================================================

export type {
  CapabilityMapV05,
  EngagementModel,
  EngagementRow,
  Motion,
  MotionId,
  WorkPlan,
  ProjectTimeline,
  TimelineItem,
  LockState,
  BlueprintSchemaVersion,
  EngagementStatus,
  EngagementPhase,
  WorkPlanRegistryEntry,
  SprintStageId,
  SprintStage,
  UpliftNeeded,
  RowStatus,
  ClientConfigV2Additions,
};

export {
  UNLOCKED_INITIAL,
  SPRINT_STAGE_ORDER,
  SPRINT_STAGE_LABELS,
  STAGE_WEIGHTS,
};
