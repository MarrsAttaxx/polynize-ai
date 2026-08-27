/**
 * THE ANALYTICS SPIKE, AS ONE CLICK (D69).
 *
 * Marrs: "How do we make the analytics numbers real?"
 *
 * The answer is a chain, and it has a gate at the front that no amount of code gets past: four
 * things have to be true before a single real number can appear on that panel, and every one of
 * them is a question about HIS account rather than about our code. Todo item 8 has carried them for
 * weeks as "one authenticated call".
 *
 * This is that call, or rather six of them, read-only, in one page:
 *
 * 1. IS THE ACCOUNT ON A TIER WITH API ANALYTICS? Documented as Advanced or Custom only. A 403
 *    here and the analytics panel is a permanent mock, whatever we build.
 * 2. DOES THE JOIN WORK? Everything rests on the id Metricool returns when we publish, which we
 *    already store as `external_ref`, being the same id its analytics call takes as `postId`. Both
 *    are documented; NOWHERE does the spec say they are the same thing. If they differ, the
 *    fallbacks are matching on public url or on timestamp plus text prefix, and both are fragile.
 *    This one assumption decides whether analytics closes the loop or is a vanity dashboard.
 * 3. DO TIKTOK AND THREADS RETURN JSON OR CSV? Their paths document a 200 with no schema and a
 *    summary that says "Download a CSV", while typed JSON schemas for them sit in the spec
 *    referenced by no path at all.
 * 4. DOES LINKEDIN ENUMERATE EVERYTHING? Their own limitations page hedges. It matters here more
 *    than most places, because his personal LinkedIn is hand-posted by design (D41) and therefore
 *    published outside Metricool entirely.
 *
 * WHY A PROBE RATHER THAN JUST BUILDING IT. Building the client, the snapshot store and the nightly
 * pull is maybe a day. Building all of it and then discovering the join does not work would mean
 * throwing away the part that matters, because the join is what makes a number belong to a piece.
 * Ten minutes of reading beats a day of guessing.
 *
 * EVERY CALL IS A GET AND NOTHING IS WRITTEN, here or downstream. The probe reports what came back
 * and stores none of it.
 */

import { mcProbeGet, type McProbe } from './metricool-client';

/** Their brand-level default is Europe/Madrid on every endpoint, so it is always passed. */
export type ProbeInput = {
  blogId: string;
  timezone: string;
  /** Wall-clock day bounds, 'YYYY-MM-DD'. */
  start: string;
  end: string;
};

export type JoinReport = {
  /** Ids we hold from publishing, which is what `external_ref` is. */
  ours: string[];
  /** Ids the analytics feed came back with. */
  theirs: string[];
  matched: string[];
  verdict:
    | 'no ids of ours to compare'
    | 'analytics returned no ids'
    | 'they match, the loop closes'
    | 'no overlap, a fallback join is needed';
};

/**
 * Do our published ids appear in their analytics feed?
 *
 * Compared as trimmed strings, because one side of a documented-but-untested pairing may well be a
 * number and the other a string, and reporting "no overlap" over a type difference would send the
 * whole build down the fallback path for nothing.
 */
export function joinReport(ours: string[], theirs: string[]): JoinReport {
  const o = [...new Set(ours.map((x) => String(x).trim()).filter(Boolean))];
  const t = [...new Set(theirs.map((x) => String(x).trim()).filter(Boolean))];
  const matched = o.filter((x) => t.includes(x));
  const verdict: JoinReport['verdict'] =
    o.length === 0
      ? 'no ids of ours to compare'
      : t.length === 0
        ? 'analytics returned no ids'
        : matched.length > 0
          ? 'they match, the loop closes'
          : 'no overlap, a fallback join is needed';
  return { ours: o, theirs: t, matched, verdict };
}

/**
 * Pull every id-looking value out of whatever shape came back.
 *
 * Deliberately shape-agnostic. The point of a probe is that we do NOT yet know whether the feed is
 * `{ data: [...] }`, `{ posts: [...] }` or a bare array, so guessing one and finding nothing would
 * be indistinguishable from the endpoint being empty. This walks the whole tree and collects any
 * `id` or `postId`, at any depth.
 */
export function harvestIds(value: unknown, depth = 0): string[] {
  if (depth > 6 || value == null) return [];
  if (Array.isArray(value)) return value.flatMap((v) => harvestIds(v, depth + 1));
  if (typeof value !== 'object') return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if ((k === 'id' || k === 'postId' || k === 'post_id') && (typeof v === 'string' || typeof v === 'number')) {
      out.push(String(v));
    } else {
      out.push(...harvestIds(v, depth + 1));
    }
  }
  return out;
}

/** What a probe run reports, per endpoint, plus the one conclusion that matters. */
export type ProbeRun = {
  calls: McProbe[];
  join: JoinReport;
  /** Plain-language read of the tier gate, which is question one. */
  tier: 'looks available' | 'refused: the account tier may not include API analytics' | 'inconclusive';
};

/**
 * The six reads. Ordered so the cheapest question is answered first and the join, which is the
 * expensive one to be wrong about, is answered with real ids from the same window.
 */
export async function runProbe(input: ProbeInput, ourIds: string[]): Promise<ProbeRun> {
  const p = { start: input.start, end: input.end, timezone: input.timezone };
  const blogId = input.blogId;

  const calls = await Promise.all([
    // The cross-network per-post feed: one call, and the most likely source for the real panel.
    mcProbeGet('/v2/analytics/brand-summary/posts', { blogId, params: p }),
    mcProbeGet('/v2/analytics/posts/linkedin', { blogId, params: p }),
    mcProbeGet('/v2/analytics/posts/instagram', { blogId, params: p }),
    // Documented as maybe-CSV. The content type in the response is the whole answer.
    mcProbeGet('/v2/analytics/posts/tiktok', { blogId, params: p }),
    // The account-level engine behind every sparkline and KPI tile.
    mcProbeGet('/v2/analytics/timelines', { blogId, params: p }),
    // Already used by the Connect page, included so a tier refusal can be told apart from a
    // token problem: this one working while the others 403 IS the tier answer.
    mcProbeGet('/admin/simpleProfiles'),
  ]);

  const analyticsCalls = calls.slice(0, 5);
  const anyOk = analyticsCalls.some((c) => c.status === 200);
  const anyRefused = analyticsCalls.some((c) => c.status === 401 || c.status === 403);
  const tier: ProbeRun['tier'] = anyOk
    ? 'looks available'
    : anyRefused
      ? 'refused: the account tier may not include API analytics'
      : 'inconclusive';

  const theirIds = analyticsCalls.flatMap((c) => harvestIds(c.json));
  return { calls, join: joinReport(ourIds, theirIds), tier };
}
