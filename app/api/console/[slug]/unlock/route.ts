/**
 * POST /api/console/[slug]/unlock — unlock the Engagement section (CR path).
 *
 * Spec §6.2 + §8.7: unlock is a commercial event (it changes agreed scope).
 * HUMAN ONLY — Ben (bearer/agent path) CANNOT unlock. We reject any caller
 * whose actor source is 'Agent', even though agents carry team scope.
 *
 * On unlock: locked → false, unlock_reason recorded, lock_version
 * unchanged (it increments on the NEXT lock / re-lock). Mirror into
 * engagement-model + flip rows back to 'agreed' (re-editable for the CR).
 *
 * Body: { unlockedBy: string, unlockReason: string }.
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

const BodySchema = z.object({
  unlockedBy: z.string().min(1),
  unlockReason: z.string().min(3).max(1000),
});

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

  // HUMAN ONLY. Ben (Agent source) is explicitly barred from unlocking,
  // even though the bearer path carries team scope.
  if (auth.actor.source === 'Agent') {
    return NextResponse.json(
      { error: 'Unlock requires a human. Agents cannot unlock the engagement.' },
      { status: 403 }
    );
  }

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
      { error: 'Invalid body — unlockedBy and unlockReason required', detail: parsed.error.message },
      { status: 400 }
    );

  const current = await getLockState(slug);
  if (!current.locked) {
    return NextResponse.json({ ok: true, slug, alreadyUnlocked: true, lock: current });
  }

  const next = {
    locked: false,
    locked_at: current.locked_at,
    locked_by: current.locked_by,
    lock_version: current.lock_version,
    unlock_reason: parsed.data.unlockReason,
  };

  const message =
    `Unlock ${slug} engagement section (CR)\n\n` +
    `UnlockedBy: ${parsed.data.unlockedBy}\n` +
    `Reason: ${parsed.data.unlockReason}\n` +
    `Actor: ${auth.actor.id}\nSource: ${auth.actor.source}`;

  try {
    const cfgCommit = await setLockStateInConfig(slug, next, message);
    await mirrorLockToModel(slug, next, 'agreed', message).catch(() => null);
    return NextResponse.json({ ok: true, slug, lock: next, commit: cfgCommit });
  } catch (err) {
    return NextResponse.json(
      { error: 'Unlock failed', detail: err instanceof Error ? err.message : 'unknown' },
      { status: 500 }
    );
  }
}
