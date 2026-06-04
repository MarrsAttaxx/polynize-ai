/**
 * SoW merge generator — pure function: BlueprintV2 → SowDoc.
 *
 * Implements the AUTO half of sow-merge-mapping.md. HUMAN fields are seeded to
 * their template defaults (null = NEEDS INPUT). No I/O and no clock here so it
 * stays deterministic and testable; the caller passes timestamp + date stamp.
 *
 * House rule: this function only ever copies Blueprint text (which is itself
 * generated under the no-em-dash rule) or emits short fixed phrases written
 * without em-dashes. It never introduces an em-dash.
 */

import type { BlueprintV2 } from '@/lib/blueprint/load-v2';
import type { CapabilityMapV05, EngagementModel } from '@/lib/blueprint/schema-v2';
import {
  SOW_SCHEMA_VERSION,
  type SowAgent,
  type SowAuto,
  type SowCapabilityRow,
  type SowDoc,
  type SowMotion,
  type SowTarget,
} from './schema';
import { BUILD_SEQUENCE, HUMAN_FIELDS } from './template';

/** allocation → §3.4 "How it's done" cell. */
function allocationHow(allocation: string): string {
  if (allocation === 'Agent') return 'Agent (automated)';
  if (allocation === 'Hybrid') return 'Hybrid';
  return 'Human (excluded)';
}

/** Per the mapping: completion_action, or "Held human" / "Agent, no handoff". */
function humanCheck(cap: {
  allocation: string;
  human_handoff: { completion_action?: string } | null;
}): string {
  if (cap.allocation === 'Human') return 'Held human, no agent';
  if (cap.human_handoff && cap.human_handoff.completion_action) {
    return cap.human_handoff.completion_action;
  }
  if (cap.allocation === 'Agent') return 'Agent, no handoff';
  return 'Human check on review';
}

/**
 * Known integration / tool names to surface for §6.1(b). Best-effort and
 * PARTIAL by design: scanned against the capability work_shape inputs and
 * allocation detail, and editable in-Console afterwards.
 */
const KNOWN_INTEGRATIONS: string[] = [
  'Zendesk', 'Gmail', 'Outlook', 'Airtable', 'Zapier', 'Supabase', 'WhatsApp',
  'Telegram', 'Stripe', 'Slack', 'Shopify', 'HubSpot', 'Salesforce', 'Notion',
  'Trainerize', 'YouTube', 'Mailchimp', 'MailerLite', 'AWS', 'Bedrock',
  'Lovable', 'Xero', 'QuickBooks', 'Meta', 'Instagram', 'Facebook',
];

function deriveIntegrations(cm: CapabilityMapV05): string[] {
  const haystacks: string[] = [];
  for (const c of cm.capabilities) {
    if (c.work_shape?.inputs) haystacks.push(...c.work_shape.inputs);
    if (c.allocation_detail) haystacks.push(c.allocation_detail);
    if (c.description) haystacks.push(c.description);
  }
  const blob = haystacks.join('  ').toLowerCase();
  const found: string[] = [];
  for (const tool of KNOWN_INTEGRATIONS) {
    if (blob.includes(tool.toLowerCase()) && !found.includes(tool)) {
      found.push(tool);
    }
  }
  return found;
}

export interface GenerateSowOptions {
  /** ISO timestamp for generated_at (caller supplies; keeps this pure). */
  timestampIso: string;
  /** Compact date stamp for the SoW reference, e.g. 20260604. */
  dateStamp: string;
  /** Blueprint version label, e.g. "v2.0". */
  blueprintVersion: string;
}

/** Merge a loaded Blueprint into a fresh SoW document. */
export function generateSowDoc(
  blueprint: BlueprintV2,
  opts: GenerateSowOptions
): SowDoc {
  const cm: CapabilityMapV05 = blueprint.capabilityMap;
  const em: EngagementModel | null = blueprint.engagementModel;

  // §3.1 Agent Team — team_leader row first, others in declared order.
  const agents = cm.team?.agents ?? [];
  const leader = cm.team?.team_leader;
  const ordered = leader
    ? [...agents].sort((a, b) =>
        a.name === leader ? -1 : b.name === leader ? 1 : 0
      )
    : agents;
  const agent_team: SowAgent[] = ordered.map((a) => ({
    name: a.name,
    role: a.role,
  }));

  // §3.2 / §3.3 scope.
  const in_scope = [...(cm.scope_brief?.scope_inclusions ?? [])];
  const out_of_scope = [
    ...(cm.scope_brief?.scope_exclusions ?? []),
    ...(cm.excluded_capabilities ?? []).map((e) => e.name),
  ];

  // §3.4 capability schedule — one row per capability.
  const capability_schedule: SowCapabilityRow[] = cm.capabilities.map((c) => ({
    id: c.id,
    name: c.name,
    how: allocationHow(c.allocation),
    human_check: humanCheck(c),
  }));

  // §4 targets — engagement-model benchmark restated; skip held / At Benchmark.
  const targets: SowTarget[] = [];
  if (em?.rows) {
    for (const c of cm.capabilities) {
      const row = em.rows[c.id];
      if (!row || row.held) continue;
      if (row.uplift_needed === 'At Benchmark') continue;
      if (!row.benchmark || !row.benchmark.trim()) continue;
      targets.push({ capability: c.name, target: row.benchmark });
    }
  }

  // §5.1 motions.
  const motions: SowMotion[] = (em?.motions ?? []).map((m) => ({
    label: m.label,
    description: m.description,
  }));

  // §2 human-held / human-checked decisions: allocation Human OR a handoff.
  const human_held = cm.capabilities
    .filter((c) => c.allocation === 'Human' || c.human_handoff)
    .map((c) => c.name);

  const auto: SowAuto = {
    engagement_name: cm.scope_brief?.name ?? blueprint.slug,
    background: cm.interpretation ?? '',
    agent_team,
    in_scope,
    out_of_scope,
    capability_schedule,
    targets,
    motions,
    build_sequence: [...BUILD_SEQUENCE],
    human_held,
    integrations: deriveIntegrations(cm),
  };

  // HUMAN fields seeded to their template defaults (null = NEEDS INPUT).
  const human: Record<string, string | null> = {};
  for (const f of HUMAN_FIELDS) human[f.key] = f.default;

  return {
    schema_version: SOW_SCHEMA_VERSION,
    generated_at: opts.timestampIso,
    generated_from: `${blueprint.slug} Blueprint ${opts.blueprintVersion}`,
    sow_reference: `SOW-${blueprint.slug}-${opts.dateStamp}`,
    auto,
    human,
  };
}
