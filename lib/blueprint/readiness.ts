/**
 * Engagement readiness — the single source of the readiness number.
 *
 * Readiness MEANS "how complete is the work of the current phase," and it
 * re-scopes per phase. Both the Console dashboard (pipeline birds-eye) and the
 * Blueprint page must read from THIS module so the two surfaces never diverge.
 *
 *   Build / Operate (a work plan is in flight)
 *       → the active work plan's weighted sprint-stage progress
 *         (deriveProgressPct, in load-v2). Roxbury reads 92 this way.
 *
 *   Modelling
 *       → total modelling work done, where the critical blockers are the LAST
 *         MILE, not all of it (computeModellingReadiness below).
 *
 *   Mapping / Marketing / Archive
 *       → a coarse phase floor (no per-capability signal yet to average).
 */

export type CompletenessValue = 'COMPLETE' | 'PARTIAL' | 'STUB' | 'GHOST' | string;

/**
 * PROVISIONAL completeness scale. Maps each capability's completeness meter
 * (Needs detail / Partly mapped / Fully mapped) to a 0..1 contribution.
 *
 * NOTE: completeness is currently a provisional AI judgment. It is not yet
 * measured against a rigorous standard. That arrives when Ben / Cognitive
 * Studio land and can score map completeness directly. Until then this is a
 * working signal, fine to drive the readiness number, but it is an estimate,
 * not a measurement. Tune these weights when the rigorous metric exists.
 */
export const COMPLETENESS_SCALE: Record<string, number> = {
  COMPLETE: 1.0, // Fully mapped
  PARTIAL: 0.55, // Partly mapped
  STUB: 0.15, // Needs detail
  GHOST: 0.0, // placeholder row, not mapped
};

/** Weight of the analysis-completeness band in the Modelling readiness total. */
export const MODELLING_ANALYSIS_WEIGHT = 80;
/** Weight of the last-mile (critical blockers resolved) band. */
export const MODELLING_BLOCKERS_WEIGHT = 20;

/**
 * Average capability completeness on a 0..1 scale across all capabilities.
 * Unknown completeness strings score 0 (conservative). Empty input → 0.
 */
export function analysisCompleteness(values: CompletenessValue[]): number {
  if (!values.length) return 0;
  const sum = values.reduce(
    (acc, v) => acc + (COMPLETENESS_SCALE[v as string] ?? 0),
    0
  );
  return sum / values.length;
}

export interface ModellingReadinessInput {
  /** completeness of every capability in the map (the 80% band). */
  completenessValues: CompletenessValue[];
  /** count of critical blockers (gaps with blocking: true). */
  blockersTotal: number;
  /** count of those critical blockers that are resolved (answered / closed). */
  blockersResolved: number;
}

/**
 * Modelling-phase readiness = total modelling work done.
 *
 *   readiness = analysis_completeness * 80  +  blockers_resolved_pct * 20
 *
 * Analysis completeness is the bulk of the work (the map itself). The critical
 * blockers are the last mile: when there are none, that band is fully earned
 * (nothing gates sign-off); otherwise it is the fraction resolved. Rounded to
 * a whole percent.
 */
export function computeModellingReadiness(
  input: ModellingReadinessInput
): number {
  const analysis = analysisCompleteness(input.completenessValues); // 0..1
  const blockersResolvedPct =
    input.blockersTotal <= 0
      ? 1 // no blockers → last mile is complete
      : Math.max(0, Math.min(1, input.blockersResolved / input.blockersTotal));
  const score =
    analysis * MODELLING_ANALYSIS_WEIGHT +
    blockersResolvedPct * MODELLING_BLOCKERS_WEIGHT;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Coarse phase floor for phases with no per-capability signal yet. Kept in one
 * place so the dashboard and any other caller agree.
 */
export function coarsePhaseReadiness(phase: string | null | undefined): number {
  switch (phase) {
    case 'marketing':
      return 0;
    case 'mapping':
      return 15;
    case 'modelling':
      return 40; // only used as a fallback if the map cannot be read
    case 'building':
      return 60;
    case 'operate':
      return 100;
    default:
      return 0;
  }
}
