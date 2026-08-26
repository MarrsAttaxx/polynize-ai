/**
 * ONE WAVE AT A TIME PER LANE (D64).
 *
 * The wave route already holds a lock, on the NARRATIVE, which stops the same narrative being
 * planned or shipped twice: that was a real fix for a real double-publish, and it stays.
 *
 * It cannot stop the other collision. Two DIFFERENT narratives on the same stream, planned in two
 * tabs within the same run, each take their own narrative lock and then both do this:
 *
 *   read the calendar  ->  work out which slots are free  ->  write entries into them
 *
 * Both reads happen before either write, so both see the same free slots and both claim them. The
 * stream ends up double-booked at 07:00 with nothing on screen to say so, and the only signal is
 * two posts going out at once days later.
 *
 * A LANE LOCK IS THE RIGHT SHAPE because the thing being protected is the LANE'S CALENDAR, not the
 * narrative. Two narratives on different streams cannot collide and are not blocked; two on the
 * same stream take turns, and the second one sees the first one's entries when its turn comes,
 * which is exactly the read it needed.
 *
 * WHY NOT OPTIMISTIC RE-CHECKING, which was the other candidate: re-reading the calendar before
 * every save costs a store read per entry, up to sixteen on a default kit, and it still cannot
 * make the read-compute-write sequence atomic. It narrows the window rather than closing it, for
 * more work. Taking turns closes it.
 *
 * The lock is a single small object per lane, and it EXPIRES: a crashed run must not wedge the gate
 * for a stream forever, which is the same reasoning and the same two minute window the narrative
 * lock already uses.
 */

import { getSheetState, saveSheetState } from '@/lib/content/shoot-sheet-store';
import { isBucketConfigured, getObjectText, putObjectText } from '@/lib/agents/bucket';

/** Long enough for a slow ship, short enough that a crash costs one wait. Matches the narrative lock. */
export const WAVE_LOCK_MS = 2 * 60 * 1000;

/** One file per lane, so two lanes cannot clobber each other on a read-merge-write. */
function key(lane: string): string {
  return `pam/wave-lock/${lane}.json`;
}

export type Held = { at: string; narrative: string };

async function read(lane: string): Promise<Held | null> {
  try {
    if (isBucketConfigured()) {
      const text = await getObjectText(key(lane));
      const o = text ? (JSON.parse(text) as unknown) : null;
      return clean(o);
    }
    const s = (await getSheetState(key(lane))) as { lock?: unknown } | null;
    return clean(s?.lock);
  } catch (e) {
    /**
     * A LOCK THAT CANNOT BE READ MUST NOT BLOCK. Treated as free rather than as held, because the
     * failure mode of guessing "held" is a stream nobody can ever plan, and the failure mode of
     * guessing "free" is the rare collision this exists to reduce. The narrative lock is still
     * underneath, so the same narrative cannot double-run either way.
     */
    console.error(
      `[wave-lock] read failed for ${lane}, treating as free: ${e instanceof Error ? e.message : String(e)}`
    );
    return null;
  }
}

function clean(o: unknown): Held | null {
  if (!o || typeof o !== 'object') return null;
  const r = o as Record<string, unknown>;
  if (typeof r.at !== 'string' || !r.at.trim()) return null;
  const at = Date.parse(r.at);
  if (!Number.isFinite(at)) return null;
  return { at: r.at, narrative: typeof r.narrative === 'string' ? r.narrative : '' };
}

async function write(lane: string, held: Held | null): Promise<void> {
  if (isBucketConfigured()) {
    await putObjectText(key(lane), JSON.stringify(held, null, 2));
  } else {
    await saveSheetState(key(lane), { lock: held });
  }
}

/**
 * WHETHER SOMEBODY ELSE HAS IT. Pure, and exported, so the rule can be tested: three conditions
 * decide it and each one is a way to get this wrong.
 *
 * - Nothing held: free.
 * - Held but older than the window: free, because a crashed run must not wedge a stream forever.
 * - Held by THIS narrative: free, because a run has to be able to re-enter its own lock. Without
 *   this a retry inside the window is refused by the lock it set itself.
 */
export function heldByOther(held: Held | null, narrative: string, now: number): boolean {
  if (!held) return false;
  const at = Date.parse(held.at);
  if (!Number.isFinite(at) || now - at >= WAVE_LOCK_MS) return false;
  return held.narrative !== narrative;
}

/** Exported for the tests: the shape a stored lock has to have to count. */
export function parseHeld(o: unknown): Held | null {
  return clean(o);
}

export type LaneLock =
  | { ok: true; release: () => Promise<void> }
  | { ok: false; heldByOther: boolean };

/**
 * Take the lane, or report that someone else has it.
 *
 * `narrative` is recorded so a run can re-enter its OWN lock. Without that, a retry inside the two
 * minute window would be refused by the lock it set itself, which is a worse bug than the one this
 * fixes: the narrative lock is what stops a genuine double-run of the same narrative, and it has
 * its own reasoning about that.
 */
export async function acquireLaneWave(lane: string, narrative: string): Promise<LaneLock> {
  const held = await read(lane);
  if (heldByOther(held, narrative, Date.now())) {
    return { ok: false, heldByOther: true };
  }

  try {
    await write(lane, { at: new Date().toISOString(), narrative });
  } catch (e) {
    /**
     * The lock could not be TAKEN. The run still goes ahead: this is a collision reducer, not a
     * correctness gate, and refusing to plan because a lock file would not write would turn a rare
     * double-booking into a common outage. Released as a no-op so the caller's shape is unchanged.
     */
    console.error(
      `[wave-lock] could not take ${lane}, running unlocked: ${e instanceof Error ? e.message : String(e)}`
    );
    return { ok: true, release: async () => {} };
  }

  return {
    ok: true,
    release: async () => {
      try {
        // Only if it is still ours: an expired lock another run has since taken must not be
        // cleared out from under it.
        const now = await read(lane);
        if (!now || now.narrative === narrative) await write(lane, null);
      } catch (e) {
        console.error(
          `[wave-lock] release failed for ${lane} (it self-expires): ${e instanceof Error ? e.message : String(e)}`
        );
      }
    },
  };
}
