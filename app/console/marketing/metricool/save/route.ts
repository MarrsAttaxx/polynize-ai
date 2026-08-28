/**
 * PUT /console/marketing/metricool/save — the brand map, and the posting times (D24, extended D79).
 *
 * THE POSTING TIMES NOW GO TO THE LANE SCHEDULE, per network, which is the table the wave and the
 * queue both read. The per-stream `slots` list this route used to save is dead: nothing reads it any
 * more, so it is no longer written.
 *
 * The TIMEZONE is still written to both stores. The lane schedule is the authority for it (D68), and
 * `publishEntry` plus the D68 fallback both read the posting schedule's copy, so keeping them in
 * lockstep from one writer is what stops them drifting again.
 *
 * Team-scope.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { isStreamId } from '@/lib/marketing/streams';
import {
  saveBrandMap,
  getPostingSchedule,
  savePostingSchedule,
  type BrandMap,
  type PostingSchedule,
} from '@/lib/marketing/metricool-config-store';
import { getChannelSchedule, saveChannelSchedule } from '@/lib/marketing/channel-schedule';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  map: z.record(z.string(), z.string().max(64)),
  /**
   * Per lane, per network. `channels` is the posts-per-day answer by construction: two times on
   * LinkedIn means two LinkedIn posts a day, so there is no separate count to keep in sync with a
   * list that already says it.
   */
  schedule: z
    .record(
      z.string(),
      z.object({
        timezone: z.string().max(64),
        channels: z.record(z.string(), z.array(z.string().max(5)).max(24)).optional(),
        modes: z.record(z.string(), z.enum(['auto', 'manual'])).optional(),
      })
    )
    .optional(),
});

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  // Keep only known streams.
  const cleanMap: BrandMap = {};
  for (const [stream, blogId] of Object.entries(body.map)) {
    if (isStreamId(stream) && blogId.trim()) cleanMap[stream] = blogId.trim();
  }
  /**
   * ONE WRITER, TWO STORES, and only for the timezone. The lane schedule owns the times; the posting
   * schedule keeps a copy of the zone because publishEntry and the D68 lane fallback read it, and
   * writing both from here is what stops the two drifting apart the way they did before.
   */
  const cleanSchedule: PostingSchedule = {};
  type LaneCfg = {
    timezone: string;
    channels?: Record<string, string[]>;
    modes?: Record<string, 'auto' | 'manual'>;
  };
  const lanes: { lane: string; cfg: LaneCfg }[] = [];
  /**
   * The old per-stream `slots` are CARRIED OVER RATHER THAN CLEARED. Nothing reads them, so writing
   * an empty list would change no behaviour, but it would also destroy the times he set before this
   * screen changed shape, and a dead field is not worth deleting data over.
   */
  let previous: PostingSchedule = {};
  if (body.schedule) {
    try {
      previous = await getPostingSchedule();
    } catch (err) {
      console.error('[metricool.save] could not read the previous schedule, slots may be lost:', err);
    }
  }
  for (const [stream, cfg] of Object.entries(body.schedule ?? {})) {
    if (!isStreamId(stream)) continue;
    cleanSchedule[stream] = { timezone: cfg.timezone, slots: previous[stream]?.slots ?? [] };
    lanes.push({ lane: stream, cfg });
  }

  try {
    await saveBrandMap(cleanMap);
    if (body.schedule) await savePostingSchedule(cleanSchedule);

    /**
     * Read-merge-write per lane, so a field this screen does not edit survives. `prefers` (which
     * slot wants a video and which wants text, D46) is set by the wave and has no control here:
     * writing a fresh object would silently reset every slot's kind.
     */
    /**
     * SENT BACK NORMALIZED, so the screen shows what was actually stored (D79).
     *
     * The store falls back to a network's default times when its list comes in empty, which is right
     * for a broken config file but reads as a failed save if you clear a field: you would type
     * nothing, save, and find 08:30 back in the box on your next visit with nothing having said so.
     * Echoing the stored values means the field corrects itself in front of you.
     */
    const stored: Record<string, { timezone: string; channels: Record<string, string[]>; modes: Record<string, string> }> = {};
    for (const { lane, cfg } of lanes) {
      const current = await getChannelSchedule(lane);
      const channels = { ...current.channels } as Record<string, string[]>;
      const modes = { ...current.modes } as Record<string, 'auto' | 'manual'>;
      for (const [net, times] of Object.entries(cfg.channels ?? {})) {
        channels[net] = times as string[];
      }
      for (const [net, mode] of Object.entries(cfg.modes ?? {})) {
        modes[net] = mode as 'auto' | 'manual';
      }
      const saved = await saveChannelSchedule(lane, {
        ...current,
        timezone: cfg.timezone.trim() || current.timezone,
        channels: channels as typeof current.channels,
        modes: modes as typeof current.modes,
      });
      stored[lane] = { timezone: saved.timezone, channels: saved.channels, modes: saved.modes };
    }
    return NextResponse.json({ ok: true, stored });
  } catch (err) {
    console.error('[metricool.save] write failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'write failed' },
      { status: 500 }
    );
  }
}
