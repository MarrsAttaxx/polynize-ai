/**
 * THE ANALYTICS PANEL (D66, real since D86, interactive since D87). At the bottom of the engine page
 * and at the bottom of every stream.
 *
 * Marrs: "on the main engine page, where it shows everyone, so it's an aggregation of all those
 * stats. And when you go into each of the streams, each one of those streams has an analytics
 * section also. I think it's always going to be the thing at the bottom, because you don't want to
 * look at that first."
 *
 * THIS FILE IS THE SHELL: the reads its pages hand it, the empty and failed states, and the pull
 * button. Everything that responds to a pointer lives in AnalyticsView, which owns the range, the
 * chart and the hover. The split is the point: an empty or failed pull renders entirely on the
 * server with no client bundle at all, which is the common case on a stream nobody has pulled.
 *
 * THE FORM WAS PICKED BEFORE THE COLOUR, which is the part that usually goes backwards:
 *
 * - Four headline numbers are a KPI ROW of stat tiles. Not a grouped bar chart, which is what four
 *   numbers usually get turned into.
 * - Change over time is a LINE, full width, bucketed by day or by week to suit the range.
 * - Comparing platforms is HORIZONTAL BARS, stacked by stream: magnitude against identity.
 * - Five posts with mixed measures is a TABLE. It is also the panel's table view, so no number here
 *   is reachable only by hovering, and it is one of the relief channels the light-mode contrast
 *   result requires.
 *
 * NETWORKS ARE NEVER TOLD APART BY COLOUR. They carry their own PlatformIcon and their name. Colour
 * is spent on one axis only, which is WHO earned the reach (D87), and only inside this panel.
 */

import type { StreamSlice } from '@/lib/marketing/analytics-metrics';
import { getSiteAnalytics } from '@/lib/marketing/site-analytics-store';
import { listAllEntries } from '@/lib/marketing/calendar-store';
import { PullButton } from './PullButton';
import { AnalyticsView, type EntryLite } from './AnalyticsView';
import s from './analytics.module.css';

/**
 * REAL NUMBERS SINCE D86. What changed, beyond the data source:
 *
 * THE DELTA TILES ARE GONE. Every tile used to carry "+12% vs last 12 weeks", which the mock could
 * always produce and the real feed cannot: one pull is one window, and comparing it to a previous
 * window needs history this store does not keep by design. A delta is the single easiest number to
 * fake convincingly, so it is absent rather than approximated.
 *
 * A MISSING NUMBER SAYS SO. `undefined` reaches the tile and prints as "no data yet". It is never
 * rendered as 0, because **0 impressions is a claim** and a different one from "the platform did not
 * tell us". That distinction is the reason `summarise` keeps sums optional all the way through.
 */
/**
 * REAL NUMBERS SINCE D86, INTERACTIVE SINCE D87. This is now the shell: it owns the auth-free reads
 * the pages hand it, the empty states, and the pull button. Everything that responds to a pointer
 * lives in AnalyticsView, which is where the range, the chart and the hover are.
 *
 * THE SPLIT IS THE POINT. An empty or failed pull is rendered by the server with no client bundle at
 * all, which is the common case on a stream nobody has pulled yet.
 */
export async function AnalyticsPanel({
  scope,
  title,
  slices,
  today,
  pulledAt,
  error,
}: {
  scope: string;
  title: string;
  /** One entry per stream in scope. Empty means nothing has been pulled. */
  slices: StreamSlice[];
  /** 'YYYY-MM-DD' from the server, so the client's ranges are deterministic (see AnalyticsView). */
  today: string;
  pulledAt?: string;
  /** What went wrong on the last pull, said rather than shown as an empty panel. */
  error?: string;
}) {
  const anyPosts = slices.some((sl) => sl.posts.length > 0);

  /**
   * THE SITE'S SIDE (D98): what the labelled links earned, and our own entries so the numbers can
   * be put against posts and use cases. Read here, once, because this is the server half; the view
   * only filters. Both reads are tolerant: a failure is an absent block, never a broken panel.
   */
  const site = await getSiteAnalytics();
  let entries: EntryLite[] = [];
  try {
    const all = await listAllEntries();
    entries = all
      .filter((e) => scope === 'engine' || e.stream === scope)
      .map((e) => ({
        entry_id: e.entry_id,
        channel: e.channel,
        title: e.title,
        use_case: e.use_case,
        scheduled_at: e.scheduled_at,
        status: e.status,
        public_url: e.public_url,
      }));
  } catch (err) {
    console.error('[analytics.panel] entries read failed:', err);
  }
  const siteHasNumbers = Boolean(site && Object.keys(site.windows).length > 0);

  if (!anyPosts && !siteHasNumbers) {
    return (
      <section className={s.wrap} aria-label={`${title} analytics`}>
        <div className={s.head}>
          <h2 className={s.title}>{title}</h2>
          <PullButton scope={scope} />
        </div>
        <p className={s.mockWhy}>
          {error
            ? error
            : pulledAt
              ? 'The last pull came back with no posts in the window. Either nothing has been published on this brand in the last 90 days, or the platform has not reported it yet.'
              : 'No numbers pulled yet. Press Pull now and this fills with what Metricool holds for the last 90 days, including posts published by hand.'}
        </p>
        {site?.error ? <p className={s.mockWhy}>polynize.ai: {site.error}</p> : null}
      </section>
    );
  }

  return (
    <section className={s.wrap} aria-label={`${title} analytics`}>
      <div className={s.head}>
        <h2 className={s.title}>{title}</h2>
        {pulledAt ? (
          <span className={s.freshTag}>pulled {pulledAt.slice(0, 10)}</span>
        ) : null}
        <PullButton scope={scope} />
      </div>
      {error ? <p className={s.mockWhy}>{error}</p> : null}
      {/* Said, not hidden: the site's half can fail on its own (keys, token) while Metricool's half works. */}
      {site?.error ? <p className={s.mockWhy}>polynize.ai: {site.error}</p> : null}
      <AnalyticsView slices={slices} today={today} site={site} entries={entries} />
    </section>
  );
}
