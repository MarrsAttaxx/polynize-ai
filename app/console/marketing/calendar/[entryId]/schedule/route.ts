/**
 * POST /console/marketing/calendar/[entryId]/schedule — send one calendar entry
 * to Metricool at its set date/time (D24, publishing Step 2). Thin wrapper over
 * publishEntry (shared with Add-to-queue). Team-scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/console-auth';
import { getEntry } from '@/lib/marketing/calendar-store';
import { publishEntry } from '@/lib/marketing/publish';

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

  let entry;
  try {
    entry = await getEntry(user.email, entryId);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'read failed' }, { status: 500 });
  }
  if (!entry) {
    return NextResponse.json({ error: 'entry not found' }, { status: 404 });
  }

  const result = await publishEntry(user.email, entry);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, entry: result.entry, warning: result.warning });
}
