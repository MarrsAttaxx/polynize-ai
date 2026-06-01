/**
 * POST /api/console/[slug]/work-plans/[workPlanId]/stage
 *
 * Tier 1, ALWAYS allowed (work plans are not part of the lock).
 * Updates a sprint stage status. Recomputes progress_pct + current_stage.
 *
 * Body: { stageId, status: 'pending'|'active'|'complete', note?: string }
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isValidConsoleSlug } from '@/app/console/_config/clients';
import {
  authorizeClientAccess,
  requireConsoleAuth,
  requireTeamScope,
} from '@/lib/console-api-auth';
import {
  loadWorkPlanForWrite,
  recomputeDerived,
  writeWorkPlan,
} from '@/lib/blueprint/work-plan-io';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STAGE_IDS = [
  'sprint_map',
  'cognition_design',
  'cognition_install',
  'internal_testing',
  'external_testing',
  'refine',
  'handoff',
  'operate',
] as const;

const BodySchema = z.object({
  stageId: z.enum(STAGE_IDS),
  status: z.enum(['pending', 'active', 'complete']),
  note: z.string().max(500).nullable().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; workPlanId: string }> }
) {
  const auth = await requireConsoleAuth(request);
  if (!auth.ok)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  const teamGate = requireTeamScope(auth);
  if (!teamGate.ok)
    return NextResponse.json(
      { error: teamGate.error },
      { status: teamGate.status }
    );

  const { slug, workPlanId } = await params;
  if (!isValidConsoleSlug(slug))
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  if (!authorizeClientAccess(auth.scope, slug))
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Invalid body', detail: parsed.error.message },
      { status: 400 }
    );

  const loaded = await loadWorkPlanForWrite(slug, workPlanId);
  if (!loaded.ok)
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });

  const stage = loaded.plan.sprint_stages.find(
    (s) => s.id === parsed.data.stageId
  );
  if (!stage) {
    return NextResponse.json(
      { error: `Stage "${parsed.data.stageId}" not present on this work plan` },
      { status: 404 }
    );
  }

  const now = new Date().toISOString();
  stage.status = parsed.data.status;
  if (parsed.data.note !== undefined) stage.note = parsed.data.note;
  if (parsed.data.status === 'active' && !stage.started_at) stage.started_at = now;
  if (parsed.data.status === 'complete' && !stage.completed_at)
    stage.completed_at = now;

  recomputeDerived(loaded.plan);

  const message =
    `Update ${slug} work plan ${workPlanId} stage ${parsed.data.stageId} -> ${parsed.data.status}\n\n` +
    `Actor: ${auth.actor.id}\nSource: ${auth.actor.source}`;

  try {
    const commit = await writeWorkPlan(slug, loaded.plan, message);
    return NextResponse.json({
      ok: true,
      slug,
      workPlanId,
      progress_pct: loaded.plan.progress_pct,
      commit,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Commit failed', detail: err instanceof Error ? err.message : 'unknown' },
      { status: 500 }
    );
  }
}
