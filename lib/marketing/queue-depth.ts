/**
 * HOW FAR OUT THE QUEUE JUST REACHED (D79).
 *
 * "Add to queue" cannot overbook a channel: the slots are the capacity, and a slot already taken is
 * skipped rather than shared. The failure mode that survives that is quieter and it is the one Marrs
 * would actually hit, pressing the button repeatedly the way he described: the post goes somewhere
 * legitimate, just further away than he expected, and nothing on screen mentions it.
 *
 * So this is a SENTENCE, not a limit. Refusing to queue past some depth would be worse: the whole
 * point of the button is that he can press it and move on, and there is nothing wrong with a queue
 * three weeks deep if that is what he meant to build.
 *
 * NO IMPORTS AND NO CLOCK BEYOND `now`, so it is testable without a store or a network. The
 * comparison is done on wall-clock dates in the channel's own timezone, because "how many days out"
 * is a question about the calendar the operator is looking at, not about UTC.
 */

/** Days between two 'YYYY-MM-DD' dates, on the proleptic calendar, ignoring time of day. */
export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  if (!fy || !ty) return 0;
  // Anchored at UTC noon so a DST shift in either zone cannot move the count by a day.
  const a = Date.UTC(fy, fm - 1, fd, 12);
  const b = Date.UTC(ty, tm - 1, td, 12);
  return Math.round((b - a) / 86_400_000);
}

/** Today's date in a timezone, as 'YYYY-MM-DD'. */
export function todayIn(timezone: string, now: Date): string {
  try {
    // en-CA renders YYYY-MM-DD, which is the form every date in this codebase is stored in.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    /**
     * A timezone Intl does not recognise is a config typo, not a reason to fail the queue add. The
     * note is the thing that degrades: returning the UTC date can only make the count slightly wrong,
     * which is better than a 500 on a button whose job is to be pressed without thinking.
     */
    return now.toISOString().slice(0, 10);
  }
}

/**
 * The threshold, in days, past which the depth is worth a sentence.
 *
 * A week. Inside a week the queue is doing exactly what it was set up to do and saying so every time
 * would be noise; past a week the operator is scheduling into a future they may not have in mind.
 */
export const DEEP_DAYS = 7;

/**
 * The note, or empty when there is nothing worth saying.
 *
 * `scheduledAt` is local wall clock ('YYYY-MM-DDTHH:mm:ss'), the same string that goes to Metricool.
 */
export function queueDepthNote(
  scheduledAt: string,
  timezone: string,
  channel: string,
  now: Date = new Date()
): string {
  const date = scheduledAt.slice(0, 10);
  if (date.length !== 10) return '';
  const out = daysBetween(todayIn(timezone, now), date);
  if (out < DEEP_DAYS) return '';
  return `Queued, and ${channel} on this stream is now ${out} days deep: this one posts on ${date}. Add more posting times if that is further out than you want.`;
}
