import { DEFAULT_TIMEZONE, wallClockNow, addDays, toWall } from './posting-schedule';
import { getSheetState, saveSheetState } from '@/lib/content/shoot-sheet-store';
import { isBucketConfigured, getObjectText, putObjectText } from '@/lib/agents/bucket';

/**
 * Per-CHANNEL posting schedule for the Gates build (plan Step 0, "the cadence layer").
 *
 * Marrs: "understanding ultimate state is at least two posts a day per channel per
 * platform... One morning one early afternoon."
 *
 * This evolves posting-schedule.ts, which held slots per STREAM. Under the gates a
 * lane (marrs / polynize) fans out to four networks, and each network gets its own
 * two daily slots, so a piece queues against its channel, not against the stream.
 *
 * Metricool still has no queue endpoint (docs/pam-console/metricool-api.md), so the
 * queue stays computed console-side: we hold the slots, pick the next open one, and
 * schedule at that concrete time. The dateTime Metricool needs is local wall-clock
 * 'YYYY-MM-DDTHH:mm:ss' paired with a separate IANA timezone, never UTC, which is
 * why nextOpenSlots returns { dateTime, timezone } pairs ready for the create call.
 *
 * Storage is the same bucket-or-interim dispatch as idea-store.ts, one file per lane
 * (`pam/channel-schedule/{lane}.json`) so two lanes cannot clobber each other on a
 * read-merge-write.
 */

export type Network = 'linkedin' | 'instagram' | 'tiktok' | 'youtube';

export const NETWORKS: readonly Network[] = ['linkedin', 'instagram', 'tiktok', 'youtube'];

/** 'HH:mm' local times per network. */
export type ChannelSlots = Record<Network, string[]>;

/**
 * HOW a lane publishes to a channel, which is not the same question as when.
 *
 * Marrs, after watching his own numbers: "posting content via platforms like Metricool
 * severely restricts reach... for my personal LinkedIn posts, we have to have a way to
 * alert me with the content. I'll do that on my own via my phone, which just supercharges
 * reach in my experience."
 *
 * So the console stops assuming every post goes out through the scheduler.
 *   'auto'   the wave is scheduled through Metricool, hands off.
 *   'manual' the console prepares the post and SENDS IT TO HIM, and he posts it himself.
 *
 * There is no published evidence either way on the reach penalty (LinkedIn does not
 * comment, and no study compares native against scheduler posting on a real sample). His
 * own observation is therefore the best evidence available, which is exactly the sort of
 * claim a setting should encode rather than an argument should settle.
 */
export type PublishMode = 'auto' | 'manual';
export type ChannelModes = Record<Network, PublishMode>;

export type LaneChannelSchedule = {
  timezone: string;
  channels: ChannelSlots;
  modes: ChannelModes;
};

/**
 * PLACEHOLDERS pending the Metricool best-times spike (gates-build-plan Step 0).
 * The numbers will be replaced by evidence from /planner/best-time-to-publish and
 * later refined by the Learn loop; the SHAPE (two slots, morning and early
 * afternoon, per network) will not. Staggered by half-hours so the four networks
 * never fire at the identical minute.
 */
export const DEFAULT_CHANNEL_SLOTS: ChannelSlots = {
  linkedin: ['08:30', '12:30'],
  instagram: ['09:00', '13:30'],
  tiktok: ['09:30', '14:00'],
  youtube: ['10:00', '15:00'],
};

/**
 * WHERE MANUAL IS THE DEFAULT, and why it is per lane rather than global.
 *
 * Marrs: "I don't actually mind it for the Polynize stream because those ones I usually
 * share with a comment on my own personal page. I don't mind for Polynize, but for my
 * personal LinkedIn posts..." So his own LinkedIn is hand-posted and everything else,
 * including the Polynize page, goes through Metricool.
 *
 * LinkedIn is also the only channel where the question arises at all: it is where he has
 * seen the difference, and where the document carousel cannot be scheduled by us anyway.
 */
const MANUAL_BY_DEFAULT: Record<string, Network[]> = {
  marrs: ['linkedin'],
};

const SAFE_LANE = /^[a-z0-9_-]{1,40}$/;

function keyFor(lane: string): string {
  if (!SAFE_LANE.test(lane)) throw new Error(`[channel-schedule] unsafe lane id: ${lane}`);
  return `pam/channel-schedule/${lane}.json`;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function defaultChannelSchedule(lane?: string): LaneChannelSchedule {
  const channels = {} as ChannelSlots;
  const modes = {} as ChannelModes;
  const manual = new Set(lane ? (MANUAL_BY_DEFAULT[lane] ?? []) : []);
  for (const n of NETWORKS) {
    channels[n] = [...DEFAULT_CHANNEL_SLOTS[n]];
    modes[n] = manual.has(n) ? 'manual' : 'auto';
  }
  return { timezone: DEFAULT_TIMEZONE, channels, modes };
}

/**
 * One network's slots: valid 'HH:mm' only, trimmed, unique, sorted. An empty or
 * garbage list falls back to that network's defaults rather than to nothing,
 * because a channel with zero slots would silently drop out of the queue and the
 * cadence target ("two a day") would erode without anyone noticing.
 */
function normalizeSlots(raw: unknown, network: Network): string[] {
  const arr = Array.isArray(raw) ? raw : [];
  const slots = Array.from(
    new Set(
      arr
        .filter((s): s is string => typeof s === 'string')
        .map((s) => s.trim())
        .filter((s) => HHMM.test(s))
    )
  ).sort();
  return slots.length ? slots : [...DEFAULT_CHANNEL_SLOTS[network]];
}

/** Tolerant parse of whatever is on disk: bad slots dropped, missing networks defaulted. */
export function normalizeChannelSchedule(x: unknown, lane?: string): LaneChannelSchedule {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const timezone =
    typeof o.timezone === 'string' && o.timezone.trim() ? o.timezone.trim() : DEFAULT_TIMEZONE;
  const rawChannels = (
    o.channels && typeof o.channels === 'object' ? o.channels : {}
  ) as Record<string, unknown>;
  const rawModes = (o.modes && typeof o.modes === 'object' ? o.modes : {}) as Record<
    string,
    unknown
  >;
  // The lane matters here: a file written before modes existed has none, and defaulting
  // those to 'auto' would quietly start pushing his personal LinkedIn through Metricool,
  // which is the exact behaviour this setting exists to prevent. So a missing mode falls
  // back to the LANE's default, not to a global one.
  const fallback = defaultChannelSchedule(lane).modes;
  const channels = {} as ChannelSlots;
  const modes = {} as ChannelModes;
  for (const n of NETWORKS) {
    channels[n] = normalizeSlots(rawChannels[n], n);
    modes[n] = rawModes[n] === 'manual' ? 'manual' : rawModes[n] === 'auto' ? 'auto' : fallback[n];
  }
  return { timezone, channels, modes };
}

/**
 * A lane's schedule, defaults on any failure. This feeds the auto-queue path, so a
 * broken config file must degrade to the placeholder times, not take queueing down.
 */
export async function getChannelSchedule(lane: string): Promise<LaneChannelSchedule> {
  const key = keyFor(lane);
  try {
    if (isBucketConfigured()) {
      return normalizeChannelSchedule(JSON.parse((await getObjectText(key)) || 'null'), lane);
    }
    const s = (await getSheetState(key)) as { schedule?: unknown } | null;
    return normalizeChannelSchedule(s?.schedule, lane);
  } catch (err) {
    console.error(`[channel-schedule] read failed for ${lane}:`, err);
    return defaultChannelSchedule(lane);
  }
}

export async function saveChannelSchedule(lane: string, s: LaneChannelSchedule): Promise<void> {
  const key = keyFor(lane);
  // Normalize on the way in, so garbage can never be persisted and read back as truth.
  // The lane is passed so an explicitly saved mode survives and a missing one still lands
  // on the lane's default rather than on a global assumption.
  const clean = normalizeChannelSchedule(s, lane);
  if (isBucketConfigured()) {
    await putObjectText(key, JSON.stringify(clean, null, 2));
  } else {
    await saveSheetState(key, { schedule: clean });
  }
}

/** Wall is not exported by posting-schedule.ts, so it is derived from a helper it does export. */
type Wall = ReturnType<typeof wallClockNow>;

/**
 * Runaway guard on the day walk. Sixty days at two slots a day is 120 candidates
 * per channel, far beyond any real queue depth; if we hit this, something upstream
 * is asking for nonsense and getting fewer results back is the honest answer.
 */
const MAX_WALK_DAYS = 60;

/**
 * The next `count` open slots on one channel, as Metricool-ready
 * { dateTime: 'YYYY-MM-DDTHH:mm:ss', timezone } pairs.
 *
 * `taken` is the list of local dateTimes (same timezone) already occupied on that
 * channel. Starting from the schedule timezone's current wall-clock (or `from`),
 * walk forward day by day through the network's slots, skipping any slot at or
 * before now and any slot already taken. Never returns a past time, never a
 * duplicate (each date+slot pair is visited exactly once, in ascending order),
 * and rolls into following days when count exceeds one day's slots. Returns fewer
 * than count only if the 60-day guard is hit.
 */
export function nextOpenSlots(
  schedule: LaneChannelSchedule,
  network: Network,
  count: number,
  taken: string[],
  from?: Date
): { dateTime: string; timezone: string }[] {
  const out: { dateTime: string; timezone: string }[] = [];
  if (count <= 0) return out;

  const timezone =
    typeof schedule.timezone === 'string' && schedule.timezone.trim()
      ? schedule.timezone.trim()
      : DEFAULT_TIMEZONE;
  // Same fallback as normalize: an empty channel queues at the defaults, not never.
  const slots = normalizeSlots(schedule.channels?.[network], network);

  const now: Wall = wallClockNow(timezone, from ?? new Date());
  const nowKey = `${now.date}T${now.time}`;

  // Compare at minute precision via toWall, so '...T09:00:00' and '...T09:00' both
  // block the 09:00 slot regardless of which form the caller stored.
  const takenSet = new Set(
    taken.map((t) => {
      const w = toWall(t);
      return `${w.date}T${w.time}`;
    })
  );

  for (let day = 0; day < MAX_WALK_DAYS && out.length < count; day++) {
    const date = addDays(now.date, day);
    for (const slot of slots) {
      if (out.length >= count) break;
      const wallKey = `${date}T${slot}`;
      // Fixed-width 'YYYY-MM-DDTHH:mm' strings, so lexicographic compare is chronological.
      if (wallKey <= nowKey) continue;
      if (takenSet.has(wallKey)) continue;
      out.push({ dateTime: `${wallKey}:00`, timezone });
    }
  }
  return out;
}
