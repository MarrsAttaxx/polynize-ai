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

/**
 * WHAT A SLOT IS FOR (D46), and why the vocabulary has two values rather than three.
 *
 * Marrs: "I'm going to keep the LinkedIn to two posts a day: video, text and images. That's fine,
 * that's what morning and afternoon covered."
 *
 * The split he named is video against text-and-images. That is TWO buckets, not the three the kit
 * carries, and it has to be two: every LinkedIn still post in the catalogue is a TEXT master with
 * a mandatory attached image (D42 rule 2, no optional escape), so a slot typed 'image' would match
 * nothing on LinkedIn and would kill the afternoon as well as the morning. 'still' is his "text and
 * images", one bucket, exactly as he said it.
 */
export type SlotKind = 'video' | 'still';

/**
 * What a TIME prefers. 'any' is not a kind: it means the slot states no preference and takes
 * whatever arrives, which is how every slot behaved before this existed and how every network we
 * have no instruction about still behaves.
 */
export type SlotPrefers = SlotKind | 'any';

/** Per network, 'HH:mm' to what that time prefers. */
export type ChannelSlotPrefers = Record<Network, Record<string, SlotPrefers>>;

export type LaneChannelSchedule = {
  timezone: string;
  channels: ChannelSlots;
  modes: ChannelModes;
  /**
   * ADDED AS A SIBLING KEY, not as a change to ChannelSlots, and that is load-bearing rather than
   * tidy. Turning the slot list into objects would break the tolerant parse in BOTH directions:
   * normalizeSlots filters on `typeof s === 'string'`, so a new-shape file read by an un-updated
   * normalize drops every slot and falls back to the placeholder times SILENTLY, because that
   * fallback has no log line. It would also lose the Set dedupe (objects never dedupe) and turn
   * the sort into a compare over '[object Object]'. A sibling key cannot do any of that: the worst
   * case is that it is ignored.
   */
  prefers: ChannelSlotPrefers;
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
 * Noon. Anything before it is the morning slot, anything at or after it is the afternoon one.
 *
 * The default preference is derived from the TIME rather than keyed to the literal '08:30',
 * because the comment above says in as many words that these times are placeholders pending the
 * Metricool best-times spike. A table keyed to '08:30' would silently stop applying the day the
 * evidence moves it to 08:00, and his morning-video rule would evaporate with no error.
 */
const MORNING_ENDS = '12:00';

/**
 * WHAT EACH NETWORK'S SLOTS DEFAULT TO PREFERRING.
 *
 * LinkedIn is typed because he typed it: morning video, afternoon text and images (D44). The
 * other three are left with NO preference, deliberately, because he said nothing about them and
 * 'any' is a provable no-op. Two of them could not be typed the same way even if we wanted to:
 * per narrative TikTok and YouTube produce 3 video posts and 0 stills, so typing either of their
 * slots 'still' would point a preference at a pool that does not exist.
 *
 * If he later says the same shape applies everywhere, this function is the entire change.
 */
export function defaultPrefersFor(network: Network, time: string): SlotPrefers {
  if (network !== 'linkedin') return 'any';
  return time < MORNING_ENDS ? 'video' : 'still';
}

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

/**
 * WHERE A LANE'S PERSON ACTUALLY IS (D68).
 *
 * Marrs: "Just to note that Kristen's in California, but that's okay. We can fix that."
 *
 * Every lane used to default to Sydney, which is right for four of five people and wrong for the
 * one who is fifteen hours away: her morning video would have gone out in her late afternoon.
 *
 * A named default rather than a shrug, for the same reason MANUAL_BY_DEFAULT above is one: the
 * fact belongs in the code where it is true, not in a config file someone has to remember to set
 * before her first wave. An explicitly saved value still wins over this.
 */
const LANE_TIMEZONE: Record<string, string> = {
  kristin: 'America/Los_Angeles',
};

const SAFE_LANE = /^[a-z0-9_-]{1,40}$/;

function keyFor(lane: string): string {
  if (!SAFE_LANE.test(lane)) throw new Error(`[channel-schedule] unsafe lane id: ${lane}`);
  return `pam/channel-schedule/${lane}.json`;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function laneTimezone(lane?: string, fallback?: string): string {
  /**
   * PRECEDENCE, and each step is there for a reason:
   *   a value the operator saved  >  the lane's known home  >  Sydney.
   * `fallback` is the operator-editable one, passed in by the caller that can read it, so this
   * stays pure and testable.
   */
  return (fallback && fallback.trim()) || (lane && LANE_TIMEZONE[lane]) || DEFAULT_TIMEZONE;
}

export function defaultChannelSchedule(lane?: string, fallbackTz?: string): LaneChannelSchedule {
  const channels = {} as ChannelSlots;
  const modes = {} as ChannelModes;
  const prefers = {} as ChannelSlotPrefers;
  const manual = new Set(lane ? (MANUAL_BY_DEFAULT[lane] ?? []) : []);
  for (const n of NETWORKS) {
    channels[n] = [...DEFAULT_CHANNEL_SLOTS[n]];
    modes[n] = manual.has(n) ? 'manual' : 'auto';
    prefers[n] = {};
    for (const t of channels[n]) prefers[n][t] = defaultPrefersFor(n, t);
  }
  return { timezone: laneTimezone(lane, fallbackTz), channels, modes, prefers };
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

/**
 * Words a person might actually type in a hand-edited config, mapped to the two kinds.
 *
 * 'text' and 'image' BOTH land on 'still' on purpose. They are the two halves of one bucket here,
 * and treating them as separate kinds is the specific mistake that would kill the afternoon slot:
 * every LinkedIn still post is a text master carrying an image, so a slot typed 'image' matches
 * nothing at all.
 */
const PREFERS_WORDS: Record<string, SlotPrefers> = {
  video: 'video',
  still: 'still',
  stills: 'still',
  text: 'still',
  image: 'still',
  images: 'still',
  any: 'any',
  '': 'any',
};

/**
 * One network's preferences, keyed by TIME and never by position.
 *
 * normalizeSlots sorts, so "the morning slot" is only ever "whatever sorts first". Keying a
 * preference to position 0 means adding 07:00 to a lane silently moves the video preference onto
 * it and turns 08:30 into a still slot. Keyed by the string, 07:00 arrives with its own default
 * and 08:30 keeps what it was given.
 *
 * PER SLOT, NOT ALL OR NOTHING. A named preference wins, then the network's default for that
 * time, then 'any'. An all-or-nothing gate (apply defaults only when the whole object is absent)
 * freezes a network's preferences on the first save, so a time added later becomes an untyped
 * wildcard even though a default exists for it.
 */
function normalizeSlotPrefers(
  raw: unknown,
  network: Network,
  slots: string[]
): Record<string, SlotPrefers> {
  const named = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: Record<string, SlotPrefers> = {};
  for (const t of slots) {
    const v = named[t];
    const word = typeof v === 'string' ? PREFERS_WORDS[v.trim().toLowerCase()] : undefined;
    out[t] = word ?? defaultPrefersFor(network, t);
  }
  return out;
}

/** Tolerant parse of whatever is on disk: bad slots dropped, missing networks defaulted. */
export function normalizeChannelSchedule(
  x: unknown,
  lane?: string,
  fallbackTz?: string
): LaneChannelSchedule {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const timezone =
    typeof o.timezone === 'string' && o.timezone.trim()
      ? o.timezone.trim()
      : laneTimezone(lane, fallbackTz);
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
  const rawPrefers = (o.prefers && typeof o.prefers === 'object' ? o.prefers : {}) as Record<
    string,
    unknown
  >;
  const channels = {} as ChannelSlots;
  const modes = {} as ChannelModes;
  const prefers = {} as ChannelSlotPrefers;
  for (const n of NETWORKS) {
    channels[n] = normalizeSlots(rawChannels[n], n);
    modes[n] = rawModes[n] === 'manual' ? 'manual' : rawModes[n] === 'auto' ? 'auto' : fallback[n];
    // A file written before preferences existed has none, and every slot lands on its network's
    // default. Safe by construction: the default is 'any' everywhere except LinkedIn, and
    // LinkedIn's is a PREFERENCE rather than a filter, so nothing can be stranded by it.
    prefers[n] = normalizeSlotPrefers(rawPrefers[n], n, channels[n]);
  }
  return { timezone, channels, modes, prefers };
}

/**
 * A lane's schedule, defaults on any failure. This feeds the auto-queue path, so a
 * broken config file must degrade to the placeholder times, not take queueing down.
 *
 * IT NOW HONOURS THE TIMEZONE THE OPERATOR CAN ACTUALLY EDIT (D68). Nothing has ever written a
 * lane's schedule file, so its timezone was pinned to the Sydney default forever, while the field
 * on the Connect Metricool page wrote a DIFFERENT store. Since D61 made the wave's zone the one
 * stamped on an entry and sent to Metricool, that made the only editable timezone decorative for
 * everything a wave creates.
 *
 * So the posting schedule's per-stream timezone becomes the fallback here. One field, one effect.
 * A read failure on it costs the fallback and nothing else, which is why it is caught separately.
 */
export async function getChannelSchedule(lane: string): Promise<LaneChannelSchedule> {
  const key = keyFor(lane);

  let editable: string | undefined;
  try {
    const { getPostingSchedule } = await import('./metricool-config-store');
    editable = (await getPostingSchedule())[lane]?.timezone;
  } catch (err) {
    console.error(`[channel-schedule] posting schedule read failed for ${lane}:`, err);
  }

  try {
    if (isBucketConfigured()) {
      return normalizeChannelSchedule(
        JSON.parse((await getObjectText(key)) || 'null'),
        lane,
        editable
      );
    }
    const s = (await getSheetState(key)) as { schedule?: unknown } | null;
    return normalizeChannelSchedule(s?.schedule, lane, editable);
  } catch (err) {
    console.error(`[channel-schedule] read failed for ${lane}:`, err);
    return defaultChannelSchedule(lane, editable);
  }
}

export async function saveChannelSchedule(
  lane: string,
  s: LaneChannelSchedule
): Promise<LaneChannelSchedule> {
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
  /**
   * RETURNS WHAT WAS STORED, not what was asked for, so a screen can show the difference (D79). An
   * emptied time list becomes that network's defaults in here; a caller that echoes this back makes
   * that correction visible instead of surprising the operator on their next visit.
   */
  return clean;
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

  // The never-a-duplicate guarantee was BORROWED from the Set inside normalizeSlots rather than
  // held here, which the doc comment above asserted as if it were local. Two lines make it local,
  // which matters the day a settings screen or a keyed preference map touches the slot list.
  const used = new Set<string>();

  for (let day = 0; day < MAX_WALK_DAYS && out.length < count; day++) {
    const date = addDays(now.date, day);
    for (const slot of slots) {
      if (out.length >= count) break;
      const wallKey = `${date}T${slot}`;
      // Fixed-width 'YYYY-MM-DDTHH:mm' strings, so lexicographic compare is chronological.
      if (wallKey <= nowKey) continue;
      if (takenSet.has(wallKey)) continue;
      if (used.has(wallKey)) continue;
      used.add(wallKey);
      out.push({ dateTime: `${wallKey}:00`, timezone });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ the matcher */

/** One thing that wants a slot, and what kind of thing it is. */
export type SlotDemand<T> = { kind: SlotKind; item: T };

export type SlotPlacement<T> = {
  item: T;
  /**
   * Absent ONLY when the 60-day walk ran out of open slots, exactly as nextOpenSlots has always
   * behaved when asked for more than a channel can hold. Preferences do not make this more
   * likely: the window is the same size it has always been.
   */
  slot?: { dateTime: string; timezone: string };
  /** What the slot it landed in asks for. */
  prefers: SlotPrefers;
  /**
   * False means a FALLBACK placement: a still post sitting in the video slot because there was no
   * video for it. The Gate 5 grid shows this rather than hiding it, because a Rules post at 08:30
   * with no explanation reads as a feature that did not work.
   */
  preferred: boolean;
};

/**
 * Place demand into a channel's next open slots: by preference first, by fallback second.
 *
 * THE INVARIANT THAT MAKES THIS SAFE, and it is arithmetic rather than argument: the slots
 * CONSUMED are exactly the ones `nextOpenSlots(schedule, network, demand.length, taken)` returns,
 * unchanged and unreordered. nextOpenSlots is not touched, so "never a past time", "never a
 * duplicate" and the 60-day guard are INHERITED rather than re-earned. Compared with the untyped
 * fill this replaces, it cannot place fewer posts, cannot place one later, and cannot place two at
 * the same minute. The only thing it decides is WHICH item sits in WHICH of those slots.
 * Preference reorders. It never delays and it never drops.
 *
 * SLOT-MAJOR, TWO WALKS. Walking the window in time order and pulling the earliest unplaced item
 * of the right kind keeps each walk monotone in time, so a series of three cuts still goes out in
 * hook order. Walking items instead would let hook 3 out before hook 1.
 *
 * Walk 1 fills EXACT matches only and deliberately skips 'any' slots: an undeclared slot is the
 * reserve, and spending it in walk 1 could strand an item whose own kind was still free. Slots
 * [any, video] with items [video, still] is the smallest case. Walk 2 spends the reserve, and only
 * then mismatches.
 *
 * The greedy is OPTIMAL on preference matches, not merely reasonable. After walk 1 no unplaced
 * item matches any remaining typed slot, or walk 1 would have paired them, so the count of
 * preferred placements is fixed before walk 2 makes a single choice.
 */
export function matchOpenSlots<T>(
  schedule: LaneChannelSchedule,
  network: Network,
  demand: SlotDemand<T>[],
  taken: string[],
  from?: Date
): SlotPlacement<T>[] {
  const out: SlotPlacement<T>[] = demand.map((d) => ({
    item: d.item,
    prefers: 'any' as SlotPrefers,
    preferred: false,
  }));
  if (demand.length === 0) return out;

  const slots = nextOpenSlots(schedule, network, demand.length, taken, from);
  const slotList = normalizeSlots(schedule.channels?.[network], network);
  const prefersMap = normalizeSlotPrefers(schedule.prefers?.[network], network, slotList);
  // 'YYYY-MM-DDTHH:mm:ss'.slice(11, 16) is 'HH:mm', which is how the map is keyed.
  const prefersOf = (dateTime: string): SlotPrefers =>
    prefersMap[dateTime.slice(11, 16)] ?? 'any';

  const slotUsed = new Array<boolean>(slots.length).fill(false);
  const itemUsed = new Array<boolean>(demand.length).fill(false);

  for (let pass = 0; pass < 2; pass++) {
    for (let sx = 0; sx < slots.length; sx++) {
      if (slotUsed[sx]) continue;
      const prefers = prefersOf(slots[sx].dateTime);
      if (pass === 0 && prefers === 'any') continue;
      let picked = -1;
      for (let i = 0; i < demand.length; i++) {
        if (itemUsed[i]) continue;
        if (pass === 0 && prefers !== demand[i].kind) continue;
        picked = i;
        break;
      }
      if (picked < 0) continue;
      slotUsed[sx] = true;
      itemUsed[picked] = true;
      out[picked].slot = slots[sx];
      out[picked].prefers = prefers;
      out[picked].preferred = prefers === 'any' || prefers === demand[picked].kind;
    }
  }
  return out;
}

/**
 * What the slot at a stored scheduled_at asks for, for the Gate 5 grid.
 *
 * Read from the CURRENT table rather than stamped on the entry at plan time, which is deliberately
 * the opposite of what publish_mode does. publish_mode is stamped because changing a lane's
 * setting must not silently rewrite how an already-planned wave GOES OUT. This is only a label,
 * and the useful reading of a label is "does the table I am looking at now agree with the calendar
 * I am looking at now", which a stamp cannot answer.
 */
export function slotPrefersAt(
  schedule: LaneChannelSchedule,
  channel: string,
  scheduledAt: string
): SlotPrefers {
  if (!(NETWORKS as readonly string[]).includes(channel)) return 'any';
  const network = channel as Network;
  const slotList = normalizeSlots(schedule.channels?.[network], network);
  const prefersMap = normalizeSlotPrefers(schedule.prefers?.[network], network, slotList);
  return prefersMap[toWall(scheduledAt).time] ?? 'any';
}
