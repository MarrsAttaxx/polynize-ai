'use client';

/**
 * THE INTERACTIVE ANALYTICS (D87). Range presets, a real chart over time, and the platform bars
 * split by who earned them.
 *
 * Three asks from Marrs, in his words:
 *   "I like the visual that you had on the test data, which showed a graph over time... Is it
 *    possible for us to do that for the 90 days?"
 *   "Is it possible for us to have a button that says the last week, the last month, and the last
 *    90 days, so you can choose between those?"
 *   "Is there a way of showing what is Shourov, what is Marrs... part of that colour could be mine,
 *    part of it could be Shourov's... you could see, even roughly, what percentage of that line was
 *    coming from who."
 *
 * WHY THIS IS A CLIENT COMPONENT WHEN THE PANEL DELIBERATELY WAS NOT. The original panel's comment
 * says it should not cost a client bundle at the bottom of two pages, and that was right when there
 * was nothing to interact with. There is now: a range switcher, a crosshair and a hover on every
 * segment. The alternative, a range in the url, would navigate the whole page to filter a panel at
 * the bottom of it.
 *
 * ONE PULL SERVES EVERY RANGE. The store holds ninety days, so switching range filters what is
 * already here: instant, free, and it cannot fail halfway.
 *
 * `today` COMES FROM THE SERVER, not from `new Date()`. A client component renders on the server
 * first, and a clock read during that render disagrees with the browser's, which is a hydration
 * mismatch rather than a cosmetic difference. Every range is derived from the prop.
 */

import { useMemo, useState } from 'react';
import { PlatformIcon } from './PlatformIcon';
import { channelLabel } from '@/lib/marketing/channels';
import { STREAM_AVATARS } from '@/lib/marketing/streams';
import { compactNumber } from '@/lib/marketing/analytics-format';
import {
  RANGES,
  rangeStart,
  postsSince,
  bucketSeries,
  stackByNetwork,
  summarise,
  type PostMetrics,
  type RangeId,
  type StreamSlice,
} from '@/lib/marketing/analytics-metrics';
import { streamColorVar } from '@/lib/marketing/stream-colors';
import {
  joinPostsToEntries,
  rowsByUseCase,
  windowTotals,
  type SiteAnalytics,
} from '@/lib/marketing/site-analytics';
import { labelForUseCase } from '@/lib/marketing/use-case';
import { frameLadder } from '@/lib/marketing/frame-ladder';
import { outputById } from '@/lib/marketing/kit';
import { formatById } from '@/lib/marketing/output-plan';
import s from './analytics.module.css';

/** A frame's name for the ladder: the kit's post label, else the format's label, else the id. */
function frameLabel(frame: string): string {
  if (frame === 'unlabelled') return 'Unlabelled (older posts)';
  return outputById(frame)?.postLabel ?? formatById(frame)?.label ?? frame;
}

/** The slice of a calendar entry the panel needs: enough to count posts and join numbers to them. */
export type EntryLite = {
  entry_id: string;
  channel: string;
  title: string;
  use_case?: string;
  frame?: string;
  scheduled_at?: string;
  status: 'draft' | 'scheduled' | 'published';
  public_url?: string;
};

/** Chart geometry, fixed so no mark re-derives it. */
const W = 760;
const H = 190;
const PAD = { top: 14, right: 10, bottom: 26, left: 46 };

export function AnalyticsView({
  slices,
  today,
  site = null,
  entries = [],
}: {
  /** One entry per stream in scope. One on a stream page, five on the engine page. */
  slices: StreamSlice[];
  /** 'YYYY-MM-DD', from the server. See the note at the top about the clock. */
  today: string;
  /** What the labelled links earned on polynize.ai (D98), or null when never pulled. */
  site?: SiteAnalytics | null;
  /** Our calendar entries in scope, for posts-per-use-case and the join to Metricool's rows. */
  entries?: EntryLite[];
}) {
  const [range, setRange] = useState<RangeId>('90');
  const [hoverBucket, setHoverBucket] = useState<number | null>(null);
  const [hoverSeg, setHoverSeg] = useState<string | null>(null);
  /** Which use case the leaderboard shows. '' means every post together. */
  const [ladderUseCase, setLadderUseCase] = useState<string>('');

  const days = RANGES.find((r) => r.id === range)!.days;
  const from = rangeStart(today, days);

  const view = useMemo(() => {
    const scoped = slices.map((sl) => ({ ...sl, posts: postsSince(sl.posts, from) }));
    const all = scoped.flatMap((sl) => sl.posts);
    return {
      scoped,
      sum: summarise(all),
      /**
       * BY DAY UP TO A MONTH, BY WEEK BEYOND IT. Ninety daily points across this width is a comb;
       * four weekly points across a fortnight hides the shape. The bucket follows the range.
       */
      series: bucketSeries(all, from, today, days > 31 ? 'week' : 'day'),
      stacks: stackByNetwork(scoped),
    };
  }, [slices, from, today, days]);

  const { sum, series, stacks, scoped } = view;

  /**
   * THE SITE'S SIDE OF THE RANGE (D98). The pull stored one window per range, so this is a lookup,
   * never a call. `siteWin` is undefined when the range was not pulled, and every number below
   * then prints as absent rather than zero: the site not having told us is not the site saying
   * nothing happened.
   */
  const siteWin = site?.windows[range];
  const siteTotals = windowTotals(siteWin);
  const rows = rowsByUseCase(entries, siteWin, from, today);
  /**
   * WHICH ENTRY EACH METRICOOL ROW IS, by public url, so the latest-posts table can show the
   * clicks and leads the site recorded for that exact post. A post with no joined entry has no
   * site numbers to show and says so with a blank, not a zero.
   */
  const postsByEntry = useMemo(
    () => joinPostsToEntries(slices.flatMap((sl) => sl.posts), entries),
    [slices, entries]
  );
  const entryByPostId = useMemo(() => {
    const out = new Map<string, string>();
    for (const [entryId, post] of postsByEntry) out.set(post.id, entryId);
    return out;
  }, [postsByEntry]);

  /**
   * THE LEADERBOARD (D99): post types ranked, within the chosen use case, by leads per post when
   * the site has recorded any, by median reach until then. Only use cases that have posts in the
   * range are offered, so the buttons never lead to an empty table.
   */
  const ladderChoices = useMemo(() => {
    const seen = new Set<string>();
    for (const e of entries) {
      if (e.status === 'draft' || !e.scheduled_at) continue;
      const day = e.scheduled_at.slice(0, 10);
      if (day < from || day > today) continue;
      seen.add(e.use_case ?? 'none');
    }
    return [...seen].sort();
  }, [entries, from, today]);
  const ladder = useMemo(
    () =>
      frameLadder(entries, {
        useCase: ladderUseCase || undefined,
        from,
        to: today,
        win: siteWin,
        postsByEntry,
        label: frameLabel,
      }),
    [entries, ladderUseCase, from, today, siteWin, postsByEntry]
  );
  /**
   * ONLY THE STREAMS THAT ACTUALLY CONTRIBUTED (D89). A legend naming a colour that appears in no
   * bar is a legend making a claim the chart does not support: on the engine page two of five
   * streams are not connected yet, and listing them with a swatch reads as "they posted nothing"
   * rather than "they are not wired up".
   */
  const contributors = scoped.filter((sl) => sl.posts.length > 0);
  const showLegend = contributors.length > 1;
  const maxStack = Math.max(...stacks.map((x) => x.impressions ?? 0), 1);

  const tiles: { label: string; value?: string; source: string }[] = [
    {
      label: 'Impressions',
      value: sum.impressions === undefined ? undefined : compactNumber(sum.impressions),
      source: 'Summed across every post in the range',
    },
    {
      label: 'Interactions',
      value: sum.interactions === undefined ? undefined : compactNumber(sum.interactions),
      source: 'Likes, comments and shares as the platform counts them',
    },
    {
      label: 'Engagement rate',
      value: sum.engagement === undefined ? undefined : `${sum.engagement.toFixed(1)}%`,
      source: "The average of each post's own rate",
    },
    { label: 'Posts', value: String(sum.posts), source: 'Hand-posted content included' },
    /* THE SITE'S THREE (D98). Clicks are page views from labelled links; leads are lead magnets
       completed; bookings are discovery-call links pressed. All from polynize.ai, all by post. */
    {
      label: 'Clicks',
      value: siteTotals.visits === undefined ? undefined : compactNumber(siteTotals.visits),
      source: 'Visits to polynize.ai from labelled links',
    },
    {
      label: 'Leads',
      value: siteTotals.completions === undefined ? undefined : String(siteTotals.completions),
      source: 'Lead magnets completed by those visitors',
    },
    {
      label: 'Bookings',
      value: siteTotals.bookings === undefined ? undefined : String(siteTotals.bookings),
      source: 'Discovery-call links pressed by those visitors',
    },
  ];

  return (
    <>
      {/* FILTERS IN ONE ROW ABOVE EVERYTHING, and they scope every number below, so the tiles, the
          chart, the bars and the table can never disagree about which window they describe. */}
      <div className={s.filters} role="group" aria-label="Date range">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`${s.filterBtn} ${range === r.id ? s.filterOn : ''}`}
            aria-pressed={range === r.id}
            onClick={() => setRange(r.id)}
          >
            {r.label}
          </button>
        ))}
        <span className={s.filterNote}>
          {from} to {today}
        </span>
      </div>

      {sum.posts === 0 && rows.length === 0 ? (
        <p className={s.mockWhy}>
          Nothing published in this range. The last 90 days is the widest the stored pull covers.
        </p>
      ) : (
        <>
          <div className={s.tiles}>
            {tiles.map((t) => (
              <div key={t.label} className={s.tile}>
                <span className={s.tileLabel}>{t.label}</span>
                <span className={t.value === undefined ? s.tileNone : s.tileValue}>
                  {t.value ?? 'no data yet'}
                </span>
                <span className={s.tileSource}>{t.source}</span>
              </div>
            ))}
          </div>

          <TimeChart
            series={series}
            by={days > 31 ? 'week' : 'day'}
            hover={hoverBucket}
            onHover={setHoverBucket}
          />

          {/* THE SENTENCE (D98). Marrs: "X amount of posts a week gets us X amount of discovery
              calls for this particular use case." One row per use case: our posts in the range,
              the site's clicks, leads and bookings for it, and posts per lead, which is the number
              that turns into "double the posts". */}
          {rows.length > 0 ? (
            <div className={s.block}>
              <h3 className={s.blockTitle}>By use case</h3>
              <div className={s.tableScroll}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th scope="col">Use case</th>
                      <th scope="col" className={s.num}>Posts</th>
                      <th scope="col" className={s.num}>Clicks</th>
                      <th scope="col" className={s.num}>Leads</th>
                      <th scope="col" className={s.num}>Bookings</th>
                      <th scope="col" className={s.num} title="How many posts it took for one lead magnet completion">
                        Posts per lead
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.use_case} className={r.posts === 0 ? s.rowMuted : undefined}>
                        <td>{r.use_case === 'none' ? 'No use case' : labelForUseCase(r.use_case)}</td>
                        <td className={s.num}>{r.posts}</td>
                        <td className={s.num}>{r.visits === undefined ? '' : compactNumber(r.visits)}</td>
                        <td className={s.num}>{r.completions === undefined ? '' : r.completions}</td>
                        <td className={s.num}>{r.bookings === undefined ? '' : r.bookings}</td>
                        <td className={s.num}>{r.posts_per_completion === undefined ? '' : r.posts_per_completion}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={s.tableNote}>
                Posts are counted from the calendar. Clicks, leads and bookings are what polynize.ai
                recorded from those posts&apos; links. A blank means the site has not reported it, not zero.
              </p>
            </div>
          ) : null}

          {ladder.rows.length > 0 ? (
            <div className={s.block}>
              <h3 className={s.blockTitle}>What to make more of</h3>
              <div className={s.filters} role="group" aria-label="Leaderboard use case">
                <button
                  type="button"
                  className={`${s.filterBtn} ${ladderUseCase === '' ? s.filterOn : ''}`}
                  aria-pressed={ladderUseCase === ''}
                  onClick={() => setLadderUseCase('')}
                >
                  Every use case
                </button>
                {ladderChoices.map((u) => (
                  <button
                    key={u}
                    type="button"
                    className={`${s.filterBtn} ${ladderUseCase === u ? s.filterOn : ''}`}
                    aria-pressed={ladderUseCase === u}
                    onClick={() => setLadderUseCase(u)}
                  >
                    {u === 'none' ? 'No use case' : labelForUseCase(u)}
                  </button>
                ))}
                <span className={s.filterNote}>
                  {ladder.ranked_by === 'completions'
                    ? 'ranked by leads per post'
                    : ladder.ranked_by === 'impressions'
                      ? 'ranked by median reach, until a lead is recorded'
                      : 'ranked by how many were posted; no numbers reported yet'}
                </span>
              </div>
              <div className={s.tableScroll}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th scope="col">Post type</th>
                      <th scope="col" className={s.num}>Posts</th>
                      <th scope="col" className={s.num}>Leads</th>
                      <th scope="col" className={s.num} title="Lead magnets completed, divided by posts of this type">
                        Leads per post
                      </th>
                      <th scope="col" className={s.num} title="The middle post's impressions, so one runaway post cannot flatter the type">
                        Median reach
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ladder.rows.map((r) => (
                      <tr
                        key={r.frame}
                        className={r.thin ? s.rowMuted : undefined}
                        title={r.thin ? 'Fewer than three posts: a rumour, not a result yet.' : undefined}
                      >
                        <td>{r.label}</td>
                        <td className={s.num}>{r.n}</td>
                        <td className={s.num}>{r.completions === undefined ? '' : r.completions}</td>
                        <td className={s.num}>{r.completions_per_post === undefined ? '' : r.completions_per_post}</td>
                        <td className={s.num}>{r.median_impressions === undefined ? '' : compactNumber(r.median_impressions)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={s.tableNote}>
                Faded rows have fewer than three posts behind them. The top row is the post type to
                make more of for this use case; a blank means nothing was reported, not zero.
              </p>
            </div>
          ) : null}

          <div className={s.cols}>
            <div className={s.block}>
              <h3 className={s.blockTitle}>Impressions by platform</h3>
              {showLegend ? (
                /* IDENTITY IS NEVER COLOUR ALONE: the face and the name carry it, and the swatch
                   agrees with them. */
                <ul className={s.legend}>
                  {contributors.map((sl) => (
                    <li key={sl.stream} className={s.legendItem}>
                      <span
                        className={s.legendSwatch}
                        style={{ background: streamColorVar(sl.stream) }}
                        aria-hidden
                      />
                      {STREAM_AVATARS[sl.stream] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={STREAM_AVATARS[sl.stream]} alt="" className={s.legendFace} />
                      ) : null}
                      <span className={s.legendName}>{sl.label}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <ul className={s.bars}>
                {stacks.map((st) => (
                  <li key={st.network} className={s.barRow}>
                    <span className={s.barWho}>
                      <PlatformIcon channel={st.network} size={14} title={channelLabel(st.network)} />
                      <span className={s.barName}>{channelLabel(st.network)}</span>
                    </span>
                    <span className={s.barTrack}>
                      {st.segments.map((seg) => {
                        const key = `${st.network}:${seg.stream}`;
                        const share = (seg.impressions ?? 0) / maxStack;
                        if (share <= 0) return null;
                        return (
                          <span
                            key={key}
                            className={`${s.barSeg} ${hoverSeg === key ? s.barSegOn : ''}`}
                            style={{
                              width: `${share * 100}%`,
                              background: streamColorVar(seg.stream),
                            }}
                            tabIndex={0}
                            role="img"
                            onPointerEnter={() => setHoverSeg(key)}
                            onPointerLeave={() => setHoverSeg(null)}
                            onFocus={() => setHoverSeg(key)}
                            onBlur={() => setHoverSeg(null)}
                            aria-label={`${seg.label} on ${channelLabel(st.network)}: ${
                              seg.impressions === undefined
                                ? 'no impressions reported'
                                : `${seg.impressions.toLocaleString('en-AU')} impressions`
                            }, ${seg.posts} post${seg.posts === 1 ? '' : 's'}`}
                          >
                            {hoverSeg === key ? (
                              <span className={s.segTip} role="status">
                                <strong className={s.segTipValue}>
                                  {seg.impressions === undefined
                                    ? 'no data'
                                    : compactNumber(seg.impressions)}
                                </strong>
                                <span className={s.segTipWho}>
                                  {seg.label} · {seg.posts} post{seg.posts === 1 ? '' : 's'}
                                </span>
                              </span>
                            ) : null}
                          </span>
                        );
                      })}
                    </span>
                    {/* The total at the tip. Also the relief channel the light-mode contrast WARN
                        requires: every value here is readable without relying on the fill. */}
                    <span className={s.barValue}>
                      {st.impressions === undefined
                        ? `${st.posts} posts`
                        : compactNumber(st.impressions)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className={s.block}>
              <h3 className={s.blockTitle}>Latest posts</h3>
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
                      <th scope="col" className={s.num}>
                        Clicks
                      </th>
                      <th scope="col" className={s.num}>
                        Leads
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sum.top.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <span className={s.postWho}>
                            <PlatformIcon
                              channel={p.network}
                              size={12}
                              title={channelLabel(p.network)}
                            />
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
                        {/* From the site, by the entry this row joined to; blank when not joined or
                            not reported, because a blank is honest and a zero is a claim. */}
                        <td className={s.num}>
                          {(() => {
                            const eid = entryByPostId.get(p.id);
                            const v = eid ? siteWin?.entries[eid]?.visits : undefined;
                            return v === undefined ? '' : compactNumber(v);
                          })()}
                        </td>
                        <td className={s.num}>
                          {(() => {
                            const eid = entryByPostId.get(p.id);
                            const v = eid ? siteWin?.entries[eid]?.completions : undefined;
                            return v === undefined ? '' : v;
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/**
 * IMPRESSIONS OVER TIME. One series, so no legend box: the title names it.
 *
 * A LINE, because the job is change over time and the x is continuous. A 2px stroke with round
 * caps, an end marker carrying a 2px ring in the surface colour so it stays legible where it sits on
 * its own line, and a recessive grid that the data can be read against without competing with it.
 *
 * THE CROSSHAIR FINDS THE X. The reader aims at a date, never at a 2px line: the pointer's position
 * snaps to the nearest bucket and the readout follows. Keyboard gets the same values through the
 * table underneath, which is the panel's non-hover route to every number.
 */
function TimeChart({
  series,
  by,
  hover,
  onHover,
}: {
  series: { label: string; value: number; posts: number }[];
  by: 'day' | 'week';
  hover: number | null;
  onHover: (ix: number | null) => void;
}) {
  if (series.length < 2) return null;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const max = Math.max(...series.map((b) => b.value), 1);
  const x = (i: number) => PAD.left + (series.length === 1 ? plotW / 2 : (i / (series.length - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;

  const line = series.map((b, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(b.value).toFixed(1)}`).join(' ');
  /** The area under it, at low opacity: it carries the magnitude without a second colour. */
  const area = `${line} L${x(series.length - 1).toFixed(1)} ${(PAD.top + plotH).toFixed(1)} L${x(0).toFixed(1)} ${(PAD.top + plotH).toFixed(1)} Z`;

  /** Three gridlines and three labels. More is a table, fewer is a sketch. */
  const ticks = [0, 0.5, 1].map((f) => ({ f, v: Math.round(max * f) }));
  const xLabels = [0, Math.floor((series.length - 1) / 2), series.length - 1];

  const active = hover !== null && hover >= 0 && hover < series.length ? series[hover] : null;

  return (
    <figure className={s.chart}>
      <figcaption className={s.chartTitle}>
        Impressions per {by === 'week' ? 'week' : 'day'}
        {active ? (
          <span className={s.chartRead}>
            <strong className={s.chartReadValue}>{active.value.toLocaleString('en-AU')}</strong>
            <span className={s.chartReadWhen}>
              {active.label}
              {by === 'week' ? ' onward' : ''} · {active.posts} post{active.posts === 1 ? '' : 's'}
            </span>
          </span>
        ) : null}
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={s.chartSvg}
        role="img"
        aria-label={`Impressions per ${by}, ${series.length} points, peak ${max.toLocaleString('en-AU')}`}
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - box.left) / box.width) * W;
          const ratio = (px - PAD.left) / plotW;
          const ix = Math.round(ratio * (series.length - 1));
          onHover(Math.max(0, Math.min(series.length - 1, ix)));
        }}
        onPointerLeave={() => onHover(null)}
      >
        {ticks.map((t) => (
          <g key={t.f}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t.v)}
              y2={y(t.v)}
              className={s.gridLine}
            />
            <text x={PAD.left - 8} y={y(t.v) + 3} className={s.axisText} textAnchor="end">
              {compactNumber(t.v)}
            </text>
          </g>
        ))}

        <path d={area} className={s.chartArea} />
        <path d={line} className={s.chartLine} vectorEffect="non-scaling-stroke" />

        {/* The end of the line is where the eye should land, so it gets the only marker. */}
        <circle
          cx={x(series.length - 1)}
          cy={y(series[series.length - 1].value)}
          r={4}
          className={s.chartDot}
        />

        {active && hover !== null ? (
          <>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              className={s.crosshair}
            />
            <circle cx={x(hover)} cy={y(active.value)} r={4} className={s.chartDot} />
          </>
        ) : null}

        {xLabels.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 8}
            className={s.axisText}
            textAnchor={i === 0 ? 'start' : i === series.length - 1 ? 'end' : 'middle'}
          >
            {series[i].label.slice(5)}
          </text>
        ))}
      </svg>
    </figure>
  );
}

/**
 * The first line of a post, which is what makes a row recognisable at a glance. A post with no text
 * is a real thing (a bare image), so it says so rather than leaving a cell that reads as a fault.
 */
function firstLine(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim()) ?? '';
  return line.trim().slice(0, 90) || '(no caption)';
}

export type { PostMetrics };
