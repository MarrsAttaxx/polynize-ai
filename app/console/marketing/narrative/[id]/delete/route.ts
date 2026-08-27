/**
 * DELETE /console/marketing/narrative/[id]/delete
 *
 * Marrs: "i need a way to delete 'Narratives' on the dashboard."
 *
 * A narrative is not one record. It owns pieces, and once it has been through Gate 5 it owns
 * calendar entries too, some of which may be sitting in Metricool waiting to go out. So a delete
 * that removed only the narrative would leave two kinds of debris, and the second kind PUBLISHES
 * ITSELF: posts from a narrative he deleted, appearing days later, with nothing in the console left
 * to explain them.
 *
 * WHAT IT TAKES WITH IT: the narrative, its pieces, and its DRAFT calendar entries.
 *
 * WHAT IT REFUSES TO TOUCH: an entry that is scheduled and has not gone out yet. That one is live
 * on Metricool's side, and removing our record would not stop it. So the delete stops, names them,
 * and says where to cancel them. Unscheduling is an outward-facing action and it should be a
 * separate, deliberate act rather than a side effect of tidying a board.
 *
 * WHAT IT ACCEPTS: an entry already published. That post exists in the world and deleting our row
 * changes nothing about it. Refusing here would make old narratives undeletable forever, which is
 * the opposite of what he asked for.
 *
 * Team scope only, and DELETE rather than POST because it is one.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/console-auth';
import { getNarrative, deleteNarrative } from '@/lib/marketing/narrative-store';
import { listEntries, deleteEntry } from '@/lib/marketing/calendar-store';
import { deletePiece } from '@/lib/marketing/piece-store';
import { channelLabel } from '@/lib/marketing/channels';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const owner = user.email;

  let narrative;
  try {
    narrative = await getNarrative(id);
  } catch (err) {
    console.error('[narrative.delete] read failed:', err);
    return NextResponse.json({ error: 'could not read the narrative' }, { status: 502 });
  }
  /**
   * Already gone counts as success. A double-click, or a stale board, must not produce an error for
   * a state the operator was asking for anyway.
   */
  if (!narrative) return NextResponse.json({ ok: true, alreadyGone: true });

  /**
   * THE CALENDAR CHECK COMES FIRST, before anything is removed, so a refusal leaves the narrative
   * exactly as it was. Deleting the pieces and then discovering a live post would be the worst
   * possible order.
   */
  const pieceIds = narrative.piece_ids ?? [];
  let entries: Awaited<ReturnType<typeof listEntries>> = [];
  try {
    const all = await listEntries(owner);
    entries = all.filter((e) => pieceIds.includes(e.piece_id));
  } catch (err) {
    /**
     * The calendar could not be read, so whether anything is live is UNKNOWN, and deleting on an
     * unknown is how a post goes out from a narrative nobody can find. Refuse and say why.
     */
    console.error('[narrative.delete] calendar read failed, refusing to delete:', err);
    return NextResponse.json(
      {
        error:
          'Could not check the calendar, so this narrative was left alone: deleting it now could leave a scheduled post with nothing behind it. Try again in a moment.',
      },
      { status: 502 }
    );
  }

  const live = entries.filter((e) => e.status === 'scheduled');
  if (live.length > 0) {
    const which = live
      .slice(0, 4)
      .map((e) => `${channelLabel(e.channel)}${e.scheduled_at ? ` on ${e.scheduled_at.slice(0, 10)}` : ''}`)
      .join(', ');
    return NextResponse.json(
      {
        error: `This narrative still has ${live.length} post${live.length === 1 ? '' : 's'} scheduled in Metricool (${which}${live.length > 4 ? ', and more' : ''}). Deleting here would not stop them going out, so cancel them in Metricool first, then delete this.`,
        scheduled: live.length,
      },
      { status: 409 }
    );
  }

  /**
   * ORDER MATTERS ON THE WAY DOWN TOO: entries, then pieces, then the narrative itself. The
   * narrative is the index everything else is found through, so removing it first would orphan
   * whatever failed after it with no way to reach it again.
   */
  const removed = { entries: 0, pieces: 0 };
  const failed: string[] = [];

  for (const e of entries) {
    try {
      await deleteEntry(owner, e.entry_id);
      removed.entries += 1;
    } catch (err) {
      console.error(`[narrative.delete] entry ${e.entry_id} failed:`, err);
      failed.push(`calendar entry ${e.entry_id}`);
    }
  }

  for (const pid of pieceIds) {
    try {
      await deletePiece(owner, pid);
      removed.pieces += 1;
    } catch (err) {
      console.error(`[narrative.delete] piece ${pid} failed:`, err);
      failed.push(`piece ${pid}`);
    }
  }

  try {
    await deleteNarrative(id);
  } catch (err) {
    console.error('[narrative.delete] narrative delete failed:', err);
    return NextResponse.json(
      {
        error:
          'Its pieces were removed but the narrative itself would not delete. Reload and try again.',
        removed,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    removed,
    /**
     * Partial failures are REPORTED rather than swallowed. The narrative is gone either way, which
     * is what he asked for, and an orphaned piece is a thing he should know exists.
     */
    warning:
      failed.length > 0
        ? `The narrative is gone, but ${failed.length} of its parts would not delete and are now orphaned: ${failed.slice(0, 3).join(', ')}.`
        : undefined,
  });
}
