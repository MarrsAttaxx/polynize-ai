/**
 * POST /api/console/[slug]/motion/[motionId]
 *
 * Tier 1, lock-gated. Updates a motion's description in
 * engagement-model.json. motionId is one of agent_deploy | training |
 * transform.
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
  loadEngagementModelForWrite,
  writeEngagementModel,
} from '@/lib/blueprint/engagement-model-io';
import { getLockState } from '@/lib/blueprint/lock-io';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({ description: z.string().max(3000) });
const MOTION_IDS = ['agent_deploy', 'training', 'transform'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; motionId: string }> }
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

  const { slug, motionId } = await params;
  if (!isValidConsoleSlug(slug))
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  if (!authorizeClientAccess(auth.scope, slug))
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  if (!MOTION_IDS.includes(motionId))
    return NextResponse.json({ error: 'Invalid motion id' }, { status: 400 });

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

  const lock = await getLockState(slug);
  if (lock.locked) {
    return NextResponse.json(
      { error: 'Engagement section is locked', locked: true },
      { status: 423 }
    );
  }

  const loaded = await loadEngagementModelForWrite(slug);
  if (!loaded.ok)
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });

  const motion = loaded.model.motions.find((m) => m.id === motionId);
  if (!motion) {
    return NextResponse.json(
      { error: `Motion "${motionId}" not found in engagement model` },
      { status: 404 }
    );
  }
  motion.description = parsed.data.description;

  const message =
    `Update ${slug} motion ${motionId} description\n\n` +
    `Actor: ${auth.actor.id}\nSource: ${auth.actor.source}`;

  try {
    const commit = await writeEngagementModel(slug, loaded.model, message);
    return NextResponse.json({ ok: true, slug, motionId, commit });
  } catch (err) {
    return NextResponse.json(
      { error: 'Commit failed', detail: err instanceof Error ? err.message : 'unknown' },
      { status: 500 }
    );
  }
}
