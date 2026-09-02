/**
 * THE PULL (D86): ask Metricool for a brand's posts and write them down.
 *
 * ONE ENDPOINT, `/v2/analytics/brand-summary/posts`, which returns every post on the brand across
 * every network with its text, url, date, type and a normalised metric block. Proven against his
 * account on 2 September 2026: 31 posts over 90 days on the Marrs brand, including ones he posted by
 * hand, which is the part that makes it worth having (D41 made his personal LinkedIn manual, and
 * this feed enumerates it anyway).
 *
 * IT NEVER THROWS. A stream whose brand is unmapped, whose token is refused, or whose call times out
 * is recorded as a stored error rather than an exception, because the pull runs over five streams
 * and one bad brand must not cost the other four. The panel then says what happened instead of
 * looking like a stream that has not posted.
 *
 * Server-side only.
 */

import { mcProbeGet } from './metricool-client';
import { getBrandMap } from './metricool-config-store';
import { laneTimezone } from './channel-schedule';
import { normalizeFeed, rangeStart } from './analytics-metrics';
import { saveStreamAnalytics, type StreamAnalytics } from './analytics-store';

/** The default window. Ninety days is long enough to hold a quarter's work and short enough to return. */
export const PULL_DAYS = 90;

export function pullWindow(days = PULL_DAYS, now = new Date()): { from: string; to: string } {
  const to = now.toISOString().slice(0, 10);
  /**
   * THE SAME FUNCTION THE PANEL'S RANGES USE (D89), so the widest range on screen and the window we
   * actually stored are the same day. They were one day apart: the pull counted back 90 days and the
   * range counted back 89, which put a post on the boundary in the store and outside every view of
   * it. One derivation, one answer.
   */
  return { from: rangeStart(to, days), to };
}

export type PullResult = {
  stream: string;
  ok: boolean;
  posts: number;
  error?: string;
};

export async function pullStream(stream: string, days = PULL_DAYS): Promise<PullResult> {
  const { from, to } = pullWindow(days);
  const base: StreamAnalytics = {
    stream,
    blogId: '',
    pulled_at: new Date().toISOString(),
    from,
    to,
    posts: [],
  };

  let blogId = '';
  try {
    blogId = (await getBrandMap())[stream] ?? '';
  } catch (err) {
    console.error('[analytics.pull] brand map read failed:', err);
  }
  if (!blogId) {
    const error = 'Not mapped to a Metricool brand yet.';
    await save({ ...base, error, error_kind: 'unmapped' });
    return { stream, ok: false, posts: 0, error };
  }

  /**
   * `mcProbeGet`, not `mcFetch`, on purpose: it reports the status instead of throwing, and here the
   * status IS the answer. A 403 means the plan does not include API analytics and a 500 means their
   * side, and both are things the panel should be able to say.
   *
   * FULL ISO DATETIMES, and the parameter names are `from`/`to` for the analytics family. Both of
   * those have cost a round trip before now (D78, D83), so the rule lives in
   * docs/pam-console/metricool-api.md.
   */
  const call = await mcProbeGet('/v2/analytics/brand-summary/posts', {
    blogId,
    params: {
      from: `${from}T00:00:00`,
      to: `${to}T23:59:59`,
      timezone: laneTimezone(stream),
    },
  });

  if (call.status !== 200) {
    const refused = call.status === 401 || call.status === 403;
    const error = refused
      ? 'Metricool refused the analytics call. API analytics needs an Advanced or Custom plan.'
      : `Metricool returned ${call.error ? 'a network error' : (call.status ?? 'no status')} for this brand.`;
    await save({ ...base, blogId, error, error_kind: refused ? 'refused' : 'failed' });
    return { stream, ok: false, posts: 0, error };
  }

  const posts = normalizeFeed(call.json);
  await save({ ...base, blogId, posts });
  return { stream, ok: true, posts: posts.length };
}

async function save(value: StreamAnalytics): Promise<void> {
  try {
    await saveStreamAnalytics(value);
  } catch (err) {
    // A pull we cannot store is a pull that did not happen, and it is worth one line in the log.
    console.error(`[analytics.pull] store write failed for ${value.stream}:`, err);
  }
}
