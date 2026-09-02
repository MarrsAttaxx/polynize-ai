/**
 * POST /console/marketing/analytics/pull — fetch the numbers and write them down (D86).
 *
 * `{ stream }` pulls one; no body pulls every stream. Team scope only.
 *
 * WHY A BUTTON BEFORE A CRON. The pull has never run against a real account, and a nightly job that
 * fails silently at 3am is the worst possible first version of anything: nobody sees the failure and
 * the dashboard just stays empty. A button run by a person, whose result is reported on screen, is
 * how the first pull should happen. The cron is the same call on a timer once this is boring.
 *
 * IT WRITES ONLY OUR OWN CACHE. Nothing is sent to Metricool, nothing is published, and the worst
 * case of running it twice is two identical files.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/console-auth';
import { isStreamId, STREAMS } from '@/lib/marketing/streams';
import { pullStream, type PullResult } from '@/lib/marketing/analytics-pull';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/** Five brands, one call each, on someone else's API. Not fast, and not worth cutting short. */
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { stream?: unknown } | null;
  const one = typeof body?.stream === 'string' ? body.stream : '';
  if (one && !isStreamId(one)) {
    return NextResponse.json({ error: 'unknown stream' }, { status: 400 });
  }

  const streams = one ? [one] : STREAMS.map((s) => s.id);
  const results: PullResult[] = [];
  /**
   * ONE AT A TIME, not in parallel. Five concurrent calls to one account's analytics is the shape of
   * request that gets rate limited, and the whole job is a background refresh: there is nothing to
   * gain from finishing it three seconds sooner.
   */
  for (const s of streams) {
    results.push(await pullStream(s));
  }

  const pulled = results.filter((r) => r.ok).reduce((n, r) => n + r.posts, 0);
  return NextResponse.json({ ok: true, pulled, results });
}
