/**
 * THE LEADERBOARD (D99, step 5 of the plan in analytics-and-scale.md). Marrs's decision screen:
 * "what do we make more of next?"
 *
 * A FRAME is a post type: the kit output a wave made the entry from (contrarian post, numbered
 * rules, hard moment, reel two of three) or, for a piece with no Story, its format. The LADDER is
 * the frames ranked, within one use case, by what they earned.
 *
 * THE RANKING METRIC IS LEADS PER POST WHEN THERE ARE ANY LEADS, AND REACH PER POST UNTIL THEN.
 * The brief's frame ladder was reach; the plan's is completions, because a frame that earns reach
 * and no leads is entertainment. But a ladder with no completions anywhere would rank every frame
 * equal, so until the site has recorded a lead in the window the rungs fall back to median
 * impressions, and the table says which it is using.
 *
 * MEDIAN, NOT MEAN, for reach: one post that travelled makes a mean lie about the frame.
 *
 * n IS PRINTED AND UNDER THREE IS FADED. A frame with two posts behind it is a rumour, not a
 * result. Faded rows stay on the ladder because hiding them would hide what has not been tried.
 *
 * Pure. Labels are supplied by the caller so this file knows nothing about the kit or the formats.
 */

import type { PostMetrics } from './analytics-metrics';
import type { SiteWindow } from './site-analytics';

export type LadderEntry = {
  entry_id: string;
  frame?: string;
  use_case?: string;
  scheduled_at?: string;
  status: 'draft' | 'scheduled' | 'published';
};

export type LadderRow = {
  frame: string;
  label: string;
  /** Posts behind the rung, in the window. */
  n: number;
  /** Lead magnets completed from those posts, summed. Absent when the site reported none for any. */
  completions?: number;
  completions_per_post?: number;
  /** Median impressions over the posts Metricool reported. Absent when none were joined. */
  median_impressions?: number;
  /** Fewer than three posts: shown, but faded. */
  thin: boolean;
};

export type Ladder = {
  rows: LadderRow[];
  /** Which number the rungs are ordered by. */
  ranked_by: 'completions' | 'impressions' | 'posts';
};

export const THIN_UNDER = 3;

export function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Build the ladder for one use case ('none' for entries with none; undefined for every entry).
 *
 * `postsByEntry` is Metricool's row for an entry, from joinPostsToEntries; `win` is the site's
 * window. Both optional in effect: with neither, the ladder is just what was posted, ranked by n.
 */
export function frameLadder(
  entries: LadderEntry[],
  opts: {
    useCase?: string;
    from: string;
    to: string;
    win?: SiteWindow;
    postsByEntry?: Map<string, PostMetrics>;
    label: (frame: string) => string;
  }
): Ladder {
  const groups = new Map<string, LadderEntry[]>();
  for (const e of entries) {
    if (e.status === 'draft' || !e.scheduled_at) continue;
    const day = e.scheduled_at.slice(0, 10);
    if (day < opts.from || day > opts.to) continue;
    if (opts.useCase !== undefined && (e.use_case ?? 'none') !== opts.useCase) continue;
    const frame = e.frame ?? 'unlabelled';
    groups.set(frame, [...(groups.get(frame) ?? []), e]);
  }

  let anyCompletions = false;
  let anyImpressions = false;
  const rows: LadderRow[] = [];
  for (const [frame, list] of groups) {
    let completions: number | undefined;
    const impressions: number[] = [];
    for (const e of list) {
      const c = opts.win?.entries[e.entry_id]?.completions;
      if (c !== undefined) completions = (completions ?? 0) + c;
      const imp = opts.postsByEntry?.get(e.entry_id)?.impressions;
      if (imp !== undefined) impressions.push(imp);
    }
    if (completions !== undefined && completions > 0) anyCompletions = true;
    if (impressions.length) anyImpressions = true;
    const row: LadderRow = {
      frame,
      label: opts.label(frame),
      n: list.length,
      thin: list.length < THIN_UNDER,
    };
    if (completions !== undefined) {
      row.completions = completions;
      row.completions_per_post = Math.round((completions / list.length) * 100) / 100;
    }
    const med = median(impressions);
    if (med !== undefined) row.median_impressions = Math.round(med);
    rows.push(row);
  }

  const ranked_by: Ladder['ranked_by'] = anyCompletions ? 'completions' : anyImpressions ? 'impressions' : 'posts';
  rows.sort((a, b) => {
    if (ranked_by === 'completions') {
      const d = (b.completions_per_post ?? 0) - (a.completions_per_post ?? 0);
      if (d !== 0) return d;
    }
    if (ranked_by !== 'posts') {
      const d = (b.median_impressions ?? -1) - (a.median_impressions ?? -1);
      if (d !== 0) return d;
    }
    return b.n - a.n || a.label.localeCompare(b.label);
  });
  return { rows, ranked_by };
}
