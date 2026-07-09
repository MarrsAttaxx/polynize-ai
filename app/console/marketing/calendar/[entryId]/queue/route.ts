/**
 * POST /console/marketing/calendar/[entryId]/queue — "Add to queue" (D24).
 * Finds the next open ideal slot for the entry's stream (after now and after the
 * last already-queued post for that stream), sets that time on the entry, and
 * schedules it to Metricool. Each call appends to the end of the queue. Team-scope.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/console-auth';
import { getEntry, listEntries } from '@/lib/marketing/calendar-store';
import { getPostingSchedule } from '@/lib/marketing/metricool-config-store';
import { publishEntry } from '@/lib/marketing/publish';
import {
  defaultStreamSchedule,
  wallClockNow,
  toWall,
  maxWall,
  nextSlotAfter,
} from '@/lib/marketing/posting-schedule';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const { entryId } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const owner = user.email;

  let entry;
  try {
    entry = await getEntry(owner, entryId);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'read failed' }, { status: 500 });
  }
  if (!entry) {
    return NextResponse.json({ error: 'entry not found' }, { status: 404 });
  }

  const schedule = (await getPostingSchedule())[entry.stream] ?? defaultStreamSchedule();

  // Append after the later of (now, the last slot already queued for this stream).
  let after = wallClockNow(schedule.timezone, new Date());
  try {
    const siblings = (await listEntries(owner)).filter(
      (e) =>
        e.stream === entry.stream &&
        e.entry_id !== entry.entry_id &&
        e.scheduled_at &&
        e.scheduled_at.length >= 16
    );
    for (const sib of siblings) after = maxWall(after, toWall(sib.scheduled_at!));
  } catch (err) {
    console.error('[queue] sibling read failed, appending after now:', err);
  }

  entry.scheduled_at = nextSlotAfter(after, schedule.slots);

  const result = await publishEntry(owner, entry);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, entry: result.entry, warning: result.warning });
}
