/**
 * THE SITE'S NUMBERS, READ BACK (D98, step 3 of the plan in analytics-and-scale.md).
 *
 * Vercel Web Analytics records every visit to polynize.ai with the utm labels the console put on
 * the link, and every custom event the site fires (email_captured, booking_click...) with the
 * use_case and entry props lib/analytics adds. This file asks Vercel for those numbers grouped
 * by post and by use case, which is the join back to our calendar.
 *
 * THE THREE KEYS Marrs put into the console's Vercel environment on 5 September, marked
 * sensitive: VERCEL_ANALYTICS_TOKEN (an access token scoped to the team), VERCEL_ANALYTICS_
 * PROJECT_ID (the polynize.ai project, prj_...), VERCEL_TEAM_ID (team_...). Nothing read them
 * before this file. They never reach the browser: this is server-only.
 *
 * THE API, from vercel.com/docs/analytics/web-analytics-api (read 5 September 2026):
 *   GET https://api.vercel.com/v1/query/web-analytics/visits/aggregate
 *   GET https://api.vercel.com/v1/query/web-analytics/events/aggregate
 *   params: projectId, teamId, since, until (YYYY-MM-DD), by (one dimension), filter (OData),
 *   limit. Rows come back as { <dimension>: value, pageviews, visitors } for visits and
 *   { eventData: value, count, visitors } for events grouped by eventData/<prop>.
 *   UTM dimensions need Web Analytics Plus, which is on.
 *
 * IT NEVER THROWS. Like the Metricool pull, a refused token or a network error is a status the
 * panel can print, not an exception that empties the dashboard.
 */

const BASE = 'https://api.vercel.com/v1/query/web-analytics';

export function isVercelAnalyticsConfigured(): boolean {
  return Boolean(
    process.env.VERCEL_ANALYTICS_TOKEN?.trim() && process.env.VERCEL_ANALYTICS_PROJECT_ID?.trim()
  );
}

export type VaCall = {
  status: number | null;
  json: unknown;
  /** Set on a network failure, when there is no status to report. */
  error?: string;
};

export async function vaGet(
  path: 'visits/aggregate' | 'visits/count' | 'events/aggregate' | 'events/count',
  params: Record<string, string>
): Promise<VaCall> {
  const token = process.env.VERCEL_ANALYTICS_TOKEN?.trim() ?? '';
  const projectId = process.env.VERCEL_ANALYTICS_PROJECT_ID?.trim() ?? '';
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  const url = new URL(`${BASE}/${path}`);
  url.searchParams.set('projectId', projectId);
  if (teamId) url.searchParams.set('teamId', teamId);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    const res = await fetch(url.toString(), {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
      cache: 'no-store',
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  } catch (e) {
    return { status: null, json: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Visits grouped by one dimension, e.g. 'utmContent' (the entry id) or 'utmCampaign' (the use case). */
export function visitsBy(dimension: string, since: string, until: string, limit = 1000): Promise<VaCall> {
  return vaGet('visits/aggregate', { since, until, by: dimension, limit: String(limit) });
}

/**
 * One custom event grouped by one of its props, e.g. email_captured by eventData/entry.
 * Quoted event names are safe: the site's event names are a fixed union in lib/analytics.
 */
export function eventsBy(
  eventName: string,
  dimension: string,
  since: string,
  until: string,
  limit = 1000
): Promise<VaCall> {
  return vaGet('events/aggregate', {
    since,
    until,
    by: dimension,
    filter: `eventName eq '${eventName.replace(/'/g, '')}'`,
    limit: String(limit),
  });
}
