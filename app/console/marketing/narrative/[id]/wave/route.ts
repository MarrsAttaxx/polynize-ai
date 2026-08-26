/**
 * POST /console/marketing/narrative/[id]/wave: Gate 5 (D40).
 *
 * Two actions, matching the draft-first decision:
 *  - plan: expand the kit into per-channel calendar entries as DRAFTS, each at
 *    its channel's next open 2-a-day slot. Idempotent: existing entries for a
 *    (master, channel) pair are counted before any are created, so reloading
 *    the gate never doubles the wave.
 *  - ship: every draft entry of this narrative goes through publishEntry, the same
 *    path the calendar's own Schedule uses, flipping the wave live in Metricool.
 *
 * Slot assignment treats the WHOLE channel as one queue: entries from other
 * narratives occupy slots too, so two narratives shipped in the same week interleave
 * instead of colliding.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getCurrentUser } from '@/lib/console-auth';
import { getNarrative, saveNarrative } from '@/lib/marketing/narrative-store';
import {
  plansForTicks,
  capCopy,
  capForOutput,
  slotKindFor,
  type KitOutput,
} from '@/lib/marketing/kit';
import { getPiece, type MarketingPiece } from '@/lib/marketing/piece-store';
import {
  getEntry,
  listEntries,
  saveEntry,
  type CalendarEntry,
} from '@/lib/marketing/calendar-store';
import {
  getChannelSchedule,
  matchOpenSlots,
  type Network,
  type SlotDemand,
} from '@/lib/marketing/channel-schedule';
import { publishEntry } from '@/lib/marketing/publish';
import { sendHandPostBrief, handPostFromEntry } from '@/lib/marketing/hand-post';
import { narrativeHeadline } from '@/lib/marketing/narrative-store';

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

  let narrative;
  try {
    narrative = await getNarrative(id);
  } catch (err) {
    console.error('[narrative.wave] read failed:', err);
    return NextResponse.json({ error: 'could not read the narrative' }, { status: 502 });
  }
  if (!narrative) return NextResponse.json({ error: 'narrative not found' }, { status: 404 });
  const pieceIds = narrative.piece_ids ?? [];
  if (pieceIds.length === 0) {
    return NextResponse.json({ error: 'no pieces: confirm the kit first' }, { status: 400 });
  }

  /**
   * THE WAVE LOCK. Confirmed in review: a ship can run for minutes, the browser's
   * fetch can drop while the server keeps going, and the retry click used to start a
   * second full run that double-published the same drafts to the live channels. One
   * run at a time per narrative, and a stale lock (a crashed run) expires after two
   * minutes rather than wedging the gate forever.
   */
  const LOCK_MS = 2 * 60 * 1000;
  if (narrative.wave_lock_at && Date.now() - Date.parse(narrative.wave_lock_at) < LOCK_MS) {
    return NextResponse.json(
      { error: 'a wave run is already in progress. Give it a minute, then reload.' },
      { status: 409 }
    );
  }
  narrative.wave_lock_at = new Date().toISOString();
  try {
    await saveNarrative(narrative);
  } catch (err) {
    console.error('[narrative.wave] lock write failed:', err);
    return NextResponse.json({ error: 'could not start the run. Try again.' }, { status: 502 });
  }
  const unlock = async () => {
    try {
      const fresh = await getNarrative(id);
      if (fresh) {
        delete fresh.wave_lock_at;
        await saveNarrative(fresh);
      }
    } catch (err) {
      console.error('[narrative.wave] unlock failed (the lock self-expires):', err);
    }
  };

  // The narrative's master pieces, by master name. A read failure fails the RUN: silently
  // skipping a master planned a partial wave that reported success, and the planned
  // guard then made the gap permanent. Loud and retryable beats quiet and wrong.
  const masters = new Map<string, MarketingPiece>();
  for (const pid of pieceIds) {
    try {
      const p = await getPiece(owner, pid);
      if (p?.master) masters.set(p.master, p);
    } catch (err) {
      console.error('[narrative.wave] piece read failed:', err);
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
    console.error('[narrative.wave] entries read failed:', err);
    await unlock();
    return NextResponse.json({ error: 'could not read the calendar' }, { status: 502 });
  }
  const mine = all.filter((e) => e.piece_id && pieceIds.includes(e.piece_id));

  if (action === 'ship') {
    const drafts = mine.filter((e) => e.status === 'draft' && e.scheduled_at);

    /**
     * TWO KINDS OF SHIP (D41). Entries stamped 'manual' never touch Metricool: they are
     * prepared, emailed to the operator, and left as drafts on the calendar until he
     * posts them and marks them himself. Everything else schedules as before.
     *
     * Entries planned before publish_mode existed have no stamp and are treated as auto,
     * which is exactly how they were already behaving.
     */
    const handList = drafts.filter((e) => e.publish_mode === 'manual');
    const autoList = drafts.filter((e) => e.publish_mode !== 'manual');

    let handed = 0;
    if (handList.length > 0) {
      const brief = await sendHandPostBrief(
        narrative.lane,
        narrativeHeadline(narrative.idea, 70),
        handList.map(handPostFromEntry)
      );
      handed = handList.length;
      // Stamp them so a second ship does not re-send the same brief, and so the gate can
      // show that they went out. The email itself is best effort and never throws, so a
      // failed send is logged and the stamp still records that the attempt happened.
      const at = new Date().toISOString();
      for (const e of handList) {
        try {
          await saveEntry(owner, { ...e, handed_at: at });
        } catch (err) {
          console.error('[narrative.wave] hand-post stamp failed:', err);
        }
      }
      if (brief.skipped) console.error(`[narrative.wave] hand-post brief: ${brief.skipped}`);
    }

    let shipped = 0;
    let failed = 0;
    let skipped = 0;
    let firstError: string | null = null;
    for (const entry of autoList) {
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
        console.error(`[narrative.wave] ship failed for ${entry.entry_id}: ${r.error}`);
      }
    }
    await unlock();
    if (shipped === 0 && failed > 0) {
      return NextResponse.json(
        { error: firstError ?? 'nothing could be scheduled', shipped, failed, skipped, handed },
        { status: 502 }
      );
    }
    return NextResponse.json({ shipped, failed, skipped, handed });
  }

  // PLAN. Expand the kit's OUTPUTS into missing draft entries at next open slots.
  const plans = plansForTicks(narrative.kit ?? [], narrative.lane);
  const schedule = await getChannelSchedule(narrative.lane);

  // Slots already occupied per channel, across ALL narratives on this stream:
  // the queue is the channel's, not the narrative's.
  const takenByNetwork = new Map<string, string[]>();
  for (const e of all) {
    if (e.stream !== narrative.lane || !e.scheduled_at) continue;
    const list = takenByNetwork.get(e.channel) ?? [];
    list.push(e.scheduled_at);
    takenByNetwork.set(e.channel, list);
  }

  let created = 0;
  /**
   * Entries a narrative already has that the CURRENT kit no longer asks for. It happens on a
   * narrative planned under the v1 catalogue: v1 put four interchangeable LinkedIn text posts on
   * one piece, and the typed kit asks for one per frame. Nothing is deleted here, because deleting
   * a draft the operator did not ask to delete is a worse failure than leaving one behind, but the
   * count is returned so Gate 5 can say so instead of the operator finding out on the grid.
   */
  let extra = 0;
  /** Dateless drafts given a time rather than duplicated. */
  let repaired = 0;
  /** Existing drafts whose media was brought up to date with the piece. */
  let refreshed = 0;
  /** Posts placed in a slot that prefers the other kind, because nothing of that kind was waiting. */
  let fallback = 0;
  /** Posts the 60-day walk could not place. Reported, never saved without a time. */
  const unplaced: string[] = [];

  /**
   * DEMAND IS GATHERED PER NETWORK BEFORE ANYTHING IS PLACED (D46), and this restructure is the
   * whole reason the preference lands.
   *
   * Asked per MASTER, as it was before, the video master goes first and sees a window of three on
   * Instagram (09:00, 13:30, 09:00 next day). It is forced to put a cut in an afternoon slot that
   * prefers stills, and the carousel later takes a morning. Asked as ONE question per network,
   * Instagram's demand of 3 video and 2 still meets a window of 3 mornings and 2 afternoons and
   * matches all five, consuming exactly the same five times it consumed before.
   *
   * A future edit that moves the matching back inside the per-master loop leaves this compiling and
   * silently undoes the guarantee, which is why the tests assert the placement rather than the shape.
   */
  type Job = {
    output: KitOutput;
    piece: MarketingPiece;
    /** A dateless draft to give a time to, instead of creating a new entry beside it. */
    repair?: CalendarEntry;
  };
  const demandByNetwork = new Map<Network, SlotDemand<Job>[]>();

  try {
    for (const plan of plans) {
      const piece = masters.get(plan.master);
      if (!piece) continue;
      const byNetwork = new Map<Network, KitOutput[]>();
      for (const o of plan.outputs) {
        const list = byNetwork.get(o.network) ?? [];
        list.push(o);
        byNetwork.set(o.network, list);
      }

      for (const [network, outputs] of byNetwork) {
        const existing = mine.filter(
          (e) => e.piece_id === piece.piece_id && e.channel === network
        );
        /**
         * PRESENT means timed OR already live, not merely present in the list.
         *
         * Counting every row let a dateless draft block its own replacement forever: ship filters
         * on scheduled_at, so that entry could never go out and never be replaced. Counting only
         * TIMED rows fixes that and opens something worse, because the calendar's PUT route clears
         * scheduled_at without touching status: a 'scheduled' entry holding a live Metricool id can
         * exist with no date, and treating it as absent would create a SECOND draft that ship then
         * publishes to a real channel. So a non-draft row counts as present whatever its date, and
         * only DRAFTS are ever repaired.
         */
        const have = existing.filter((e) => e.scheduled_at || e.status !== 'draft').length;
        /**
         * Sorted by created_at because listEntries has no ORDER BY: without it, which orphan gets
         * which slot differs between two runs over identical state, which is a schedule that
         * changes on replan.
         */
        const orphans = existing
          .filter((e) => !e.scheduled_at && e.status === 'draft')
          .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));

        /**
         * MEDIA IS REFRESHED ON EVERY REPLAN (D47), and this is the fix for the single most
         * dangerous trap in the whole flow.
         *
         * The plan used to copy piece.media onto an entry ONCE, at creation, and nothing could
         * ever refresh it: an already-timed entry counts as present so the loop skipped it, the
         * repair branch writes only the date, and the calendar's own PUT has no media field at
         * all. So pressing "Lay out the week" before the video or the carousel was attached
         * created entries with media: [], and no amount of replanning fixed them. The post shipped
         * without its images and the only recovery was deleting every entry by hand.
         *
         * DRAFTS ONLY, and media only. A scheduled or published entry is already lodged with
         * Metricool and rewriting it here would desync the two. post_copy is deliberately left
         * alone: it may have been hand-tuned on the calendar, and the images are the part that
         * arrives late.
         */
        const wantMedia = piece.media ?? [];
        for (const e of existing) {
          if (e.status !== 'draft') continue;
          const now = e.media ?? [];
          if (now.length === wantMedia.length && now.every((m, i) => m === wantMedia[i])) continue;
          try {
            await saveEntry(owner, {
              ...e,
              media: [...wantMedia],
              updated_at: new Date().toISOString(),
            });
            refreshed += 1;
          } catch (err) {
            console.error('[narrative.wave] media refresh failed:', err);
          }
        }

        const missing = outputs.length - have;
        if (missing <= 0) {
          if (missing < 0) extra += -missing;
          continue;
        }
        // Fill the TAIL: the first `have` outputs are already on the calendar, so a retry after a
        // mid-plan crash creates what is missing rather than repeating the front.
        const todo = outputs.slice(have);
        const list = demandByNetwork.get(network) ?? [];
        todo.forEach((output, i) => {
          list.push({
            kind: slotKindFor(output.master),
            // Repairs ride in the same demand so they compete for the same window rather than
            // getting a second one.
            item: { output, piece, repair: orphans[i] },
          });
        });
        demandByNetwork.set(network, list);
      }
    }

    for (const [network, demand] of demandByNetwork) {
      const taken = takenByNetwork.get(network) ?? [];
      const placements = matchOpenSlots(schedule, network, demand, taken);
      for (const p of placements) {
        const { output, piece, repair } = p.item;
        if (!p.slot) {
          // Saving an entry with no time manufactured a post that could never ship and never
          // errored. Reported instead, and the next plan run retries it.
          unplaced.push(`${output.postLabel} on ${network}`);
          continue;
        }
        if (!p.preferred) fallback += 1;
        const slot = p.slot;

        if (repair) {
          // Only the date. The copy and the media may have been hand-tuned since, and a repair is
          // meant to rescue an entry rather than reset it.
          await saveEntry(owner, {
            ...repair,
            scheduled_at: slot.dateTime,
            // The zone rides with the time it belongs to, including on a repair: the date moved,
            // so the zone that chose it has to move with it (D61).
            timezone: slot.timezone,
            updated_at: new Date().toISOString(),
          });
          repaired += 1;
        } else {
          const raw = piece.body ?? piece.script ?? piece.title ?? '';
          // Per OUTPUT, not per master: one master now serves four networks with different caps,
          // so trimming by master would cut every LinkedIn caption to Instagram's 2,200.
          const cap = capForOutput(output);
          const entry: CalendarEntry = {
            entry_id: randomUUID(),
            owner,
            stream: narrative.lane,
            piece_id: piece.piece_id,
            title: piece.title,
            channel: network,
            // The caption card at Gate 4 will own per-channel copy in the next build. Until then
            // the master's own text rides along so a draft is never empty, trimmed to THIS
            // network's own cap in THIS network's own unit.
            post_copy: cap ? capCopy(raw, cap) : raw.slice(0, 4000),
            scheduled_at: slot.dateTime,
            /**
             * The pair, not just the time (D61). nextOpenSlots has always returned
             * { dateTime, timezone } "ready for the create call" and only the dateTime was being
             * kept, so the zone was re-derived from a different setting at ship time.
             */
            timezone: slot.timezone,
            status: 'draft',
            media: piece.media ?? [],
            /**
             * Stamped now, not read at ship time: changing the lane's setting later must not
             * silently rewrite how an already-planned wave goes out.
             *
             * An output can also demand manual on its own account (D41 tail): a LinkedIn document
             * cannot be scheduled through Metricool at all, so it is a hand-post by NATURE rather
             * than by channel setting. Without this the polynize lane, whose LinkedIn is 'auto',
             * would push it through as flat media and post a picture instead of a document.
             */
            publish_mode: output.handPost ? 'manual' : (schedule.modes[network] ?? 'auto'),
            created_at: new Date().toISOString(),
          };
          await saveEntry(owner, entry);
          created += 1;
        }

        const list = takenByNetwork.get(network) ?? [];
        list.push(slot.dateTime);
        takenByNetwork.set(network, list);
      }
    }
  } catch (err) {
    console.error('[narrative.wave] plan failed midway:', err);
    await unlock();
    return NextResponse.json(
      { error: 'the wave was only partly laid out. Reload to continue it.', created },
      { status: 500 }
    );
  }

  await unlock();
  return NextResponse.json({ created, repaired, refreshed, extra, fallback, unplaced });
}
