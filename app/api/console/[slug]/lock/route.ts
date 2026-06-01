/**
 * POST /api/console/[slug]/lock — lock the Engagement section.
 *
 * Spec §6. The Modelling→Build transition. On lock:
 *  - client-config lock block: locked true, locked_at, locked_by,
 *    lock_version incremented, unlock_reason cleared.
 *  - mirror into engagement-model.json lock_state.
 *  - all engagement-model rows row_status → locked.
 *
 * Tier 2. Team scope (the bearer/agent path also has team scope, and
 * the spec permits Ben to lock — only UNLOCK is human-only).
 *
 * Body: { lockedBy: string } (email of the human/agent locking).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isValidConsoleSlug } from '@/app/console/_config/clients';
import {
  authorizeClientAccess,
  requireConsoleAuth,
  requireTeamScope,
} from '@/lib/console-api-auth';
import { getLockState, setLockStateInConfig } from '@/lib/blueprint/lock-io';
import { mirrorLockToModel } from '@/lib/blueprint/engagement-model-io';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({ lockedBy: z.string().min(1) });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
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

  const { slug } = await params;
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
      { error: 'Invalid body — lockedBy required', detail: parsed.error.message },
      { status: 400 }
    );

  const current = await getLockState(slug);
  if (current.locked) {
    return NextResponse.json(
      { ok: true, slug, alreadyLocked: true, lock: current }
    );
  }

  const next = {
    locked: true,
    locked_at: new Date().toISOString(),
    locked_by: parsed.data.lockedBy,
    lock_version: current.lock_version + 1,
    unlock_reason: null,
  };

  const message =
    `Lock ${slug} engagement section (version ${next.lock_version})\n\n` +
    `LockedBy: ${parsed.data.lockedBy}\n` +
    `Actor: ${auth.actor.id}\nSource: ${auth.actor.source}`;

  try {
    const cfgCommit = await setLockStateInConfig(slug, next, message);
    // Mirror into engagement-model + flip rows to locked (best-effort).
    await mirrorLockToModel(slug, next, 'locked', message).catch(() => null);
    return NextResponse.json({ ok: true, slug, lock: next, commit: cfgCommit });
  } catch (err) {
    return NextResponse.json(
      { error: 'Lock failed', detail: err instanceof Error ? err.message : 'unknown' },
      { status: 500 }
    );
  }
}
