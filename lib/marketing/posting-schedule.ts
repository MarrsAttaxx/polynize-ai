/**
 * Per-stream posting schedule (D24) — the "ideal times" that power Add to queue.
 * Metricool's API has no queue/time-slot endpoint, so we hold the slots and pick
 * the next open one ourselves, then schedule at that concrete time via REST.
 *
 * A stream's schedule = a timezone (matches what the brand is set to in Metricool)
 * plus a list of daily time slots ('HH:mm'). "Add to queue" appends a post to the
 * next slot after the last one already queued for that stream (or after now).
 *
 * Pure helpers here (no I/O) so the slot logic is simple to reason about; storage
 * lives in metricool-config-store.ts.
 */

export type StreamSchedule = { timezone: string; slots: string[] };
export type PostingSchedule = Record<string, StreamSchedule>;

export const DEFAULT_TIMEZONE = 'Australia/Sydney';
export const DEFAULT_SLOTS = ['09:00', '13:00', '17:00'];

export function defaultStreamSchedule(): StreamSchedule {
  return { timezone: DEFAULT_TIMEZONE, slots: [...DEFAULT_SLOTS] };
}

/** Normalize a stream's schedule: valid HH:mm slots, sorted+unique, sane timezone. */
export function normalizeStreamSchedule(x: unknown): StreamSchedule {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const timezone = typeof o.timezone === 'string' && o.timezone.trim() ? o.timezone.trim() : DEFAULT_TIMEZONE;
  const rawSlots = Array.isArray(o.slots) ? o.slots : [];
  const slots = Array.from(
    new Set(
      rawSlots
        .filter((s): s is string => typeof s === 'string')
        .map((s) => s.trim())
        .filter((s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s))
    )
  ).sort();
  return { timezone, slots: slots.length ? slots : [...DEFAULT_SLOTS] };
}

type Wall = { date: string; time: string };

/** "Now" as wall-clock {date:'YYYY-MM-DD', time:'HH:mm'} in the given IANA timezone. */
export function wallClockNow(timezone: string, now: Date): Wall {
  // en-CA renders ISO-ish YYYY-MM-DD; hourCycle h23 gives 00-23.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

/** Add whole days to a 'YYYY-MM-DD' string (calendar math, tz-agnostic). */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  // Anchor at UTC noon so the +n days can't roll a date boundary.
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + n);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

/** Split a stored scheduled_at ('YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm[:ss]') to Wall. */
export function toWall(scheduledAt: string): Wall {
  const date = scheduledAt.slice(0, 10);
  const time = scheduledAt.length >= 16 ? scheduledAt.slice(11, 16) : '00:00';
  return { date, time };
}

/** The later of two wall-clock points (same timezone), compared lexicographically. */
export function maxWall(a: Wall, b: Wall): Wall {
  const av = `${a.date}T${a.time}`;
  const bv = `${b.date}T${b.time}`;
  return av >= bv ? a : b;
}

/**
 * The next slot strictly after `after`, given sorted 'HH:mm' slots. Returns
 * 'YYYY-MM-DDTHH:mm'. Searches up to ~370 days out as a safety bound.
 */
export function nextSlotAfter(after: Wall, slots: string[]): string {
  const sorted = [...slots].sort();
  if (sorted.length === 0) return `${addDays(after.date, 1)}T${DEFAULT_SLOTS[0]}`;
  const sameDay = sorted.find((s) => s > after.time);
  if (sameDay) return `${after.date}T${sameDay}`;
  return `${addDays(after.date, 1)}T${sorted[0]}`;
}
