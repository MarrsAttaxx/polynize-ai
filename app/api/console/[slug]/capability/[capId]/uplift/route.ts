/**
 * POST /api/console/[slug]/capability/[capId]/uplift
 *
 * Tier 1, lock-gated. Updates engagement-model.json rows[capId] uplift
 * fields: uplift_moves.{people_train,process_transform,ai_deploy},
 * uplift_needed, held. All fields optional — only provided keys change.
 *
 * [ASSUMPTION] The spec's tier table names only current_state (T1) and
 * benchmark (T2). Uplift moves / uplift_needed / held are plan content
 * (not the contractual benchmark), so they are treated as Tier 1 (direct
 * team write, lock-gated) consistent with the spec's principle that the
 * benchmark is the contractual field.
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
  people_train: z.string().max(2000).nullable().optional(),
  process_transform: z.string().max(2000).nullable().optional(),
  ai_deploy: z.string().max(2000).nullable().optional(),
  uplift_needed: z
    .enum(['At Benchmark', 'Low', 'Moderate', 'High', 'Major'])
    .optional(),
  held: z.boolean().optional(),
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

  const row = ensureRow(loaded.model, capId);
  const b = parsed.data;
  if (b.people_train !== undefined) row.uplift_moves.people_train = b.people_train;
  if (b.process_transform !== undefined)
    row.uplift_moves.process_transform = b.process_transform;
  if (b.ai_deploy !== undefined) row.uplift_moves.ai_deploy = b.ai_deploy;
  if (b.uplift_needed !== undefined) row.uplift_needed = b.uplift_needed;
  if (b.held !== undefined) row.held = b.held;

  const message =
    `Update ${slug} capability ${capId} uplift\n\n` +
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
