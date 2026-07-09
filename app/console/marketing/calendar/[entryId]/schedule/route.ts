/**
 * POST /console/marketing/calendar/[entryId]/schedule — send one calendar entry
 * to Metricool (D24, publishing Step 2). The console's "hands": resolve the
 * entry's stream -> brand (blogId), channel -> Metricool network, and planned
 * date -> dateTime + timezone, then schedule the post via REST. On success the
 * entry becomes 'scheduled' with the Metricool post id (external_ref).
 *
 * Team-scope only. Guardrails return a clear message when Metricool is not
 * connected, the stream is not mapped, or the channel is not a Metricool network.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/console-auth';
import { getEntry, saveEntry } from '@/lib/marketing/calendar-store';
import { getBrandMap } from '@/lib/marketing/metricool-config-store';
import { isMetricoolConfigured, schedulePost } from '@/lib/marketing/metricool-client';
import { metricoolNetwork, channelLabel } from '@/lib/marketing/channels';
import { streamLabel } from '@/lib/marketing/streams';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Default posting timezone (Marrs is AU). A later step can make this per-stream.
const DEFAULT_TZ = 'Australia/Sydney';

/** Normalize a stored date/datetime to Metricool's 'YYYY-MM-DDTHH:mm:ss' (no Z). */
function toDateTime(scheduledAt: string): string {
  const raw = scheduledAt.trim();
  if (raw.length <= 10) return `${raw}T09:00:00`; // date only -> default 9am
  if (raw.length === 16) return `${raw}:00`; // 'YYYY-MM-DDTHH:mm'
  return raw.replace(/\.\d+/, '').replace(/Z$/, '').slice(0, 19);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const { entryId } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const owner = user.email;

  if (!isMetricoolConfigured()) {
    return NextResponse.json(
      { error: 'Metricool is not connected. Add the keys in Vercel, then map your brands.' },
      { status: 400 }
    );
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
  if (!entry.scheduled_at) {
    return NextResponse.json({ error: 'set a date on this post first' }, { status: 400 });
  }

  const network = metricoolNetwork(entry.channel);
  if (!network) {
    return NextResponse.json(
      { error: `${channelLabel(entry.channel)} is not published through Metricool.` },
      { status: 400 }
    );
  }

  const map = await getBrandMap();
  const blogId = map[entry.stream];
  if (!blogId) {
    return NextResponse.json(
      { error: `Map the ${streamLabel(entry.stream)} stream to a Metricool brand first (Connect Metricool).` },
      { status: 400 }
    );
  }

  let result;
  try {
    result = await schedulePost({
      blogId,
      text: entry.post_copy,
      networks: [network],
      dateTime: toDateTime(entry.scheduled_at),
      timezone: DEFAULT_TZ,
      media: [],
      draft: false,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[calendar.schedule] Metricool call failed: ${msg}`);
    return NextResponse.json(
      { error: `Metricool rejected the post: ${msg}` },
      { status: 502 }
    );
  }

  entry.status = 'scheduled';
  if (result.id) entry.external_ref = result.id;
  entry.metricool_url = 'https://app.metricool.com/planning';
  entry.updated_at = new Date().toISOString();

  try {
    await saveEntry(owner, entry);
  } catch (err) {
    // The post IS scheduled in Metricool; only our local record failed to update.
    console.error('[calendar.schedule] entry save after schedule failed:', err);
    return NextResponse.json(
      { ok: true, entry, warning: 'Scheduled in Metricool, but the calendar record did not update. Refresh.' },
      { status: 200 }
    );
  }
  return NextResponse.json({ ok: true, entry });
}
