/**
 * THE ANALYTICS PANEL (D66). At the bottom of the engine page and at the bottom of every stream.
 *
 * Marrs: "on the main engine page, where it shows everyone, so it's an aggregation of all those
 * stats. And when you go into each of the streams, each one of those streams has an analytics
 * section also. I think it's always going to be the thing at the bottom, because you don't want to
 * look at that first... I'd at least like a mock-up there at the moment, and we're talking about as
 * much data as we can and making it as visual as possible."
 *
 * SAMPLE NUMBERS, SAID LOUDLY AND ONCE. A mock that does not announce itself is a screen someone
 * makes a decision on. The banner says it, and then the panel gets on with being the real layout.
 *
 * THE FORM IS PICKED BEFORE THE COLOUR, which is the part that usually goes backwards:
 *
 * - Four headline numbers are a KPI ROW of stat tiles, each with a 12 point sparkline. Not a
 *   grouped bar chart, which is what four numbers usually get turned into.
 * - Comparing four networks is HORIZONTAL BARS: magnitude against identity.
 * - Five posts with mixed measures is a TABLE. It is also the panel's table view, so nothing here
 *   is gated behind reading a chart.
 *
 * ONE HUE, AND IDENTITY COMES FROM THE LOGOS. Every mark is mint. The networks are told apart by
 * their own PlatformIcon and their name, never by colour, which is stronger than a colour key and
 * it also protects the brand's actual colour grammar: coral is human, amber is hybrid and mint is
 * agent, so spending those four on LinkedIn, Instagram, TikTok and YouTube would quietly remap the
 * one semantic the brand has.
 *
 * A server component: there is nothing to interact with beyond a native hover title, and the panel
 * should not cost a client bundle at the bottom of two pages.
 */

import { PlatformIcon } from './PlatformIcon';
import { channelLabel } from '@/lib/marketing/channels';
import { compactNumber, sparklinePoints } from '@/lib/marketing/analytics-format';
import type { Summary } from '@/lib/marketing/analytics-metrics';
import { PullButton } from './PullButton';
import s from './analytics.module.css';

/** Fixed mark specs, from the house chart rules, in one place so no mark re-derives them. */
const SPARK_W = 104;
const SPARK_H = 30;
const MARKER_R = 4; // >= 8px across
const LINE_W = 2;

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
export function AnalyticsPanel({
  scope,
  title,
  data,
  pulledAt,
  error,
}: {
  scope: string;
  title: string;
  /** Absent means nothing has been pulled for this scope yet. */
  data?: Summary;
  pulledAt?: string;
  /** What went wrong on the last pull, said rather than shown as an empty panel. */
  error?: string;
}) {
  const d = data;
  const maxNet = Math.max(...(d?.byNetwork ?? []).map((n) => n.impressions ?? 0), 1);

  const tiles: { label: string; value?: string; source: string }[] = [
    {
      label: 'Impressions',
      value: d?.impressions === undefined ? undefined : compactNumber(d.impressions),
      source: 'Metricool, per post, summed across the window',
    },
    {
      label: 'Interactions',
      value: d?.interactions === undefined ? undefined : compactNumber(d.interactions),
      source: 'Likes, comments and shares as the platform counts them',
    },
    {
      label: 'Engagement rate',
      value: d?.engagement === undefined ? undefined : `${d.engagement.toFixed(1)}%`,
      source: "The average of each post's own rate, as the platform computes it",
    },
    {
      label: 'Posts',
      value: d ? String(d.posts) : undefined,
      source: 'Everything the brand published in the window, hand-posted included',
    },
  ];

  /** Nothing pulled, or a pull that failed: say which, and offer the button either way. */
  if (!d || d.posts === 0) {
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
      </section>
    );
  }

  return (
    <section className={s.wrap} aria-label={`${title} analytics`}>
      <div className={s.head}>
        <h2 className={s.title}>{title}</h2>
        <span className={s.freshTag}>
          {d.first && d.last ? `${d.first.slice(0, 10)} to ${d.last.slice(0, 10)}` : 'last 90 days'}
        </span>
        <PullButton scope={scope} />
      </div>
      {error ? <p className={s.mockWhy}>{error}</p> : null}

      {/* THE KPI ROW. Four headline numbers, and the sparkline only where it means something. */}
      <div className={s.tiles}>
        {tiles.map((t) => (
          <div key={t.label} className={s.tile}>
            <span className={s.tileLabel}>{t.label}</span>
            <span className={t.value === undefined ? s.tileNone : s.tileValue}>
              {t.value ?? 'no data yet'}
            </span>
            {/* IMPRESSIONS ONLY. The line is a weekly sum of impressions, so drawing it under
                Interactions or a rate would be the same picture labelled as three different
                things, which is worse than no picture. */}
            {t.label === 'Impressions' && d.trend.length ? (
              <Sparkline values={d.trend} label={t.label} />
            ) : null}
            <span className={s.tileSource}>{t.source}</span>
          </div>
        ))}
      </div>

      <div className={s.cols}>
        {/* MAGNITUDE AGAINST IDENTITY: bars, with the logo carrying which is which. */}
        <div className={s.block}>
          <h3 className={s.blockTitle}>Impressions by platform</h3>
          <ul className={s.bars}>
            {d.byNetwork.map((n) => (
              <li key={n.network} className={s.barRow}>
                <span className={s.barWho}>
                  <PlatformIcon channel={n.network} size={14} title={channelLabel(n.network)} />
                  <span className={s.barName}>{channelLabel(n.network)}</span>
                </span>
                <span className={s.barTrack}>
                  <span
                    className={s.barFill}
                    style={{ width: `${Math.max(2, ((n.impressions ?? 0) / maxNet) * 100)}%` }}
                    title={`${channelLabel(n.network)}: ${
                      n.impressions === undefined
                        ? 'no impressions reported'
                        : `${n.impressions.toLocaleString('en-AU')} impressions`
                    }, ${n.posts} post${n.posts === 1 ? '' : 's'}`}
                  />
                </span>
                {/* The value at the tip, which is the one label a bar always earns. A network that
                    reported nothing still gets its row and its post count: it published, and that
                    is a different fact from having no reach. */}
                <span className={s.barValue}>
                  {n.impressions === undefined ? `${n.posts} posts` : compactNumber(n.impressions)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Mixed measures across five rows: a table, and the panel's table view. */}
        <div className={s.block}>
          <h3 className={s.blockTitle}>Latest posts</h3>
          {/* Scrolls in its OWN container rather than pushing the page sideways. Three columns of
              numbers set in mono have a minimum width, and dropping the third on a phone would
              drop data instead of just the view of it. */}
          <div className={s.tableScroll}>
          <table className={s.table}>
            <thead>
              <tr>
                <th scope="col">Post</th>
                <th scope="col" className={s.num}>
                  Impressions
                </th>
                <th scope="col" className={s.num}>
                  Engaged
                </th>
              </tr>
            </thead>
            <tbody>
              {d.top.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span className={s.postWho}>
                      <PlatformIcon channel={p.network} size={12} title={channelLabel(p.network)} />
                      {p.url ? (
                        <a
                          className={s.postTitle}
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          title={p.text}
                        >
                          {firstLine(p.text)}
                        </a>
                      ) : (
                        <span className={s.postTitle} title={p.text}>
                          {firstLine(p.text)}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className={s.num}>
                    {p.impressions === undefined ? '—' : compactNumber(p.impressions)}
                  </td>
                  <td className={s.num}>
                    {p.engagement === undefined ? '—' : `${p.engagement.toFixed(1)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The first line of a post, which is what makes a row recognisable at a glance. Falls back to a
 * dash rather than an empty cell, because a post with no text is a real thing (a bare image) and an
 * empty cell reads as a rendering fault.
 */
function firstLine(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim()) ?? '';
  return line.trim().slice(0, 90) || '(no caption)';
}

/**
 * A 12 point sparkline: a de-emphasised line, the CURRENT segment and its end dot in the accent.
 *
 * That split is the stat tile's contract and it is the whole reason a sparkline beats a number: the
 * eye should land on where the line is now, not on its middle. The end dot carries a 2px ring in the
 * surface colour so it stays legible where it sits on the line.
 */
function Sparkline({ values, label }: { values: number[]; label: string }) {
  const { pts } = sparklinePoints(values, SPARK_W, SPARK_H);
  if (pts.length < 2) return null;
  const path = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  const first = pts[0];
  // The area is a wash under the line, never a saturated block.
  const area = `${first.x},${SPARK_H} ${path} ${last.x},${SPARK_H}`;

  return (
    <svg
      className={s.spark}
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      role="img"
      aria-label={`${label}, twelve weeks`}
    >
      <polygon points={area} className={s.sparkArea} />
      <polyline
        points={path}
        className={s.sparkLine}
        strokeWidth={LINE_W}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polyline
        points={`${prev.x.toFixed(1)},${prev.y.toFixed(1)} ${last.x.toFixed(1)},${last.y.toFixed(1)}`}
        className={s.sparkNow}
        strokeWidth={LINE_W}
        strokeLinecap="round"
      />
      <circle cx={last.x} cy={last.y} r={MARKER_R} className={s.sparkDot} />
    </svg>
  );
}
