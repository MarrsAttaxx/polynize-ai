/**
 * POST /api/console/[slug]/capability/[capId]/current-state
 *
 * Tier 1 (direct write, attributed, no human confirmation). Updates
 * engagement-model.json rows[capId].current_state. Blocked (423) if the
 * Engagement section is locked.
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
  ensureRow,
  writeEngagementModel,
} from '@/lib/blueprint/engagement-model-io';
import { getLockState } from '@/lib/blueprint/lock-io';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({ current_state: z.string().max(2000) });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; capId: string }> }
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

  const { slug, capId } = await params;
  if (!isValidConsoleSlug(slug))
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  if (!authorizeClientAccess(auth.scope, slug))
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  if (!/^[0-9]{2}$/.test(capId))
    return NextResponse.json({ error: 'Invalid capability id' }, { status: 400 });

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

  // Lock gate (current-state lives in the Engagement section).
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

  const row = ensureRow(loaded.model, capId);
  row.current_state = parsed.data.current_state;

  const message =
    `Update ${slug} capability ${capId} current_state\n\n` +
    `Actor: ${auth.actor.id}\nSource: ${auth.actor.source}`;

  try {
    const commit = await writeEngagementModel(slug, loaded.model, message);
    return NextResponse.json({ ok: true, slug, capId, commit });
  } catch (err) {
    return NextResponse.json(
      { error: 'Commit failed', detail: err instanceof Error ? err.message : 'unknown' },
      { status: 500 }
    );
  }
}
