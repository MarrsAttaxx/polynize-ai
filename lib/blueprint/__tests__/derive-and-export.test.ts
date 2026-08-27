/**
 * Coverage for the Stage 2 pure logic: derive helpers, display helpers,
 * the export assembler, and the work-plan progress recompute.
 *
 * No test runner is installed, so this is a self-asserting harness: it
 * throws on the first failed expectation and prints a pass count. Run with
 *   npx tsx lib/blueprint/__tests__/derive-and-export.test.ts
 *
 * These cover the logic the renderers and endpoints depend on, without
 * needing GitHub or a browser.
 */

import {
  deriveGapRegister,
  deriveProgressPct,
  displayAllocation,
  defaultSprintStages,
} from '../load-v2';
import { recomputeDerived } from '../work-plan-io';
import { assembleContextMarkdown } from '../export-context';
import { isValidConsoleSlug } from '../../../app/console/_config/clients';
import type {
  CapabilityMapV05,
  WorkPlan,
  BlueprintV2,
  EngagementModel,
} from '../load-v2';

let passed = 0;
function check(name: string, cond: boolean) {
  if (!cond) throw new Error(`FAIL: ${name}`);
  passed += 1;
   
  console.log(`ok  ${name}`);
}
function eq<T>(name: string, a: T, b: T) {
  check(`${name} (${JSON.stringify(a)} === ${JSON.stringify(b)})`, a === b);
}

// ----- isValidConsoleSlug (route slug guard; replaced the fixed allowlist) -----
for (const s of ['tailor-co', 'everstock', 'acme-co', 'beta-corp', 'client-01']) {
  check(`slug guard accepts ${s}`, isValidConsoleSlug(s));
}
for (const s of ['../etc', 'a/b', '.polynize', 'Tailor-Co', '', 'a b', 'foo.bar']) {
  check(`slug guard rejects ${JSON.stringify(s)}`, !isValidConsoleSlug(s));
}

// ----- displayAllocation -----
eq('displayAllocation Agent', displayAllocation('Agent'), 'AGENTIC');
eq('displayAllocation Hybrid', displayAllocation('Hybrid'), 'HYBRID');
eq('displayAllocation Human', displayAllocation('Human'), 'HUMAN');

// ----- a minimal capability map for derive tests -----
function capMap(): CapabilityMapV05 {
  return {
    stage: 'MAP_V0_5',
    scope_brief: {
      name: 'Test',
      statement: 's',
      scope_inclusions: [],
      scope_exclusions: [],
      resolution: 'team_unit',
    },
    interpretation: 'interp',
    clusters: [{ id: 'C1', name: 'C', order: 1, cluster_type: 'sequential' }],
    capabilities: [
      {
        id: '01',
        name: 'One',
        cluster_id: 'C1',
        description: 'd',
        allocation: 'Agent',
        allocation_detail: null,
        reason: 'r',
        failure_cost: 'Low',
        failure_cost_note: 'n',
        work_shape: { type: 'Classification + routing', inputs: ['a'], output: 'o', trigger: 't' },
        edge_cases: [],
        evidence: [],
        human_handoff: null,
        confidence: 'High',
        completeness: 'COMPLETE',
        gaps_to_close: [
          { gap_type: 'DEFINITION', question: 'blocking q', blocking: true },
          { gap_type: 'EDGE_CASES', question: 'non-blocking q', blocking: false },
        ],
        delta_status: 'added',
      },
      {
        id: '02',
        name: 'Two',
        cluster_id: 'C1',
        description: 'd',
        allocation: 'Hybrid',
        allocation_detail: null,
        reason: 'r',
        failure_cost: 'Medium',
        failure_cost_note: 'n',
        work_shape: { type: 'Decision support', inputs: ['a'], output: 'o', trigger: 't' },
        edge_cases: [],
        evidence: [],
        human_handoff: {
          emit_artifact: 'x',
          completion_action: 'y',
          feedback_signals: [],
        },
        confidence: 'Medium',
        completeness: 'PARTIAL',
        gaps_to_close: [
          { gap_type: 'HANDOFF', question: 'another non-blocking', blocking: false },
        ],
        delta_status: 'added',
      },
    ],
    allocation_summary: {
      by_row_count: { agent: 1, hybrid: 1, human: 0 },
      row_count_total: 2,
      ghost_count: 0,
      percentages: { agent: 50, hybrid: 50, human: 0 },
      notes: '',
    },
    map_reflection: {
      scope_uncertainty: [{ topic: 'st', question: 'sq' }],
      cross_cutting_candidates: [],
      decisions_deferred: [{ topic: 'dt', reason: 'dr' }],
    },
    excluded_capabilities: [],
    delta_summary: {
      mode: 'COLD_START',
      rows_added: ['01', '02'],
      rows_modified: [],
      rows_promoted: [],
      rows_removed: [],
      narrative: '',
    },
    team: {
      human_owner: { name: 'H', role: 'owner' },
      agents: [
        { name: 'A1', role: 'r', short_desc: 'd' },
        { name: 'A2', role: 'r', short_desc: 'd' },
      ],
      team_leader: 'A1',
    },
    leverage_estimate: '2-4x',
    leverage_rationale: 'lr',
    pricing_indicative: {
      map: { label: 'Map', from: 5000, currency: 'AUD', description: '' },
      transform: { label: 'Transform', from: 10000, currency: 'AUD', description: '' },
      operate: { label: 'Operate', from: 999, currency: 'AUD', period: 'month', description: '' },
    },
    hiring_comparison: { equivalent_fte: 1, estimated_annual_cost: 'x', currency: 'AUD', note: '' },
    shape_internal: 'Pipeline and Conversion',
    shape_id: 2,
  };
}

// ----- deriveGapRegister -----
{
  const reg = deriveGapRegister({ capabilityMap: capMap() });
  eq('gap blocking count', reg.blocking.length, 1);
  eq('gap blocking is cap 01', reg.blocking[0].source_capability_id, '01');
  eq('gap blocking ref', reg.blocking[0].ref, 'cap.01.0');
  // non-blocking: cap01 idx1 + cap02 idx0 → 2 across 2 capability groups
  eq('non-blocking groups', reg.nonBlockingByCapability.length, 2);
  const nbCount = reg.nonBlockingByCapability.reduce((s, g) => s + g.gaps.length, 0);
  eq('non-blocking total', nbCount, 2);
  eq('scope uncertainties', reg.scopeUncertainties.length, 1);
  eq('scope ref', reg.scopeUncertainties[0].ref, 'scope.0');
  eq('decisions deferred', reg.decisionsDeferred.length, 1);
  eq('decision ref', reg.decisionsDeferred[0].ref, 'decision.0');
  eq('openCount', reg.openCount, 1 + 2 + 1 + 1);
  eq('blockingCount', reg.blockingCount, 1);
}

// ----- deriveProgressPct -----
function wp(stagesComplete: number): WorkPlan {
  const stages = defaultSprintStages();
  for (let i = 0; i < stagesComplete; i++) stages[i].status = 'complete';
  return {
    id: 'w',
    title: 'W',
    deliverable_type: 'agent',
    covers_capabilities: ['01'],
    status: 'in_progress',
    current_stage: null,
    sprint_stages: stages,
    requirements: { context: null, functional: null, integrations: null, non_functional: null },
    dependencies: [],
    depends_on_stage: null,
    progress_pct: 0,
    created_at: 'x',
    last_updated: 'x',
  };
}
// WEIGHTED: sprint_map 10 / cognition_design 18 / skills_design 12 /
// cognition_install 15 / skills_install 12 / sandbox_testing 13 /
// live_testing 12 / handoff 8 (sum 100). Complete stages earn full weight.
// The sprint ends at handoff; there is no operate stage.
eq('progress 0 complete', deriveProgressPct(wp(0)), 0);
// first 4 complete = 10+18+12+15 = 55
eq('progress 4 complete (weighted)', deriveProgressPct(wp(4)), 55);
eq('progress 8 complete', deriveProgressPct(wp(8)), 100);
// first 3 complete = 10+18+12 = 40
eq('progress 3 complete (weighted)', deriveProgressPct(wp(3)), 40);

// Active stage with no sub-progress earns HALF its weight.
{
  const plan = wp(4); // 55 complete
  plan.sprint_stages[4].status = 'active'; // skills_install (weight 12)
  eq('active half-credit (no sub-progress)', deriveProgressPct(plan), 61); // 55 + 0.5*12
  plan.sprint_stages[4].progress_pct = 100; // nearly done → full credit
  eq('active full-credit (sub-progress 100)', deriveProgressPct(plan), 67); // 55 + 12
}

// Handoff (the final stage) active earns half its weight by default. There
// is no longer an operate stage that auto-completes when entered.
{
  const plan = wp(7); // 92 complete
  plan.sprint_stages[7].status = 'active'; // handoff (weight 8)
  eq('handoff active half-credit', deriveProgressPct(plan), 96); // 92 + 0.5*8
}

// ----- recomputeDerived (work-plan-io) -----
{
  const plan = wp(2); // sprint_map + cognition_design complete = 28
  plan.sprint_stages[2].status = 'active'; // skills_design (weight 12) active
  recomputeDerived(plan);
  eq('recompute weighted', plan.progress_pct, 34); // 28 + 0.5*12
  eq('recompute current_stage', plan.current_stage, 'skills_design');
}

// ----- export assembler: full vs Lead -----
function blueprint(model: EngagementModel | null): BlueprintV2 {
  return {
    slug: 'test',
    capabilityMap: capMap(),
    engagementModel: model,
    workPlans: [],
    timeline: null,
    config: { client: { display_name: 'Test Co' }, engagement_status: 'lead', engagement_phase: 'mapping', blueprint_schema_version: '2.0' },
    lastUpdated: { capabilityMap: null, engagementModel: null, timeline: null },
  };
}
{
  // Lead (no engagement model): Benchmarking marked pending, no em-dashes.
  const md = assembleContextMarkdown(blueprint(null), '2026-05-30 (AEST)', {});
  check('export has engagement summary', md.includes('## Engagement Summary'));
  check('export has capability map', md.includes('## Capability Map'));
  check('export benchmarking pending', md.includes('Not yet populated (pending Modelling phase).'));
  check('export gap register present', md.includes('## Gap Register (current, derived)'));
  check('export no em-dash', !md.includes('—'));
  check('export footer present', md.includes('End of context snapshot'));
}

 
console.log(`\nAll ${passed} assertions passed.`);
