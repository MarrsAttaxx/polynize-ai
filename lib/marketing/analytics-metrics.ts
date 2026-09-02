/**
 * REAL NUMBERS, NORMALISED (D86). The pure half of the analytics build: the shape a post's metrics
 * take once they are ours, and every summary the panel draws from them.
 *
 * Marrs: "Can we focus on the analytics dashboards now? I'd love to get those up and running."
 *
 * WHY ONE ENDPOINT AND NOT FIVE. `/v2/analytics/brand-summary/posts` returns every post on a brand
 * across every network in one call, each with its text, its url, its publication date, its type and
 * a normalised metric block. The four per-network endpoints carry more fields (LinkedIn's clicks,
 * Instagram's saves and follows, Reels' watch time and skip rate) and they carry them in four
 * different shapes. Starting with the one cross-network feed means the panel is real today off a
 * single proven call, and the richer per-network fields are an addition rather than a rewrite.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO: invent a number. A metric the feed did not carry is absent
 * here rather than zero, and every consumer is written to say "no data yet" rather than to print a
 * zero, because **a zero is a claim**. That was already the rule for the mock panel; it matters more
 * now that some tiles are real and some are not, since the mixture is exactly where a false zero
 * would be believed.
 *
 * PURE, so the arithmetic is asserted in tests rather than trusted, and so the panel (a server
 * component) can import it without dragging a store or the API client with it.
 */

/** One published post, as we keep it. Absent means unknown; never 0 standing in for unknown. */
export type PostMetrics = {
  /** The platform's own id, e.g. 'urn:li:ugcPost:7500343632873517056'. Our dedupe key. */
  id: string;
  network: string;
  /** Their own label for the post kind: POST, TEXT, VIDEO, REEL. Not our frame vocabulary. */
  type?: string;
  /** The first line or so, purely so a row is recognisable on screen. */
  text: string;
  /** The public url, which is also the join key back to one of our calendar entries. */
  url?: string;
  /** Local wall clock 'YYYY-MM-DDTHH:mm', as the feed gave it. */
  published_at?: string;
  impressions?: number;
  interactions?: number;
  /** Percent, as the platform computes it. Never re-derived here: their divisor is not ours. */
  engagement?: number;
};

/* ------------------------------------------------------------------ reading their feed */

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/**
 * Their metric block is UPPERCASE and its presence varies by network:
 *   "metrics": { "INTERACTIONS": 5.0, "ENGAGEMENT": 6.024096385542169, "IMPRESSIONS": 83.0 }
 *
 * Read case-insensitively and with the aliases the per-network feeds use, so a network that says
 * `views` or `reach` instead of `impressions` still lands in the same column rather than vanishing.
 */
function metric(block: Record<string, unknown>, names: string[]): number | undefined {
  const lower: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(block)) lower[k.toLowerCase()] = v;
  for (const n of names) {
    const hit = num(lower[n.toLowerCase()]);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

/**
 * One row of their feed to one of ours, or null when it is not a post we can identify.
 *
 * A row with no id is dropped rather than kept with a generated one: the id is what stops the same
 * post being counted twice across two overlapping pulls, and a made-up one would guarantee it.
 */
export function normalizePost(raw: unknown, fallbackNetwork?: string): PostMetrics | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = str(o.id) ?? str(o.postId) ?? str(o.videoId) ?? str(o.reelId);
  if (!id) return null;

  const metrics = (o.metrics && typeof o.metrics === 'object' ? o.metrics : {}) as Record<
    string,
    unknown
  >;
  /** The numbers sit under `metrics` in the brand feed and at the top level in the per-network ones. */
  const both = { ...o, ...metrics };

  /**
   * THREE DATE FIELDS, one per feed, found by testing against his real rows rather than by reading
   * the spec: the brand feed wraps it in `publicationDate.dateTime`, the LinkedIn feed in
   * `created.dateTime`, and TikTok hands over a flat `createTime` with an offset on the end.
   * Missing one costs the post its place in the trend and in the window, silently.
   */
  const date = o.publicationDate ?? o.created ?? o.createTime;
  const dateTime =
    date && typeof date === 'object'
      ? str((date as Record<string, unknown>).dateTime)
      : str(date);

  return {
    id,
    /**
     * ONLY THE BRAND FEED SAYS WHICH NETWORK A ROW IS FROM. The per-network endpoints do not carry
     * the field at all, because the caller asked for one network by name, so the caller has to say.
     * Without the fallback every per-network row lands as 'unknown' and the platform breakdown
     * collapses into one meaningless bar. Found by testing the reader against his real LinkedIn and
     * TikTok payloads, which is exactly what fixtures are for.
     */
    network: str(o.network) ?? str(o.networkConnection) ?? fallbackNetwork ?? 'unknown',
    type: str(o.type),
    text: (str(o.text) ?? str(o.comment) ?? str(o.videoDescription) ?? '').slice(0, 300),
    url: str(o.link) ?? str(o.url) ?? str(o.shareUrl) ?? str(o.permalink),
    published_at: dateTime ? dateTime.slice(0, 16) : undefined,
    impressions: metric(both, ['impressions', 'impressionsTotal', 'views', 'viewCount', 'reach']),
    interactions: metric(both, ['interactions', 'engagementCount', 'likes', 'likeCount']),
    engagement: metric(both, ['engagement']),
  };
}

/** Every identifiable post in a response, whatever wrapper it arrived in. */
export function normalizeFeed(value: unknown, fallbackNetwork?: string): PostMetrics[] {
  const rows = Array.isArray(value)
    ? value
    : Array.isArray((value as { data?: unknown[] } | null)?.data)
      ? (value as { data: unknown[] }).data
      : [];
  const out: PostMetrics[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const p = normalizePost(r, fallbackNetwork);
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

/* ------------------------------------------------------------------ what the panel draws */

export type NetworkTotal = { network: string; posts: number; impressions?: number };

export type Summary = {
  posts: number;
  /** Absent when not one post carried the figure, which is different from every post scoring 0. */
  impressions?: number;
  interactions?: number;
  /** The average of the platform's own per-post percentages, weighted by nothing. */
  engagement?: number;
  byNetwork: NetworkTotal[];
  /** Newest first, for the table. */
  top: PostMetrics[];
  /** Impressions per week, oldest first, for the sparkline. Empty when no post carried a date. */
  trend: number[];
  /** The window the numbers cover, as the newest and oldest dates actually seen. */
  first?: string;
  last?: string;
};

/**
 * Sum, but only over what is there.
 *
 * `undefined` is preserved all the way to the tile: if no post in the window reported impressions,
 * the panel must say so rather than print 0, because 0 impressions is a real and different claim
 * from "the platform did not tell us".
 */
function total(values: (number | undefined)[]): number | undefined {
  const present = values.filter((v): v is number => v !== undefined);
  return present.length ? present.reduce((a, b) => a + b, 0) : undefined;
}

function mean(values: (number | undefined)[]): number | undefined {
  const present = values.filter((v): v is number => v !== undefined);
  return present.length ? present.reduce((a, b) => a + b, 0) / present.length : undefined;
}

/**
 * ISO week bucket for a wall-clock date, as an ordinal we only ever compare and sort.
 *
 * Anchored at UTC noon so a timezone offset cannot move a post into the neighbouring week, and
 * counted from the epoch's Monday so the arithmetic needs no calendar.
 */
export function weekIndex(date: string): number | undefined {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return undefined;
  const days = Math.floor(Date.UTC(y, m - 1, d, 12) / 86_400_000);
  // 1970-01-01 was a Thursday, so +3 lands week boundaries on Monday.
  return Math.floor((days + 3) / 7);
}

export function summarise(posts: PostMetrics[], weeks = 12): Summary {
  const dated = posts.filter((p) => p.published_at).slice();
  dated.sort((a, b) => (a.published_at! < b.published_at! ? 1 : -1));

  const byNet = new Map<string, PostMetrics[]>();
  for (const p of posts) {
    if (!byNet.has(p.network)) byNet.set(p.network, []);
    byNet.get(p.network)!.push(p);
  }

  /**
   * THE TREND IS ZERO-FILLED AND THAT IS CORRECT HERE, unlike the totals. A week with no posts
   * really did earn no impressions, so a gap in the line is a fact rather than an absence. The
   * distinction is the whole reason the two are computed differently.
   */
  const indices = posts
    .map((p) => (p.published_at ? weekIndex(p.published_at) : undefined))
    .filter((x): x is number => x !== undefined);
  let trend: number[] = [];
  if (indices.length) {
    const last = Math.max(...indices);
    const buckets = new Array(weeks).fill(0) as number[];
    for (const p of posts) {
      const ix = p.published_at ? weekIndex(p.published_at) : undefined;
      if (ix === undefined) continue;
      const slot = weeks - 1 - (last - ix);
      if (slot >= 0 && slot < weeks) buckets[slot] += p.impressions ?? 0;
    }
    trend = buckets;
  }

  return {
    posts: posts.length,
    impressions: total(posts.map((p) => p.impressions)),
    interactions: total(posts.map((p) => p.interactions)),
    engagement: mean(posts.map((p) => p.engagement)),
    byNetwork: [...byNet.entries()]
      .map(([network, ps]) => ({
        network,
        posts: ps.length,
        impressions: total(ps.map((p) => p.impressions)),
      }))
      .sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0)),
    top: dated.slice(0, 5),
    trend,
    last: dated[0]?.published_at,
    first: dated[dated.length - 1]?.published_at,
  };
}

/** Sum several streams' summaries into the engine page's one, without re-reading anything. */
export function mergeSummaries(parts: Summary[]): Summary {
  const all = parts.filter((p) => p.posts > 0);
  const nets = new Map<string, NetworkTotal>();
  for (const p of all) {
    for (const n of p.byNetwork) {
      const prior = nets.get(n.network);
      nets.set(n.network, {
        network: n.network,
        posts: (prior?.posts ?? 0) + n.posts,
        impressions: total([prior?.impressions, n.impressions]),
      });
    }
  }
  const width = Math.max(0, ...all.map((p) => p.trend.length));
  const trend = width
    ? new Array(width).fill(0).map((_, i) =>
        all.reduce((sum, p) => sum + (p.trend[p.trend.length - width + i] ?? 0), 0)
      )
    : [];
  const dates = all.flatMap((p) => [p.first, p.last]).filter((x): x is string => Boolean(x)).sort();

  return {
    posts: all.reduce((n, p) => n + p.posts, 0),
    impressions: total(all.map((p) => p.impressions)),
    interactions: total(all.map((p) => p.interactions)),
    engagement: mean(all.map((p) => p.engagement)),
    byNetwork: [...nets.values()].sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0)),
    top: all
      .flatMap((p) => p.top)
      .sort((a, b) => (a.published_at ?? '') < (b.published_at ?? '') ? 1 : -1)
      .slice(0, 5),
    trend,
    first: dates[0],
    last: dates[dates.length - 1],
  };
}

/* ------------------------------------------------------------------ ranges and shapes (D87) */

/**
 * THE RANGE PRESETS. Marrs: "Is it possible for us to have a button that says the last week, the
 * last month, and the last 90 days, so you can choose between those?"
 *
 * ONE PULL SERVES ALL THREE. The store holds 90 days, so a range is a filter over what we already
 * have rather than another call to Metricool: switching is instant, costs nothing, and cannot fail.
 * That is the whole reason the pull window is 90 and not 7.
 */
export const RANGES = [
  { id: '7', label: 'Last 7 days', days: 7 },
  { id: '30', label: 'Last 30 days', days: 30 },
  { id: '90', label: 'Last 90 days', days: 90 },
] as const;

export type RangeId = (typeof RANGES)[number]['id'];

/** The first date inside a range ending today, both as 'YYYY-MM-DD'. */
export function rangeStart(today: string, days: number): string {
  const [y, m, d] = today.split('-').map(Number);
  if (!y) return today;
  const at = new Date(Date.UTC(y, m - 1, d, 12) - (days - 1) * 86_400_000);
  return at.toISOString().slice(0, 10);
}

/**
 * Posts on or after a date. A post with no date is EXCLUDED from a range, because a range is a claim
 * about when something happened and an undated post cannot support it. It still counts in the
 * all-time totals, which is why this is a filter rather than a property of the post.
 */
export function postsSince(posts: PostMetrics[], from: string): PostMetrics[] {
  return posts.filter((p) => p.published_at && p.published_at.slice(0, 10) >= from);
}

export type Bucket = { key: string; label: string; value: number; posts: number };

/**
 * IMPRESSIONS OVER TIME, bucketed by day or by week.
 *
 * BY DAY UP TO A MONTH, BY WEEK BEYOND IT. Ninety daily points on a chart this size is a comb
 * nobody can read, and five weekly points over a fortnight hides the shape entirely, so the bucket
 * follows the range rather than being fixed. Thirty-one is the boundary because a calendar month is
 * the longest range anyone reads day by day.
 *
 * EVERY BUCKET IN THE RANGE IS PRESENT, including the empty ones. A week with no posts really did
 * earn no impressions, so a gap in the line is a fact rather than missing data. This is the exact
 * opposite of the rule for the totals, where an absent metric must never print as a zero, and the
 * two live side by side on purpose.
 */
export function bucketSeries(
  posts: PostMetrics[],
  from: string,
  today: string,
  by: 'day' | 'week' = 'day'
): Bucket[] {
  const start = weekOrDay(from, by);
  const end = weekOrDay(today, by);
  if (start === undefined || end === undefined || end < start) return [];

  const buckets = new Map<number, Bucket>();
  for (let k = start; k <= end; k += 1) {
    buckets.set(k, { key: String(k), label: labelFor(k, by), value: 0, posts: 0 });
  }
  for (const p of posts) {
    const k = p.published_at ? weekOrDay(p.published_at, by) : undefined;
    if (k === undefined) continue;
    const b = buckets.get(k);
    if (!b) continue;
    b.value += p.impressions ?? 0;
    b.posts += 1;
  }
  return [...buckets.values()];
}

/** Days since the epoch, or ISO-ish weeks since it, so bucketing needs no calendar library. */
function weekOrDay(date: string, by: 'day' | 'week'): number | undefined {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return undefined;
  const days = Math.floor(Date.UTC(y, m - 1, d, 12) / 86_400_000);
  return by === 'day' ? days : Math.floor((days + 3) / 7);
}

/** A bucket back to a readable date. Weeks are labelled by the Monday they start on. */
function labelFor(k: number, by: 'day' | 'week'): string {
  const days = by === 'day' ? k : k * 7 - 3;
  return new Date(days * 86_400_000).toISOString().slice(0, 10);
}

export type StreamSlice = { stream: string; label: string; posts: PostMetrics[] };

export type Stack = {
  network: string;
  /** Absent when not one contributing post reported a figure. */
  impressions?: number;
  posts: number;
  segments: { stream: string; label: string; impressions?: number; posts: number }[];
};

/**
 * WHOSE REACH IS IN THIS PLATFORM'S BAR (D87). Marrs: "part of that colour could be mine, part of it
 * could be Shourov's... you could see, even roughly, what percentage of that line was coming from
 * who."
 *
 * Segments keep their stream's identity rather than being sorted by size, because the colour is
 * assigned per person and a segment order that follows magnitude would make the same person appear
 * in a different place in every bar. Order is the STREAMS order, which is the order the palette
 * slots are assigned in, so the two can never disagree.
 */
export function stackByNetwork(slices: StreamSlice[]): Stack[] {
  const nets = new Map<string, Stack>();
  for (const slice of slices) {
    for (const p of slice.posts) {
      let stack = nets.get(p.network);
      if (!stack) {
        stack = { network: p.network, posts: 0, segments: [] };
        nets.set(p.network, stack);
      }
      let seg = stack.segments.find((x) => x.stream === slice.stream);
      if (!seg) {
        seg = { stream: slice.stream, label: slice.label, posts: 0 };
        stack.segments.push(seg);
      }
      seg.posts += 1;
      stack.posts += 1;
      if (p.impressions !== undefined) {
        seg.impressions = (seg.impressions ?? 0) + p.impressions;
        stack.impressions = (stack.impressions ?? 0) + p.impressions;
      }
    }
  }
  return [...nets.values()].sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0));
}
