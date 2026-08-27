/**
 * SAMPLE NUMBERS FOR THE ANALYTICS PANEL (D66).
 *
 * Marrs: "I'd at least like a mock-up there at the moment, and we're talking about as much data as
 * we can and making it as visual as possible."
 *
 * EVERY FIELD HERE IS ONE METRICOOL ACTUALLY RETURNS. That is the whole discipline of a mock: it is
 * a promise about what the real panel will show, so inventing a metric their API cannot give us
 * would be designing a screen we then have to take away. The four headline tiles and the two table
 * columns map to documented per-post fields:
 *
 * - LinkedIn: impressions, uniqueImpressions, clicks, engagement, reaction breakdown
 * - Instagram: reach, saved, and follows gained FROM that post
 * - Reels: averageWatchTime, reelsSkipRate
 *
 * What is NOT settled is whether `ProviderStatus.id`, which this console stores as
 * `external_ref` when it schedules, is the same id the analytics endpoints take as `postId`. They
 * are documented separately and nowhere stated to be the same. That single question decides
 * whether any of this can be tied back to OUR posts, and it is one authenticated call to answer
 * (todo item 8). Until it is answered the panel says the numbers are samples.
 *
 * DETERMINISTIC, seeded off the scope name. Not Math.random: this renders on the server, and a
 * random number there would not match the one the browser computes, which is a hydration mismatch
 * rather than a cosmetic difference. Seeded also means the Marrs panel looks the same on every
 * reload, so a screenshot of it stays true.
 */

export type MockNetwork = { network: string; impressions: number };

export type MockPost = {
  title: string;
  network: string;
  impressions: number;
  engagementPct: number;
};

export type MockAnalytics = {
  /** 12 points, one per week, oldest first. The stat tile's sparkline. */
  trend: number[];
  impressions: number;
  impressionsDelta: number;
  engagementPct: number;
  engagementDelta: number;
  clicks: number;
  clicksDelta: number;
  follows: number;
  followsDelta: number;
  byNetwork: MockNetwork[];
  topPosts: MockPost[];
};

/** A tiny deterministic PRNG (mulberry32) seeded from the scope, so nothing here is random. */
function seeded(scope: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < scope.length; i += 1) {
    h ^= scope.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NETWORKS = ['linkedin', 'instagram', 'tiktok', 'youtube'];

const HEADLINES = [
  'Everyone is bolting AI on to a process that was already broken',
  'The future nobody can see',
  'Strip the process back before you automate it',
  'What holding the line actually cost us',
  'Five rules for a team of one and four agents',
];

export function mockAnalytics(scope: string, scale = 1): MockAnalytics {
  const rnd = seeded(scope);
  const pick = (lo: number, hi: number) => Math.round((lo + rnd() * (hi - lo)) * scale);

  /**
   * A trend that WANDERS rather than climbing. A mock that only goes up teaches the wrong thing
   * about what this panel is for, which is noticing when something stopped working.
   */
  let level = pick(1800, 3200);
  const trend: number[] = [];
  for (let i = 0; i < 12; i += 1) {
    level = Math.max(400, Math.round(level * (0.88 + rnd() * 0.3)));
    trend.push(level);
  }

  const impressions = trend.reduce((a, b) => a + b, 0);

  /**
   * THE SPLIT ADDS UP TO THE HEADLINE, and it has to.
   *
   * The first version generated the per-network numbers independently, so the tile said 95.3K and
   * the four bars beside it summed to 63K. Nobody would trust a panel that cannot add up, and the
   * point of a mock is to be trusted about SHAPE, so an internal contradiction is not a cosmetic
   * problem here: it is the mock failing at its only job.
   *
   * Split by weight rather than by equal shares, so the bars have something to compare, and the
   * remainder goes to the last one so rounding cannot lose or invent an impression.
   */
  const weights = NETWORKS.map(() => 0.5 + rnd());
  const weightTotal = weights.reduce((a, b) => a + b, 0);
  let assigned = 0;
  const byNetwork = NETWORKS.map((network, i) => {
    const isLast = i === NETWORKS.length - 1;
    const share = isLast
      ? impressions - assigned
      : Math.round((weights[i] / weightTotal) * impressions);
    assigned += share;
    return { network, impressions: Math.max(0, share) };
  }).sort((a, b) => b.impressions - a.impressions);

  /**
   * The five best posts are a SUBSET of the total, so they are drawn as a fraction of it rather
   * than from an unrelated range. Same reason as the split above: five posts adding to more than
   * the period's impressions is the kind of detail that makes a reader stop believing the layout.
   */
  const topPosts: MockPost[] = HEADLINES.slice(0, 5)
    .map((title, i) => ({
      title,
      network: NETWORKS[i % NETWORKS.length],
      impressions: Math.max(1, Math.round(impressions * (0.03 + rnd() * 0.09))),
      engagementPct: Number((1.2 + rnd() * 3.4).toFixed(2)),
    }))
    .sort((a, b) => b.impressions - a.impressions);

  return {
    trend,
    impressions,
    impressionsDelta: Number((rnd() * 44 - 14).toFixed(1)),
    engagementPct: Number((1.6 + rnd() * 2.6).toFixed(2)),
    engagementDelta: Number((rnd() * 30 - 12).toFixed(1)),
    clicks: pick(40, 620),
    clicksDelta: Number((rnd() * 50 - 18).toFixed(1)),
    follows: pick(3, 140),
    followsDelta: Number((rnd() * 60 - 20).toFixed(1)),
    byNetwork,
    topPosts,
  };
}

/**
 * 1,284 / 12.9K / 4.2M, the stat tile's auto-compact contract.
 *
 * Thousands-separated under 10,000 and compacted above it, because "9,840" is still readable at a
 * glance and "1,284,004" is not.
 */
export function compactNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (abs >= 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toLocaleString('en-AU');
}

/** A signed delta with its sign always shown, so a flat period reads as flat rather than as blank. */
export function signedPct(n: number): string {
  const r = Number(n.toFixed(1));
  if (r === 0) return 'no change';
  return `${r > 0 ? '+' : ''}${r}%`;
}

/**
 * The polyline for a sparkline, plus where its last segment starts.
 *
 * The last segment and the end dot carry the accent while the rest of the line is de-emphasised,
 * which is the stat tile's own contract: the eye should land on where it is NOW.
 *
 * Returned as numbers rather than a path string so the caller decides the stroke, the ring and the
 * marker radius, all of which are fixed specs it should not have to re-derive.
 */
export function sparklinePoints(
  values: number[],
  w: number,
  h: number,
  pad = 3
): { pts: { x: number; y: number }[] } {
  if (values.length === 0) return { pts: [] };
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const usableW = w - pad * 2;
  const usableH = h - pad * 2;
  const pts = values.map((v, i) => ({
    x: pad + (values.length === 1 ? usableW / 2 : (i / (values.length - 1)) * usableW),
    // SVG y grows downward, so the biggest value sits at the smallest y.
    y: pad + usableH - ((v - lo) / span) * usableH,
  }));
  return { pts };
}
