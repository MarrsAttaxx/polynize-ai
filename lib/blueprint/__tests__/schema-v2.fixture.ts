/**
 * Hand-rolled smoke test for Stage 2 schemas. Runs via `tsx` or `ts-node`,
 * but is primarily here as live documentation: building Carl-shaped fixtures
 * and validating them ensures the schemas accept realistic data.
 *
 * Not part of the package.json test scripts (no test runner installed) —
 * invoke ad hoc with `npx tsx lib/blueprint/__tests__/schema-v2.fixture.ts`.
 */

import {
  EngagementModelSchema,
  WorkPlanSchema,
  ProjectTimelineSchema,
  LockStateSchema,
  type EngagementModel,
  type WorkPlan,
  type ProjectTimeline,
} from '../schema-v2';
import { validateCapabilityMapV05 } from '../../agents/capability-map-schema-v05';

// ----- 1. Capability map fixture (Carl-shaped, minimal) -----
const carlEnvelope = {
  capability_map: {
    stage: 'MAP_V0_5',
    scope_brief: {
      name: 'Carl @ Tailor & Co',
      statement: 'Bespoke tailoring funnel and fitting tracking',
      scope_inclusions: ['Inbound enquiry to first fitting'],
      scope_exclusions: ['Garment manufacturing'],
      resolution: 'team_unit' as const,
    },
    interpretation:
      'A solo bespoke tailor losing track of funnel stages. Triage and stage tracking are the bottleneck.',
    clusters: [
      { id: 'C1', name: 'Intake', order: 1, cluster_type: 'sequential' as const },
      {
        id: 'C2',
        name: 'Fitting',
        order: 2,
        cluster_type: 'sequential' as const,
      },
    ],
    capabilities: [
      {
        id: '01',
        name: 'Inbound enquiry triage',
        cluster_id: 'C1',
        description:
          'Triage initial enquiries from the website and email; route to Carl or to scheduling.',
        allocation: 'Agent' as const,
        allocation_detail: null,
        reason: 'High volume, clear rules, low risk.',
        failure_cost: 'Low' as const,
        failure_cost_note: 'Misroute recoverable within a day.',
        work_shape: {
          type: 'Classification + routing',
          inputs: ['email', 'web form'],
          output: 'Routed lead',
          trigger: 'New enquiry received',
        },
        edge_cases: ['Returning client', 'Vendor pitch'],
        evidence: [
          { source_id: 'q03_bottleneck' as const, quote: 'Loses track of leads.' },
        ],
        human_handoff: null,
        confidence: 'High' as const,
        completeness: 'COMPLETE' as const,
        gaps_to_close: [],
        delta_status: 'added' as const,
      },
      {
        id: '02',
        name: 'Funnel stage tracking',
        cluster_id: 'C2',
        description:
          'Update CRM stage for each active client based on comms and fitting schedule signals.',
        allocation: 'Hybrid' as const,
        allocation_detail: 'Drafts; Carl confirms.',
        reason: 'Judgment in transitions; agent drafts.',
        failure_cost: 'Medium' as const,
        failure_cost_note: 'Wrong stage misleads Carl.',
        work_shape: {
          type: 'Decision support',
          inputs: ['CRM', 'email'],
          output: 'Proposed stage update',
          trigger: 'Stage signal detected',
        },
        edge_cases: ['Stalled client'],
        evidence: [
          {
            source_id: 'q04_outcome' as const,
            quote: 'Loses visibility between fittings.',
          },
        ],
        human_handoff: {
          emit_artifact: 'Stage update card in CRM',
          completion_action: 'Carl confirms / overrides',
          feedback_signals: ['Carl override pattern'],
        },
        confidence: 'Medium' as const,
        completeness: 'PARTIAL' as const,
        gaps_to_close: [
          {
            gap_type: 'DEFINITION' as const,
            question: 'Canonical funnel stages?',
            blocking: false,
          },
        ],
        delta_status: 'added' as const,
      },
      ...Array.from({ length: 5 }, (_, i) => ({
        id: String(i + 3).padStart(2, '0'),
        name: `Capability ${i + 3}`,
        cluster_id: 'C2',
        description: 'Filler row to satisfy the 7-13 minimum.',
        allocation: 'Human' as const,
        allocation_detail: null,
        reason: 'High judgment, low volume.',
        failure_cost: 'Low' as const,
        failure_cost_note: 'Reversible.',
        work_shape: {
          type: 'Other: human craft',
          inputs: ['notes'],
          output: 'Decision',
          trigger: 'Carl reviews',
        },
        edge_cases: ['—'],
        evidence: [],
        human_handoff: null,
        confidence: 'Medium' as const,
        completeness: 'GHOST' as const,
        gaps_to_close: [],
        delta_status: 'added' as const,
      })),
    ],
    allocation_summary: {
      by_row_count: { agent: 1, hybrid: 1, human: 5 },
      row_count_total: 7,
      ghost_count: 5,
      percentages: { agent: 14, hybrid: 14, human: 72 },
      notes: 'Most rows are GHOSTs in this fixture.',
    },
    map_reflection: {
      scope_uncertainty: [
        { topic: 'WhatsApp', question: 'Counts as inbound channel?' },
      ],
      cross_cutting_candidates: [],
      decisions_deferred: [
        { topic: 'Monday.com integration', reason: 'Pending creds.' },
      ],
    },
    excluded_capabilities: [{ name: 'Manufacturing', reason: 'Out of scope.' }],
    delta_summary: {
      mode: 'COLD_START' as const,
      rows_added: [
        '01',
        '02',
        '03',
        '04',
        '05',
        '06',
        '07',
      ],
      rows_modified: [],
      rows_promoted: [],
      rows_removed: [],
      narrative: 'Fresh map.',
    },
    team: {
      human_owner: { name: 'Carl', role: 'Master Tailor' },
      agents: [
        {
          name: 'Triage Agent',
          role: 'Intake',
          short_desc: 'Routes enquiries.',
        },
        {
          name: 'Stage Tracker',
          role: 'Funnel',
          short_desc: 'Proposes stage updates.',
        },
      ],
    },
    leverage_estimate: '2-4x' as const,
    leverage_rationale: 'Frees Carl for the craft.',
    pricing_indicative: {
      map: {
        label: 'Map' as const,
        from: 5000 as const,
        currency: 'AUD' as const,
        description: 'One-off map.',
      },
      transform: {
        label: 'Transform' as const,
        from: 10000 as const,
        currency: 'AUD' as const,
        description: 'Per build.',
      },
      operate: {
        label: 'Operate' as const,
        from: 999 as const,
        currency: 'AUD' as const,
        period: 'month' as const,
        description: 'Per month.',
      },
    },
    hiring_comparison: {
      equivalent_fte: 0.5,
      estimated_annual_cost: 'AUD 35,000',
      currency: 'AUD' as const,
      note: 'A part-time assistant.',
    },
    shape_internal: 'Relationship Continuity' as const,
    shape_id: 5,
  },
};

const carlResult = validateCapabilityMapV05(carlEnvelope);
if (!carlResult.ok) {
  // eslint-disable-next-line no-console
  console.error('Carl envelope FAILED:', carlResult.error);
  throw new Error('Carl envelope validation failed.');
}
// eslint-disable-next-line no-console
console.log('OK: Carl-shaped CapabilityMapV05 envelope validates.');

// ----- 1b. Team agents cap: min 2, max 6 (raised from 5) -----
function carlWithAgentCount(n: number) {
  const agents = Array.from({ length: n }, (_, i) => ({
    name: `Agent${i + 1}`,
    role: 'role',
    short_desc: 'desc',
  }));
  return {
    capability_map: {
      ...carlEnvelope.capability_map,
      team: { ...carlEnvelope.capability_map.team, agents },
    },
  };
}
if (!validateCapabilityMapV05(carlWithAgentCount(6)).ok) {
  throw new Error('6-agent team should validate (TeamSchema max raised to 6).');
}
if (validateCapabilityMapV05(carlWithAgentCount(7)).ok) {
  throw new Error('7-agent team should NOT validate (TeamSchema max is 6).');
}
if (validateCapabilityMapV05(carlWithAgentCount(1)).ok) {
  throw new Error('1-agent team should NOT validate (TeamSchema min is 2).');
}
// eslint-disable-next-line no-console
console.log('OK: team agents cap is min 2, max 6 (6 valid, 7 invalid, 1 invalid).');

// ----- 2. EngagementModel fixture -----
const engagementModel: EngagementModel = {
  schema_version: '1.0',
  generated_from: 'capability-map@2026-05-30',
  last_updated: '2026-05-30T00:00:00Z',
  lock_state: {
    locked: false,
    locked_at: null,
    locked_by: null,
    lock_version: 0,
    unlock_reason: null,
  },
  rows: {
    '02': {
      capability_id: '02',
      current_state: 'Manual stage tracking in Monday.',
      benchmark: 'Auto-updates within 1 hour of triggering event.',
      uplift_needed: 'Moderate',
      uplift_moves: {
        people_train: 'Train team on confirming transitions.',
        process_transform: 'Define canonical funnel stages.',
        ai_deploy: 'Tracker drafts stage updates.',
      },
      held: false,
      row_status: 'draft',
    },
  },
  motions: [
    {
      id: 'agent_deploy',
      label: 'Agent Deploy',
      accent: 'amber',
      description: 'Tracker + Triage agents.',
      covers: {
        capability_ids: ['01', '02'],
        cluster_ids: [],
        cross_cutting: [],
      },
    },
  ],
};

const emResult = EngagementModelSchema.safeParse(engagementModel);
if (!emResult.success) {
  // eslint-disable-next-line no-console
  console.error('EngagementModel failed:', emResult.error.format());
  throw new Error('EngagementModel validation failed.');
}
// eslint-disable-next-line no-console
console.log('OK: minimal EngagementModel validates.');

// ----- 3. WorkPlan fixture -----
const workPlan: WorkPlan = {
  id: 'roxy',
  title: 'Roxy — Inbound Triage Agent',
  deliverable_type: 'agent',
  covers_capabilities: ['01', '02'],
  status: 'in_progress',
  current_stage: 'skills_install',
  sprint_stages: [
    {
      id: 'sprint_map',
      label: 'Sprint Map',
      status: 'complete',
      note: null,
      started_at: '2026-05-01T00:00:00Z',
      completed_at: '2026-05-02T00:00:00Z',
    },
    {
      id: 'cognition_design',
      label: 'Cognition Design',
      status: 'complete',
      note: null,
      started_at: '2026-05-02T00:00:00Z',
      completed_at: '2026-05-05T00:00:00Z',
    },
    {
      id: 'skills_design',
      label: 'Skills Design',
      status: 'complete',
      note: null,
      started_at: '2026-05-05T00:00:00Z',
      completed_at: '2026-05-07T00:00:00Z',
    },
    {
      id: 'cognition_install',
      label: 'Cognition Install',
      status: 'complete',
      note: null,
      started_at: '2026-05-07T00:00:00Z',
      completed_at: '2026-05-10T00:00:00Z',
    },
    {
      id: 'skills_install',
      label: 'Skills Install',
      status: 'active',
      note: 'Wiring connectors in the sandbox.',
      started_at: '2026-05-10T00:00:00Z',
      completed_at: null,
    },
    {
      id: 'sandbox_testing',
      label: 'Sandbox Testing',
      status: 'pending',
      note: null,
      started_at: null,
      completed_at: null,
    },
    {
      id: 'live_testing',
      label: 'Live Testing',
      status: 'pending',
      note: null,
      started_at: null,
      completed_at: null,
    },
    {
      id: 'handoff',
      label: 'Handoff',
      status: 'pending',
      note: null,
      started_at: null,
      completed_at: null,
    },
  ],
  requirements: {
    context: 'Roxbury auction house — inbound enquiry triage.',
    functional: 'Classify and route to correct department.',
    integrations: 'Outlook, internal CRM.',
    non_functional: '<1s response time per enquiry.',
  },
  dependencies: [],
  depends_on_stage: null,
  progress_pct: 61,
  created_at: '2026-05-01T00:00:00Z',
  last_updated: '2026-05-30T00:00:00Z',
};

const wpResult = WorkPlanSchema.safeParse(workPlan);
if (!wpResult.success) {
  // eslint-disable-next-line no-console
  console.error('WorkPlan failed:', wpResult.error.format());
  throw new Error('WorkPlan validation failed.');
}
// eslint-disable-next-line no-console
console.log('OK: minimal WorkPlan validates.');

// ----- 4. ProjectTimeline fixture -----
const timeline: ProjectTimeline = {
  schema_version: '1.0',
  items: [
    {
      id: 'brand-guidelines',
      label: 'Brand Guidelines',
      item_type: 'infrastructure',
      work_plan_id: null,
      start: '2026-05-01',
      duration_days: 5,
      dependencies: [],
      status: 'in_progress',
      lane: 0,
      progress_pct: 60,
    },
    {
      id: 'roxy',
      label: 'Roxy build',
      item_type: 'work_plan',
      work_plan_id: 'roxy',
      start: '2026-05-08',
      duration_days: 14,
      dependencies: ['brand-guidelines'],
      status: 'in_progress',
      lane: 1,
      progress_pct: 30,
    },
  ],
};

const tlResult = ProjectTimelineSchema.safeParse(timeline);
if (!tlResult.success) {
  // eslint-disable-next-line no-console
  console.error('Timeline failed:', tlResult.error.format());
  throw new Error('Timeline validation failed.');
}
// eslint-disable-next-line no-console
console.log('OK: minimal ProjectTimeline validates.');

// ----- 5. LockState round-trip -----
const lock = {
  locked: true,
  locked_at: '2026-05-20T00:00:00Z',
  locked_by: 'marrs@polynize.io',
  lock_version: 1,
  unlock_reason: null,
};
const lockResult = LockStateSchema.safeParse(lock);
if (!lockResult.success) throw new Error('LockState failed.');
// eslint-disable-next-line no-console
console.log('OK: LockState validates.');

// eslint-disable-next-line no-console
console.log('\nAll Stage 2 schema fixtures passed.');
