/**
 * Server-side read/mutate/write helpers for work-plans/<id>/work-plan.json
 * and progress.md. Used by the Tier 1 stage + progress endpoints. Work
 * plans are NOT part of the locked Engagement section, so these are always
 * allowed (no lock gate).
 */

import { readClientFile, writeClientFile } from '../github-client';
import { deriveProgressPct } from './load-v2';
import {
  WorkPlanSchema,
  type WorkPlan,
} from './schema-v2';

function planPath(id: string): string {
  return `work-plans/${id}/work-plan.json`;
}
function progressPath(id: string): string {
  return `work-plans/${id}/progress.md`;
}

export type LoadPlanResult =
  | { ok: true; plan: WorkPlan }
  | { ok: false; status: number; error: string };

export async function loadWorkPlanForWrite(
  slug: string,
  workPlanId: string
): Promise<LoadPlanResult> {
  let raw: string;
  try {
    raw = await readClientFile(slug, planPath(workPlanId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Not Found|404/i.test(msg)) {
      return { ok: false, status: 404, error: 'Work plan not found' };
    }
    return { ok: false, status: 500, error: `Read failed: ${msg}` };
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, status: 422, error: 'work-plan.json is not valid JSON' };
  }
  const parsed = WorkPlanSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      status: 422,
      error: `work-plan.json failed validation: ${parsed.error.issues
        .slice(0, 2)
        .map((i) => `${i.path.join('.')} ${i.message}`)
        .join('; ')}`,
    };
  }
  return { ok: true, plan: parsed.data };
}

/** Recompute progress_pct (WEIGHTED, via deriveProgressPct) and
 *  current_stage from sprint stage states. */
export function recomputeDerived(plan: WorkPlan): void {
  plan.progress_pct = deriveProgressPct(plan);
  const active = plan.sprint_stages.find((s) => s.status === 'active');
  plan.current_stage = active ? active.id : null;
}

export async function writeWorkPlan(
  slug: string,
  plan: WorkPlan,
  commitMessage: string
): Promise<{ sha: string; url: string }> {
  plan.last_updated = new Date().toISOString();
  const json = JSON.stringify(plan, null, 2) + '\n';
  return writeClientFile(slug, planPath(plan.id), json, commitMessage);
}

export async function appendProgress(
  slug: string,
  workPlanId: string,
  entry: string,
  timestamp: string,
  commitMessage: string
): Promise<{ sha: string; url: string }> {
  let existing = '';
  try {
    existing = await readClientFile(slug, progressPath(workPlanId));
  } catch {
    existing = `# Progress log — ${workPlanId}\n`;
  }
  const line = `\n## ${timestamp}\n${entry.trim()}\n`;
  const next = existing.trimEnd() + '\n' + line;
  return writeClientFile(slug, progressPath(workPlanId), next, commitMessage);
}
