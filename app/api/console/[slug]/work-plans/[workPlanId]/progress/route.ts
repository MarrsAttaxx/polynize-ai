/**
 * POST /api/console/[slug]/work-plans/[workPlanId]/progress
 *
 * Tier 1, ALWAYS allowed. Appends a timestamped entry to
 * work-plans/<id>/progress.md. Optionally also flips a stage active
 * (convenience for Ben's "started X" log entries).
 *
 * Body: { entry: string, stage?: SprintStageId }
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isValidConsoleSlug } from '@/app/console/_config/clients';
import {
  authorizeClientAccess,
  requireConsoleAuth,
  requireTeamScope,
} from '@/lib/console-api-auth';
import { appendProgress } from '@/lib/blueprint/work-plan-io';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  entry: z.string().min(1).max(5000),
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

  const now = new Date().toISOString();
  const message =
    `Append progress to ${slug} work plan ${workPlanId}\n\n` +
    `Actor: ${auth.actor.id}\nSource: ${auth.actor.source}`;

  try {
    const commit = await appendProgress(
      slug,
      workPlanId,
      parsed.data.entry,
      now,
      message
    );
    return NextResponse.json({ ok: true, slug, workPlanId, commit });
  } catch (err) {
    return NextResponse.json(
      { error: 'Commit failed', detail: err instanceof Error ? err.message : 'unknown' },
      { status: 500 }
    );
  }
}
