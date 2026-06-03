/**
 * Dashboard-side readiness loader.
 *
 * The Blueprint page computes readiness from the full BlueprintV2 it already
 * loads. The dashboard (pipeline birds-eye) needs the SAME number without that
 * full load, so this reads only the minimal inputs per engagement and feeds
 * the SAME shared calc (lib/blueprint/readiness + deriveProgressPct). One
 * source of truth: the two surfaces cannot diverge.
 *
 *   Build / Operate → active work plan's weighted sprint progress.
 *   Modelling       → analysis completeness (capability map) + blockers
 *                     resolved (gap register in blueprint.md).
 *   else            → coarse phase floor.
 *
 * [PERF] This adds a couple of GitHub reads per engagement on the dashboard
 * (capability-map.json + blueprint.md for Modelling; work-plan.json for
 * Build). For the current handful of engagements that is fine; cache or back
 * with a registry if the install grows. Every branch is wrapped so a missing
 * or malformed file degrades to the coarse floor, never throws.
 */

import { readClientFile } from '@/lib/github-client';
import {
  LenientCapabilityMapV05EnvelopeSchema,
  WorkPlanSchema,
  type EngagementPhase,
  type WorkPlanRegistryEntry,
} from '@/lib/blueprint/schema-v2';
import { deriveProgressPct } from '@/lib/blueprint/load-v2';
import {
  computeModellingReadiness,
  coarsePhaseReadiness,
} from '@/lib/blueprint/readiness';
import { parseBlueprint, parseGapRegister } from './parse-blueprint';

function gapSectionContent(md: string): string | null {
  const parsed = parseBlueprint(md);
  return parsed.sections.find((s) => s.id === 'gap-register')?.content ?? null;
}

export async function loadEngagementReadiness(
  slug: string,
  opts: {
    phase: EngagementPhase | null;
    workPlanRegistry: WorkPlanRegistryEntry[];
  }
): Promise<number | null> {
  const { phase, workPlanRegistry } = opts;
  if (!phase) return null;

  try {
    // Build / Operate: the active work plan's weighted sprint progress.
    if (phase === 'building' || phase === 'operate') {
      const active = workPlanRegistry.find(
        (w) => w.status === 'in_progress' || w.status === 'operate'
      );
      if (!active) return coarsePhaseReadiness(phase);
      const raw = await readClientFile(
        slug,
        `work-plans/${active.id}/work-plan.json`
      );
      const parsed = WorkPlanSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) return coarsePhaseReadiness(phase);
      return Math.round(deriveProgressPct(parsed.data));
    }

    // Modelling: analysis completeness + critical-blockers-resolved.
    if (phase === 'modelling') {
      const cmRaw = await readClientFile(slug, 'modelling/capability-map.json');
      const cm = LenientCapabilityMapV05EnvelopeSchema.safeParse(
        JSON.parse(cmRaw)
      );
      if (!cm.success) return coarsePhaseReadiness(phase);
      const completenessValues = cm.data.capability_map.capabilities.map(
        (c) => c.completeness
      );

      let blockersTotal = 0;
      let blockersResolved = 0;
      try {
        const md = await readClientFile(slug, 'modelling/blueprint.md');
        const section = gapSectionContent(md);
        const gaps = section ? parseGapRegister(section) : null;
        if (gaps) {
          blockersTotal = gaps.blockingCount;
          blockersResolved = gaps.blockingResolved;
        }
      } catch {
        // No blueprint.md / no gap register → zero blockers.
      }

      return computeModellingReadiness({
        completenessValues,
        blockersTotal,
        blockersResolved,
      });
    }

    return coarsePhaseReadiness(phase);
  } catch {
    return coarsePhaseReadiness(phase);
  }
}
