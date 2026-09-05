/**
 * POST /console/marketing/calendar/[entryId]/evergreen: put this post on the repeating list (D100).
 *
 * Team scope; the owner comes from the session and the entry from the store, never the body. It
 * talks to Metricool and returns every step it took as sentences, because the autolist API is the
 * least documented thing this console calls and the operator has to be able to read what happened.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/console-auth';
import { getEntry } from '@/lib/marketing/calendar-store';
import { promoteToEvergreen } from '@/lib/marketing/autolist';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/** Up to nine Metricool calls and one model call. */
export const maxDuration = 90;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ entryId: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { entryId } = await params;
  const entry = await getEntry(user.email, entryId);
  if (!entry) return NextResponse.json({ error: 'entry not found' }, { status: 404 });
  try {
    const result = await promoteToEvergreen(user.email, entry);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (err) {
    console.error('[evergreen] failed:', err);
    return NextResponse.json({ ok: false, steps: [], error: 'the promotion threw; see the server log' }, { status: 500 });
  }
}
