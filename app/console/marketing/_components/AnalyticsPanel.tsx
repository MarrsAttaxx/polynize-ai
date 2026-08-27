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
import {
  mockAnalytics,
  compactNumber,
  signedPct,
  sparklinePoints,
} from '@/lib/marketing/analytics-mock';
import s from './analytics.module.css';

/** Fixed mark specs, from the house chart rules, in one place so no mark re-derives them. */
const SPARK_W = 104;
const SPARK_H = 30;
const MARKER_R = 4; // >= 8px across
const LINE_W = 2;

export function AnalyticsPanel({
  scope,
  title,
  /** More work sits under the engine page than under one stream, so the samples scale with it. */
  scale = 1,
}: {
  scope: string;
  title: string;
  scale?: number;
}) {
  const d = mockAnalytics(scope, scale);
  const maxNet = Math.max(...d.byNetwork.map((n) => n.impressions), 1);

  const tiles = [
    { label: 'Impressions', value: compactNumber(d.impressions), delta: d.impressionsDelta, upIsGood: true, source: 'LinkedIn impressions plus Instagram reach' },
    { label: 'Engagement rate', value: `${d.engagementPct}%`, delta: d.engagementDelta, upIsGood: true, source: 'Metricool engagement' },
    { label: 'Clicks', value: compactNumber(d.clicks), delta: d.clicksDelta, upIsGood: true, source: 'LinkedIn clicks' },
    { label: 'Follows gained', value: compactNumber(d.follows), delta: d.followsDelta, upIsGood: true, source: 'Instagram follows from a post' },
  ];

  return (
    <section className={s.wrap} aria-label={`${title} analytics`}>
      <div className={s.head}>
        <h2 className={s.title}>{title}</h2>
        <span className={s.mockTag}>sample numbers</span>
      </div>
      <p className={s.mockWhy}>
        Nothing here is measured yet. The shapes and the fields are real: every number below maps to
        something Metricool actually returns per post, so this is what the panel will show once the
        connection is proven. One authenticated call settles whether their post ids match the ones we
        store when we schedule, which is what ties these to our posts.
      </p>

      {/* THE KPI ROW. Four headline numbers, each with where it is heading. */}
      <div className={s.tiles}>
        {tiles.map((t) => {
          const good = t.delta === 0 ? null : t.delta > 0 === t.upIsGood;
          return (
            <div key={t.label} className={s.tile}>
              <span className={s.tileLabel}>{t.label}</span>
              <span className={s.tileValue}>{t.value}</span>
              <span
                className={`${s.tileDelta} ${good === null ? '' : good ? s.up : s.down}`}
                title={`${signedPct(t.delta)} against the previous 12 weeks`}
              >
                {signedPct(t.delta)} <span className={s.tileVs}>vs last 12 weeks</span>
              </span>
              <Sparkline values={d.trend} label={t.label} />
              <span className={s.tileSource}>{t.source}</span>
            </div>
          );
        })}
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
                    style={{ width: `${Math.max(2, (n.impressions / maxNet) * 100)}%` }}
                    title={`${channelLabel(n.network)}: ${n.impressions.toLocaleString('en-AU')} impressions`}
                  />
                </span>
                {/* The value at the tip, which is the one label a bar always earns. */}
                <span className={s.barValue}>{compactNumber(n.impressions)}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Mixed measures across five rows: a table, and the panel's table view. */}
        <div className={s.block}>
          <h3 className={s.blockTitle}>Best posts</h3>
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
              {d.topPosts.map((p) => (
                <tr key={p.title}>
                  <td>
                    <span className={s.postWho}>
                      <PlatformIcon channel={p.network} size={12} title={channelLabel(p.network)} />
                      <span className={s.postTitle}>{p.title}</span>
                    </span>
                  </td>
                  <td className={s.num}>{compactNumber(p.impressions)}</td>
                  <td className={s.num}>{p.engagementPct}%</td>
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
