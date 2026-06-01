/**
 * POST /api/console/[slug]/capability/[capId]/benchmark
 *
 * Tier 2 (draft-then-confirm). Updates engagement-model.json
 * rows[capId].benchmark. The benchmark becomes contractual on lock, so it
 * requires `approvedBy` (the human who confirmed). Blocked (423) if locked.
 *
 * For Console UI edits, the team member editing IS the approver, so the
 * client sends approvedBy = their own email. For Ben, approvedBy is the
 * human who confirmed in Slack. Same endpoint, same contract.
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

const BodySchema = z.object({
  benchmark: z.string().max(2000),
  approvedBy: z.string().email(),
  proposedBy: z.string().optional(),
});

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
      { error: 'Invalid body — approvedBy is required for benchmark writes', detail: parsed.error.message },
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

  const row = ensureRow(loaded.model, capId);
  row.benchmark = parsed.data.benchmark;

  const message =
    `Update ${slug} capability ${capId} benchmark\n\n` +
    `ApprovedBy: ${parsed.data.approvedBy}\n` +
    (parsed.data.proposedBy ? `ProposedBy: ${parsed.data.proposedBy}\n` : '') +
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
