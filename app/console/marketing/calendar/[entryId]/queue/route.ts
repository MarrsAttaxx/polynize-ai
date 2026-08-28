/**
 * POST /console/marketing/calendar/[entryId]/queue — "Add to queue" (D24, rebuilt D79).
 *
 * Marrs: "somewhere in Metricool there is a queue section. I can, for each of the brands, dictate on
 * each of the platforms what time and how many posts per day to do on each platform, and then it just
 * adds to that queue. That's ideally what I'd like, so I can set that once and just go add to queue,
 * add to queue."
 *
 * That is what this does now. Two corrections were needed to get there.
 *
 * FIRST, METRICOOL HAS NO QUEUE. Their API creates a post at a concrete `publicationDate` and there
 * is no "append to this brand's queue" call anywhere in their 528 paths. So the queue is ours,
 * computed console-side, and "add to queue" means "work out the next free slot and schedule at that
 * exact time". His mental model is right; the queue just lives here rather than there.
 *
 * SECOND, THERE WERE TWO SLOT TABLES AND THIS ROUTE READ THE WRONG ONE. The posting schedule holds
 * per-STREAM times with no notion of platform; the lane channel schedule holds per-NETWORK times,
 * modes and slot kinds, and is what the wave uses. So queueing a LinkedIn post consumed a slot from
 * a stream-wide list while the wave was placing posts from a different list entirely, and the two
 * could not agree. This route now reads the same table the wave does, so they agree by construction.
 *
 * What that buys, beyond agreement: the queue is PER PLATFORM, so LinkedIn's queue no longer fills up
 * because Instagram was busy, and a slot already occupied on that channel is skipped rather than
 * doubled up.
 *
 * Team-scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/console-auth';
import { getEntry, listEntries } from '@/lib/marketing/calendar-store';
import { publishEntry } from '@/lib/marketing/publish';
import { getChannelSchedule, nextOpenSlots, type Network } from '@/lib/marketing/channel-schedule';
import { channelLabel } from '@/lib/marketing/channels';
import { queueDepthNote } from '@/lib/marketing/queue-depth';

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

  const schedule = await getChannelSchedule(entry.stream);
  const network = entry.channel as Network;

  /**
   * WHICH SLOTS ARE ALREADY GONE ON THIS CHANNEL. Per stream AND per channel, because a slot is only
   * taken for the platform that is using it: a LinkedIn post at 08:30 does not occupy Instagram's
   * 09:00, and treating the calendar as one shared queue is what made the old version fill up faster
   * than it should.
   *
   * A read failure means we cannot see what is taken, so the slot finder is given an empty list and
   * may pick one already in use. That is a double-booking rather than an outage, and the alternative,
   * refusing to queue, would block the button he is meant to be able to press repeatedly.
   */
  let taken: string[] = [];
  try {
    taken = (await listEntries(owner))
      .filter(
        (e) =>
          e.stream === entry.stream &&
          e.channel === entry.channel &&
          e.entry_id !== entry.entry_id &&
          e.scheduled_at &&
          e.scheduled_at.length >= 16
      )
      .map((e) => e.scheduled_at!);
  } catch (err) {
    console.error('[queue] sibling read failed, may reuse an occupied slot:', err);
  }

  /**
   * ONE slot, from the SAME function the wave uses. It walks forward from now through this network's
   * own times, skipping anything past and anything taken, so "add to queue" twice in a row lands on
   * two different slots without either of them needing to know about the other.
   */
  const [slot] = nextOpenSlots(schedule, network, 1, taken);
  if (!slot) {
    /**
     * nextOpenSlots walks 60 days and returns nothing only when this channel has no times at all,
     * which is a configuration answer rather than a failure, so it is said as one.
     */
    return NextResponse.json(
      {
        error: `${channelLabel(entry.channel)} has no posting times set for this stream, so there is no queue to add to. Set them on Connect Metricool.`,
      },
      { status: 400 }
    );
  }

  entry.scheduled_at = slot.dateTime;
  /**
   * The zone that chose it, stamped with it (D61). It now comes from the same schedule that picked
   * the time rather than from a different store, which is the whole point of the consolidation:
   * before this, the time came from one table and the zone from another.
   */
  entry.timezone = slot.timezone;

  const result = await publishEntry(owner, entry);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  /**
   * HOW DEEP THE QUEUE GOT, said out loud when it is deep (D79).
   *
   * This is the real answer to overbooking, and it is a sentence rather than a limit. The slots
   * already cap capacity: two LinkedIn times a day means a third post that day lands tomorrow, so
   * nothing can be double-booked. What was missing was anyone SAYING so. Press the button eleven
   * times and the eleventh post is a week and a half out, which is a fine outcome if you meant it
   * and a nasty surprise if you did not.
   *
   * Only when it is worth saying. A post landing today or tomorrow needs no commentary, and a note
   * on every single add would be noise inside a week.
   */
  const depth = queueDepthNote(slot.dateTime, slot.timezone, channelLabel(entry.channel));
  const warning = [result.warning, depth].filter(Boolean).join(' ') || undefined;

  return NextResponse.json({ ok: true, entry: result.entry, warning });
}
