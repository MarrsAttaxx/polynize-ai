/**
 * WHAT WE MEASURED, KEPT (D86).
 *
 * ONE FILE PER STREAM, holding the latest pull. `pam/analytics/{stream}.json`.
 *
 * WHY OURS AND NOT LIVE ON EVERY RENDER. Three reasons, in order of how much they matter:
 * the panel sits at the bottom of two pages that are opened constantly, and a live call per render
 * would spend the account's rate limit on scrolling; a Metricool outage would take the dashboard
 * down rather than showing yesterday's numbers; and the feed is a WINDOW, so a post that falls out
 * of it stops existing, which means anything we never wrote down is gone for good.
 *
 * WHY THE LATEST ONLY, AND NOT A TIME SERIES. Every tile the panel draws answers "how is this post
 * doing", not "how did this post grow", so a series would be storage nobody reads. When growth-over-
 * time is wanted it should be a SECOND file appended per pull, not a reshape of this one: the panel's
 * read has to stay one object per stream, because five streams on the engine page is five reads and
 * that is already the budget.
 *
 * IT IS A CACHE, NOT A LEDGER, and the code says so out loud: a lost file costs one pull. Nothing
 * here is the only copy of anything, which is what makes the whole thing safe to rewrite wholesale.
 *
 * Same bucket-or-interim dispatch as every other store in this feature. Server-side only.
 */

import { getSheetState, saveSheetState } from '@/lib/content/shoot-sheet-store';
import { isBucketConfigured, getObjectText, putObjectText } from '@/lib/agents/bucket';
import { normalizeFeed, type PostMetrics } from './analytics-metrics';

export type StreamAnalytics = {
  stream: string;
  /** The Metricool brand the numbers came from, so a remapped stream is visibly stale. */
  blogId: string;
  /** ISO instant of the pull. */
  pulled_at: string;
  /** The window asked for, as 'YYYY-MM-DD'. */
  from: string;
  to: string;
  posts: PostMetrics[];
  /** Set when the pull failed, so the panel can say why rather than looking empty. */
  error?: string;
  /**
   * WHY IT FAILED, as a value rather than as prose (D89).
   *
   * The engine page walks five streams and two of them are simply not connected yet, which is a
   * configuration state and not a fault. Printing each one's full sentence gave that screen two
   * long paragraphs saying one thing. A kind lets the page group them into a line, without matching
   * on the wording of a message.
   */
  error_kind?: 'unmapped' | 'refused' | 'failed';
};

function keyFor(stream: string): string {
  return `pam/analytics/${stream}.json`;
}

export async function getStreamAnalytics(stream: string): Promise<StreamAnalytics | null> {
  const key = keyFor(stream);
  try {
    if (isBucketConfigured()) {
      const text = await getObjectText(key);
      return text ? normalize(JSON.parse(text), stream) : null;
    }
    const row = await getSheetState(key);
    return row ? normalize(row, stream) : null;
  } catch (err) {
    /**
     * A READ FAILURE IS NOT AN EMPTY DASHBOARD, it is an unknown one, and the caller renders those
     * differently: empty says "nothing pulled yet, press the button", and that would be a lie here.
     */
    console.error(`[analytics.store] read failed for ${stream}:`, err);
    return null;
  }
}

export async function saveStreamAnalytics(value: StreamAnalytics): Promise<void> {
  const key = keyFor(value.stream);
  if (isBucketConfigured()) {
    await putObjectText(key, JSON.stringify(value, null, 2));
    return;
  }
  await saveSheetState(key, value as unknown as Record<string, unknown>);
}

/**
 * Tolerant, like every other normalize in this codebase: a file written by an older shape should
 * degrade to fewer posts rather than take the dashboard down. `normalizeFeed` is reused rather than
 * hand-rolling a second reader, so a stored post and a fresh one can never disagree about shape.
 */
function normalize(raw: unknown, stream: string): StreamAnalytics | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const s = (v: unknown, fallback = '') => (typeof v === 'string' && v.trim() ? v.trim() : fallback);
  const pulled = s(o.pulled_at);
  if (!pulled) return null;
  return {
    stream: s(o.stream, stream),
    blogId: s(o.blogId),
    pulled_at: pulled,
    from: s(o.from),
    to: s(o.to),
    posts: normalizeFeed(o.posts),
    error: s(o.error) || undefined,
    error_kind:
      o.error_kind === 'unmapped' || o.error_kind === 'refused' || o.error_kind === 'failed'
        ? o.error_kind
        : undefined,
  };
}
