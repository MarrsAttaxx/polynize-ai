/**
 * IS THIS TIME ACTUALLY IN THE FUTURE (D83).
 *
 * Marrs set a date on a post, left the time blank, and pressed Schedule. Metricool refused it:
 *
 *   Invalid value 'DateTimeInfo(dateTime=2026-09-02T09:00:00, timezone=Australia/Sydney)'.
 *   Given datetime cannot be in the past.
 *
 * He never chose 09:00. `toDateTime` invented it, because a date with no time needed one, and by
 * the time he pressed the button 9am that day was hours gone. Two mistakes in one line: inventing a
 * time at all, and then never checking the invented one was reachable.
 *
 * SO THE INVENTED TIME COMES FROM HIS OWN POSTING TIMES NOW. A date with no time means "post it that
 * day", and the console already knows when this channel posts on this lane: the same per-network
 * slots the queue and the wave use (D79). The first slot on that date that has not passed is a far
 * better answer than a constant, and it agrees with everything else the console does.
 *
 * AND A TIME IN THE PAST IS REFUSED HERE, with a sentence saying the two ways out, rather than
 * being sent so Metricool can refuse it in XML. The operator cannot act on a 400 carrying a Java
 * object; he can act on "9:00 has already passed today".
 *
 * PURE, so the rules are asserted in tests rather than trusted, and so no store read is needed to
 * decide something this small.
 */

import { wallClockNow, toWall } from './posting-schedule';

export type WhenResult =
  /** Ready for Metricool: local wall clock, 'YYYY-MM-DDTHH:mm:ss', paired with its timezone. */
  | { ok: true; dateTime: string; /** True when the time came from the channel's slots. */ derived: boolean }
  | { ok: false; error: string };

/** 'HH:mm' to 'HH:mm:ss', and a full stored value to the same shape Metricool takes. */
function seconds(dateTime: string): string {
  const raw = dateTime.trim();
  if (raw.length === 16) return `${raw}:00`;
  return raw.replace(/\.\d+/, '').replace(/Z$/, '').slice(0, 19);
}

export function resolvePostTime(input: {
  /** What the entry carries: 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm[:ss]'. */
  scheduledAt: string;
  timezone: string;
  /** This channel's posting times on this lane, 'HH:mm', ascending. May be empty. */
  slots: readonly string[];
  /** For the sentence, so it names the platform he is looking at. */
  channel: string;
  now?: Date;
}): WhenResult {
  const raw = input.scheduledAt.trim();
  if (raw.length < 10) return { ok: false, error: 'Set a date on this post first.' };

  const now = wallClockNow(input.timezone, input.now ?? new Date());
  const nowKey = `${now.date}T${now.time}`;
  const dateOnly = raw.length <= 10;
  const wall = toWall(raw);

  if (!dateOnly) {
    // He chose it, so it is used as chosen. The only question is whether it can still happen.
    if (`${wall.date}T${wall.time}` <= nowKey) {
      return {
        ok: false,
        error: `${wall.time} on ${wall.date} has already passed, and Metricool will not schedule into the past. Pick a later time, or use Add to queue to take the next free ${input.channel} slot.`,
      };
    }
    return { ok: true, dateTime: seconds(raw), derived: false };
  }

  /**
   * A DATE WITH NO TIME. The first posting time on that date that has not passed.
   *
   * An empty slot list is possible for a channel with no queue (X, Substack), and there the old
   * constant is the only answer available, so it is kept and then checked like anything else.
   */
  const candidates = [...input.slots].sort();
  const usable = candidates.find((t) => `${wall.date}T${t}` > nowKey);
  if (usable) return { ok: true, dateTime: `${wall.date}T${usable}:00`, derived: true };

  if (candidates.length === 0) {
    const fallback = `${wall.date}T09:00`;
    if (fallback > nowKey) return { ok: true, dateTime: `${fallback}:00`, derived: true };
    return {
      ok: false,
      error: `${wall.date} at 09:00 has already passed. Set a time on this post.`,
    };
  }

  return {
    ok: false,
    error: `Every ${input.channel} posting time on ${wall.date} has already passed (${candidates.join(', ')}). Set a time on this post, or use Add to queue to take the next free slot.`,
  };
}
