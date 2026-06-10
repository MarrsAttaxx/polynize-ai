export type Allocation = 'human' | 'hybrid' | 'agent';

/**
 * Phase A answer set, redesigned for the bottleneck-focused capability map.
 *
 * Updated 2026-05-21 per Cap Matrix v0.5 spec (Landmark 6.1):
 *   time_waste → work_shape    (who's involved + triggers)
 *   primary_risk → volume      (single-select bucket)
 *   tools (string[]) → context (open text, optional)
 *
 * `bottleneck_full` accumulates the user's initial answer plus any follow-up
 * exchanges from the conversational probe pattern.
 */
export type Answers = {
  name: string;
  company: string;
  business_description: string;
  role: string;
  bottleneck_full: string;
  ideal_outcome: string;
  work_shape: string;
  volume: string;
  team_size: string;
  context: string;
  urgency: string;
  email?: string;
};

export type Percentages = { human: number; hybrid: number; agent: number };

export type CapabilityRow = {
  label: string;
  allocation: Allocation;
  detail: string;
};

export type CapabilityAgent = {
  name: string;
  role: string;
  short_desc: string;
};

export type HumanOwner = {
  name: string;
  role: string;
};

export type PricingBand = {
  label: string;
  from: number;
  currency: 'AUD';
  description: string;
  period?: string;
};

export type HiringComparison = {
  equivalent_fte: number;
  estimated_annual_cost: string;
  currency: 'AUD';
  note: string;
};

export type CapabilityMapData = {
  interpretation: string;
  capabilities: CapabilityRow[];
  percentages: Percentages;
  team: {
    human_owner: HumanOwner;
    agents: CapabilityAgent[];
  };
  leverage_estimate: string;
  leverage_rationale: string;
  pricing_indicative?: {
    map: PricingBand;
    transform: PricingBand;
    operate: PricingBand;
  };
  hiring_comparison: HiringComparison;
  shape_internal: string;
  shape_id: number;
  /** 'llm' | 'rule_based' — set by the API layer, not the LLM. */
  generated_by?: 'llm' | 'rule_based';
};

export type SessionState = {
  phase: 'A' | 'B' | 'C' | 'DONE';
  answers: Partial<Answers>;
  data?: CapabilityMapData;
  messages?: { role: 'user' | 'assistant'; content: string }[];
};

// ============================================================
// Capability Map v0.5 (Cap Matrix spec) — Landmark 6.2
//
// The new shape returned by the LLM after the master prompt rewrite. Richer
// than the legacy CapabilityMapData above: rows carry completeness states,
// evidence pointers, work_shape objects, human_handoff details, and gap
// questions; capabilities are grouped into clusters; scope_brief, allocation
// summary, map_reflection, and excluded_capabilities are first-class.
//
// The legacy CapabilityMapData type is kept for the existing renderers; a
// v05ToLegacy() adapter (in lib/agents/v05-adapter.ts) converts a v0.5 map
// down to the legacy shape so the current PhaseB and /blueprints/[id]
// components keep working unchanged.
// ============================================================

export type AllocationV05 = 'Agent' | 'Hybrid' | 'Human';
export type FailureCost = 'Low' | 'Medium' | 'High' | 'N/A';
export type Completeness = 'COMPLETE' | 'PARTIAL' | 'STUB' | 'GHOST';
export type Confidence = 'High' | 'Medium' | 'Low';
export type ClusterType = 'sequential' | 'off_cycle';

export type EvidencePointer = {
  source_id:
    | 'q01_business'
    | 'q03_bottleneck'
    | 'q04_outcome'
    | 'q05_work_shape'
    | 'q06_volume'
    | 'q08_context';
  quote: string;
};

export type WorkShape = {
  type: string;
  inputs: string[];
  output: string;
  trigger: string;
};

export type HumanHandoff = {
  emit_artifact: string;
  completion_action: string;
  feedback_signals: string[];
};

export type Gap = {
  gap_type:
    | 'ALLOCATION'
    | 'DEFINITION'
    | 'INCLUSION'
    | 'WORK_SHAPE'
    | 'EDGE_CASES'
    | 'HANDOFF'
    | 'EVIDENCE';
  question: string;
  blocking: boolean;
};

export type CapabilityRowV05 = {
  id: string;
  name: string;
  cluster_id: string;
  description: string;
  allocation: AllocationV05;
  allocation_detail?: string | null;
  reason: string;
  failure_cost: FailureCost;
  failure_cost_note: string;
  work_shape: WorkShape;
  edge_cases: string[];
  evidence: EvidencePointer[];
  human_handoff: HumanHandoff | null;
  confidence: Confidence;
  completeness: Completeness;
  gaps_to_close: Gap[];
  delta_status: 'added';
};

export type Cluster = {
  id: string;
  name: string;
  order: number;
  cluster_type: ClusterType;
  trigger_clusters?: string[];
};

export type ScopeBrief = {
  name: string;
  statement: string;
  scope_inclusions: string[];
  scope_exclusions: string[];
  resolution: 'team_unit';
};

export type AllocationSummary = {
  by_row_count: { agent: number; hybrid: number; human: number };
  row_count_total: number;
  ghost_count: number;
  percentages: Percentages;
  notes: string;
};

export type MapReflection = {
  scope_uncertainty: { topic: string; question: string }[];
  cross_cutting_candidates: {
    item: string;
    reading: 'interface' | 'doctrine' | 'missing_row';
    question: string;
  }[];
  decisions_deferred: { topic: string; reason: string }[];
};

export type ExcludedCapability = {
  name: string;
  reason: string;
};

export type DeltaSummary = {
  mode: 'COLD_START';
  rows_added: string[];
  rows_modified: string[];
  rows_promoted: string[];
  rows_removed: string[];
  narrative: string;
};

export type CapabilityMapV05 = {
  stage: 'MAP_V0_5';
  scope_brief: ScopeBrief;
  interpretation: string;
  clusters: Cluster[];
  capabilities: CapabilityRowV05[];
  allocation_summary: AllocationSummary;
  map_reflection: MapReflection;
  excluded_capabilities: ExcludedCapability[];
  delta_summary: DeltaSummary;
  team: {
    human_owner: HumanOwner;
    agents: CapabilityAgent[];
  };
  leverage_estimate: string;
  leverage_rationale: string;
  pricing_indicative?: {
    map: PricingBand;
    transform: PricingBand;
    operate: PricingBand;
  };
  hiring_comparison: HiringComparison;
  shape_internal: string;
  shape_id: number;
};

/** Wrapper as emitted by the LLM. */
export type CapabilityMapV05Envelope = {
  capability_map: CapabilityMapV05;
};
