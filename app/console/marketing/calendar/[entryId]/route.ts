/**
 * PUT/DELETE /console/marketing/calendar/[entryId] — edit or remove one calendar
 * entry (publishing Step 1). PUT sets the planned date, status, or edited caption;
 * DELETE removes the entry. Team-scope only; owner from the session, id from the
 * route. Actual scheduling to Metricool is a later step; this only edits our copy.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { getEntry, saveEntry, deleteEntry } from '@/lib/marketing/calendar-store';
import { stripEmDashes } from '@/lib/em-dash';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PatchSchema = z.object({
  // A date (YYYY-MM-DD) or full ISO; null/'' clears it back to an unscheduled draft.
  scheduled_at: z.string().max(40).nullable().optional(),
  status: z.enum(['draft', 'scheduled', 'published']).optional(),
  post_copy: z.string().max(20_000).optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const { entryId } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const owner = user.email;

  let patch: z.infer<typeof PatchSchema>;
  try {
    patch = PatchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  let entry;
  try {
    entry = await getEntry(owner, entryId);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'read failed' },
      { status: 500 }
    );
  }
  if (!entry) {
    return NextResponse.json({ error: 'entry not found' }, { status: 404 });
  }

  if (patch.scheduled_at !== undefined) {
    entry.scheduled_at = patch.scheduled_at ? patch.scheduled_at : undefined;
  }
  if (patch.status !== undefined) entry.status = patch.status;
  if (patch.post_copy !== undefined) entry.post_copy = stripEmDashes(patch.post_copy);
  entry.updated_at = new Date().toISOString();

  try {
    await saveEntry(owner, entry);
    return NextResponse.json({ ok: true, entry });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'write failed' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const { entryId } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    await deleteEntry(user.email, entryId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'delete failed' },
      { status: 500 }
    );
  }
}
