/**
 * POST /console/marketing/calendar/[entryId]/schedule — send one calendar entry
 * to Metricool at its set date/time (D24, publishing Step 2). Thin wrapper over
 * publishEntry (shared with Add-to-queue). Team-scope only.
 *
 * `{ draft: true }` SENDS IT AS A DRAFT (D67), which is the same call with autoPublish off. It is
 * the dry run for the very first real Metricool write: it proves the token, the brand id, the
 * payload shape, the media urls and the timezone, and nothing appears in public.
 *
 * The flag has to be explicit and the default has to be a real publish, because the button that
 * says Schedule has always meant schedule. A default that quietly drafted would be the more
 * dangerous mistake of the two: he would think a wave had gone out when it had not.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/console-auth';
import { getEntry } from '@/lib/marketing/calendar-store';
import { publishEntry } from '@/lib/marketing/publish';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
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

  // A body is optional, so an older client that sends none still publishes exactly as before.
  const body = (await req.json().catch(() => null)) as { draft?: unknown } | null;
  const draft = body?.draft === true;

  const result = await publishEntry(user.email, entry, { draft });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, draft, entry: result.entry, warning: result.warning });
}
