/**
 * THE SITE PULL (D98): ask Vercel what the labelled links earned, per post and per use case, for
 * each range the panel offers, and write it down.
 *
 * SIX QUESTIONS PER WINDOW, asked together: visits by post, visits by use case, completions
 * (email_captured) by post and by use case, bookings (booking_click) by post and by use case.
 * Three windows, so eighteen calls, in three rounds. Parallel within a round because the API is
 * Vercel's own and the alternative is a worst case that outlives the route.
 *
 * IT NEVER THROWS, and the three ways it can fail are stored as kinds the panel can say:
 * 'unconfigured' (the keys are not in the environment), 'refused' (401/403: the token is wrong or
 * lacks the team), 'failed' (anything else).
 */

import { RANGES, rangeStart } from './analytics-metrics';
import { isVercelAnalyticsConfigured, visitsBy, eventsBy, type VaCall } from './vercel-analytics';
import { rowsToMap, mergeNumbers, type SiteAnalytics, type SiteWindow } from './site-analytics';
import { saveSiteAnalytics } from './site-analytics-store';

export type SitePullResult = { ok: boolean; windows: number; error?: string };

export async function pullSite(now = new Date()): Promise<SitePullResult> {
  const pulled_at = now.toISOString();
  const until = pulled_at.slice(0, 10);

  if (!isVercelAnalyticsConfigured()) {
    const error =
      "Vercel keys are not in the console's environment yet (VERCEL_ANALYTICS_TOKEN and VERCEL_ANALYTICS_PROJECT_ID).";
    await save({ pulled_at, windows: {}, error, error_kind: 'unconfigured' });
    return { ok: false, windows: 0, error };
  }

  const windows: Record<string, SiteWindow> = {};
  let refused = false;
  let failed: string | undefined;

  for (const r of RANGES) {
    const since = rangeStart(until, r.days);
    const calls = await Promise.all([
      visitsBy('utmContent', since, until),
      visitsBy('utmCampaign', since, until),
      eventsBy('email_captured', 'eventData/entry', since, until),
      eventsBy('email_captured', 'eventData/use_case', since, until),
      eventsBy('booking_click', 'eventData/entry', since, until),
      eventsBy('booking_click', 'eventData/use_case', since, until),
    ]);
    const bad = calls.find((c) => c.status !== 200);
    if (bad) {
      if (bad.status === 401 || bad.status === 403) refused = true;
      else failed = describe(bad);
      // One window failing does not throw away the others: a 7-day answer is still an answer.
      continue;
    }
    const [vEntry, vUse, cEntry, cUse, bEntry, bUse] = calls;
    windows[r.id] = {
      since,
      until,
      entries: mergeNumbers(
        rowsToMap(vEntry.json, 'visits'),
        rowsToMap(cEntry.json, 'completions'),
        rowsToMap(bEntry.json, 'bookings')
      ),
      use_cases: mergeNumbers(
        rowsToMap(vUse.json, 'visits'),
        rowsToMap(cUse.json, 'completions'),
        rowsToMap(bUse.json, 'bookings')
      ),
    };
  }

  const out: SiteAnalytics = { pulled_at, windows };
  if (refused) {
    out.error =
      'Vercel refused the analytics call. The token may be wrong, expired, or not scoped to the team that owns polynize.ai.';
    out.error_kind = 'refused';
  } else if (failed && Object.keys(windows).length === 0) {
    out.error = failed;
    out.error_kind = 'failed';
  }
  await save(out);
  return { ok: Object.keys(windows).length > 0, windows: Object.keys(windows).length, error: out.error };
}

function describe(c: VaCall): string {
  if (c.error) return `Vercel analytics: network error (${c.error}).`;
  const msg =
    c.json && typeof c.json === 'object' && 'error' in c.json
      ? JSON.stringify((c.json as { error: unknown }).error).slice(0, 200)
      : '';
  return `Vercel analytics returned ${c.status ?? 'no status'}${msg ? `: ${msg}` : '.'}`;
}

async function save(value: SiteAnalytics): Promise<void> {
  try {
    await saveSiteAnalytics(value);
  } catch (err) {
    console.error('[site-analytics.pull] store write failed:', err);
  }
}
