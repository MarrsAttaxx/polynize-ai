/**
 * POST /console/marketing/story/[id]/wave: Gate 5 (D40).
 *
 * Two actions, matching the draft-first decision:
 *  - plan: expand the kit into per-channel calendar entries as DRAFTS, each at
 *    its channel's next open 2-a-day slot. Idempotent: existing entries for a
 *    (master, channel) pair are counted before any are created, so reloading
 *    the gate never doubles the wave.
 *  - ship: every draft entry of this story goes through publishEntry, the same
 *    path the calendar's own Schedule uses, flipping the wave live in Metricool.
 *
 * Slot assignment treats the WHOLE channel as one queue: entries from other
 * stories occupy slots too, so two stories shipped in the same week interleave
 * instead of colliding.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getCurrentUser } from '@/lib/console-auth';
import { getStory, saveStory } from '@/lib/marketing/story-store';
import { piecesForTicks } from '@/lib/marketing/kit';
import { getPiece, type MarketingPiece } from '@/lib/marketing/piece-store';
import {
  getEntry,
  listEntries,
  saveEntry,
  type CalendarEntry,
} from '@/lib/marketing/calendar-store';
import {
  getChannelSchedule,
  nextOpenSlots,
  type Network,
} from '@/lib/marketing/channel-schedule';
import { publishEntry } from '@/lib/marketing/publish';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const owner = user.email;

  const body = (await req.json().catch(() => null)) as { action?: unknown } | null;
  const action = body?.action === 'ship' ? 'ship' : 'plan';

  let story;
  try {
    story = await getStory(id);
  } catch (err) {
    console.error('[story.wave] read failed:', err);
    return NextResponse.json({ error: 'could not read the story' }, { status: 502 });
  }
  if (!story) return NextResponse.json({ error: 'story not found' }, { status: 404 });
  const pieceIds = story.piece_ids ?? [];
  if (pieceIds.length === 0) {
    return NextResponse.json({ error: 'no pieces: confirm the kit first' }, { status: 400 });
  }

  /**
   * THE WAVE LOCK. Confirmed in review: a ship can run for minutes, the browser's
   * fetch can drop while the server keeps going, and the retry click used to start a
   * second full run that double-published the same drafts to the live channels. One
   * run at a time per story, and a stale lock (a crashed run) expires after two
   * minutes rather than wedging the gate forever.
   */
  const LOCK_MS = 2 * 60 * 1000;
  if (story.wave_lock_at && Date.now() - Date.parse(story.wave_lock_at) < LOCK_MS) {
    return NextResponse.json(
      { error: 'a wave run is already in progress. Give it a minute, then reload.' },
      { status: 409 }
    );
  }
  story.wave_lock_at = new Date().toISOString();
  try {
    await saveStory(story);
  } catch (err) {
    console.error('[story.wave] lock write failed:', err);
    return NextResponse.json({ error: 'could not start the run. Try again.' }, { status: 502 });
  }
  const unlock = async () => {
    try {
      const fresh = await getStory(id);
      if (fresh) {
        delete fresh.wave_lock_at;
        await saveStory(fresh);
      }
    } catch (err) {
      console.error('[story.wave] unlock failed (the lock self-expires):', err);
    }
  };

  // The story's master pieces, by master name. A read failure fails the RUN: silently
  // skipping a master planned a partial wave that reported success, and the planned
  // guard then made the gap permanent. Loud and retryable beats quiet and wrong.
  const masters = new Map<string, MarketingPiece>();
  for (const pid of pieceIds) {
    try {
      const p = await getPiece(owner, pid);
      if (p?.master) masters.set(p.master, p);
    } catch (err) {
      console.error('[story.wave] piece read failed:', err);
      await unlock();
      return NextResponse.json(
        { error: 'could not read the pieces. Reload and try again.' },
        { status: 502 }
      );
    }
  }

  let all: CalendarEntry[];
  try {
    all = await listEntries(owner);
  } catch (err) {
    console.error('[story.wave] entries read failed:', err);
    await unlock();
    return NextResponse.json({ error: 'could not read the calendar' }, { status: 502 });
  }
  const mine = all.filter((e) => e.piece_id && pieceIds.includes(e.piece_id));

  if (action === 'ship') {
    const drafts = mine.filter((e) => e.status === 'draft' && e.scheduled_at);
    let shipped = 0;
    let failed = 0;
    let skipped = 0;
    let firstError: string | null = null;
    for (const entry of drafts) {
      // Fresh read per entry: the request-start snapshot goes stale over a
      // minutes-long run, and publishing from it is how a retry double-posted.
      // An entry someone else already flipped is skipped, not re-published.
      let current: CalendarEntry | null = null;
      try {
        current = await getEntry(owner, entry.entry_id);
      } catch {
        current = null;
      }
      if (!current || current.status !== 'draft') {
        skipped += 1;
        continue;
      }
      const r = await publishEntry(owner, current);
      if (r.ok) shipped += 1;
      else {
        failed += 1;
        if (!firstError) firstError = r.error;
        console.error(`[story.wave] ship failed for ${entry.entry_id}: ${r.error}`);
      }
    }
    await unlock();
    if (shipped === 0 && failed > 0) {
      return NextResponse.json(
        { error: firstError ?? 'nothing could be scheduled', shipped, failed, skipped },
        { status: 502 }
      );
    }
    return NextResponse.json({ shipped, failed, skipped });
  }

  // PLAN. Expand kit placements into missing draft entries at next open slots.
  const plans = piecesForTicks(story.kit ?? []);
  const schedule = await getChannelSchedule(story.lane);

  // Slots already occupied per channel, across ALL stories on this stream:
  // the queue is the channel's, not the story's.
  const takenByNetwork = new Map<string, string[]>();
  for (const e of all) {
    if (e.stream !== story.lane || !e.scheduled_at) continue;
    const list = takenByNetwork.get(e.channel) ?? [];
    list.push(e.scheduled_at);
    takenByNetwork.set(e.channel, list);
  }

  let created = 0;
  try {
    for (const plan of plans) {
      const piece = masters.get(plan.master);
      if (!piece) continue;
      for (const placement of plan.placements) {
        const have = mine.filter(
          (e) => e.piece_id === piece.piece_id && e.channel === placement.network
        ).length;
        const missing = placement.count - have;
        if (missing <= 0) continue;

        const taken = takenByNetwork.get(placement.network) ?? [];
        const slots = nextOpenSlots(
          schedule,
          placement.network as Network,
          missing,
          taken
        );
        for (let i = 0; i < missing; i++) {
          const slot = slots[i];
          const entry: CalendarEntry = {
            entry_id: randomUUID(),
            owner,
            stream: story.lane,
            piece_id: piece.piece_id,
            title: piece.title,
            channel: placement.network,
            // The caption card at Gate 4 will own per-channel copy in the next
            // build. Until then the master's own text rides along so a draft is
            // never empty, and the calendar screens (which already exist) are
            // where a caption gets hand-tuned before shipping.
            post_copy: (piece.body ?? piece.script ?? piece.title ?? '').slice(0, 4000),
            scheduled_at: slot?.dateTime,
            status: 'draft',
            media: piece.media ?? [],
            created_at: new Date().toISOString(),
          };
          await saveEntry(owner, entry);
          created += 1;
          if (slot) {
            const list = takenByNetwork.get(placement.network) ?? [];
            list.push(slot.dateTime);
            takenByNetwork.set(placement.network, list);
          }
        }
      }
    }
  } catch (err) {
    console.error('[story.wave] plan failed midway:', err);
    await unlock();
    return NextResponse.json(
      { error: 'the wave was only partly laid out. Reload to continue it.', created },
      { status: 500 }
    );
  }

  await unlock();
  return NextResponse.json({ created });
}
