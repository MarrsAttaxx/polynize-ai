/**
 * THE SITE'S NUMBERS (D98): reading Vercel's rows, joining posts to entries, and the sentence per
 * use case. Run with `npm run test:marketing`.
 */

import assert from 'node:assert/strict';
import {
  rowsToMap,
  mergeNumbers,
  joinPostsToEntries,
  rowsByUseCase,
  windowTotals,
  normalizeSiteAnalytics,
  type SiteWindow,
} from '../site-analytics';
import { publicUrlFor } from '../url-join';

let n = 0;
const ok = (c: unknown, msg: string) => {
  n += 1;
  assert.ok(c, msg);
};
const eq = <T>(a: T, b: T, msg: string) => {
  n += 1;
  assert.deepEqual(a, b, msg);
};

/* ------------------------------------------------------------------ Vercel rows */

const visits = {
  version: 1,
  data: [
    { utmContent: 'e1', pageviews: 40, visitors: 31 },
    { utmContent: 'e2', pageviews: 5, visitors: 5 },
    { utmContent: 'Others', pageviews: 99, visitors: 90 },
    { utmContent: '', pageviews: 3, visitors: 3 },
  ],
};
eq(
  rowsToMap(visits, 'visits'),
  { e1: { visits: 40, visitors: 31 }, e2: { visits: 5, visitors: 5 } },
  'visits rows read by their dimension name; Others and empty keys are dropped'
);
const events = { data: [{ eventData: 'e1', count: 3, visitors: 3 }, { eventData: 'e9', count: 1, visitors: 1 }] };
eq(
  rowsToMap(events, 'completions'),
  { e1: { completions: 3 }, e9: { completions: 1 } },
  'event rows read from eventData, count becomes the named metric'
);
eq(rowsToMap(null, 'visits'), {}, 'no body, no rows');
eq(rowsToMap({ data: 'nope' }, 'visits'), {}, 'a non-array data is no rows');
eq(
  mergeNumbers(rowsToMap(visits, 'visits'), rowsToMap(events, 'completions'), { e2: { bookings: 1 } }),
  { e1: { visits: 40, visitors: 31, completions: 3 }, e2: { visits: 5, visitors: 5, bookings: 1 }, e9: { completions: 1 } },
  'merge folds field by field across the same keys'
);

/* ------------------------------------------------------------------ the join */

const posts = [
  { id: 'urn:li:1', network: 'linkedin', text: 'a', url: 'https://www.linkedin.com/feed/update/urn:li:1/', impressions: 100 },
  { id: 'ig:2', network: 'instagram', text: 'b', url: 'http://instagram.com/p/ABC?igsh=xyz', impressions: 50 },
  { id: 'no-url', network: 'tiktok', text: 'c' },
];
const joined = joinPostsToEntries(posts, [
  { entry_id: 'e1', public_url: 'https://www.linkedin.com/feed/update/urn:li:1' },
  { entry_id: 'e2', public_url: 'https://instagram.com/p/ABC' },
  { entry_id: 'e3', public_url: undefined },
  { entry_id: 'e4', public_url: 'https://example.com/none' },
]);
eq(joined.get('e1')?.impressions, 100, 'trailing slash does not break the join');
eq(joined.get('e2')?.impressions, 50, 'http vs https and a query string do not break the join');
ok(!joined.has('e3') && !joined.has('e4'), 'no url or an unmatched url is simply not joined');

/* the scheduler read */
const scheduled = {
  data: [
    {
      id: 367684553,
      providers: [
        { network: 'twitter', publicUrl: 'https://x.com/p/1' },
        { network: 'linkedin', publicUrl: 'https://www.linkedin.com/feed/update/urn:li:9' },
      ],
    },
    { id: 1, providers: [{ network: 'instagram' }] },
  ],
};
eq(
  publicUrlFor({ external_ref: '367684553', channel: 'linkedin' }, scheduled),
  'https://www.linkedin.com/feed/update/urn:li:9',
  'the url for the entry\'s own network, matched on Metricool\'s integer id as a string'
);
eq(publicUrlFor({ external_ref: '367684553', channel: 'x' }, scheduled), 'https://x.com/p/1', 'x maps to twitter');
eq(
  publicUrlFor({ external_ref: '367684553', channel: 'tiktok' }, scheduled),
  'https://x.com/p/1',
  'no provider for the network falls back to the first url the post has'
);
eq(publicUrlFor({ external_ref: '1', channel: 'instagram' }, scheduled), undefined, 'a provider with no url yet is not published');
eq(publicUrlFor({ external_ref: '2', channel: 'instagram' }, scheduled), undefined, 'an unknown id is undefined');
eq(publicUrlFor({ external_ref: '367684553', channel: 'linkedin' }, scheduled.data), 'https://www.linkedin.com/feed/update/urn:li:9', 'a bare array is accepted too');

/* ------------------------------------------------------------------ the sentence */

const win: SiteWindow = {
  since: '2026-08-07',
  until: '2026-09-05',
  entries: {},
  use_cases: {
    hiring_manager: { visits: 120, completions: 6, bookings: 2 },
    sales_lead: { visits: 10 },
    none: { visits: 4, completions: 1 },
  },
};
const entries = [
  { use_case: 'hiring_manager', scheduled_at: '2026-08-20T09:00:00', status: 'published' as const },
  { use_case: 'hiring_manager', scheduled_at: '2026-08-22T09:00:00', status: 'scheduled' as const },
  { use_case: 'hiring_manager', scheduled_at: '2026-08-25T09:00:00', status: 'published' as const },
  { use_case: 'hiring_manager', scheduled_at: '2026-07-01T09:00:00', status: 'published' as const },
  { use_case: 'hiring_manager', scheduled_at: '2026-08-26T09:00:00', status: 'draft' as const },
  { use_case: 'ld_lead', scheduled_at: '2026-08-28T09:00:00', status: 'published' as const },
  { use_case: undefined, scheduled_at: '2026-08-29T09:00:00', status: 'published' as const },
  { use_case: 'sales_lead', scheduled_at: undefined, status: 'published' as const },
];
const rows = rowsByUseCase(entries, win, '2026-08-07', '2026-09-05');
eq(
  rows.map((r) => r.use_case),
  ['hiring_manager', 'none', 'ld_lead', 'sales_lead'],
  'ordered by completions, then posts, then name'
);
const hm = rows[0];
eq(hm.posts, 3, 'posts counted from our entries in the window, drafts and out-of-window excluded');
eq(hm.completions, 6, 'completions from the site');
eq(hm.posts_per_completion, 0.5, 'three posts for six completions is half a post per completion');
eq(rows.find((r) => r.use_case === 'ld_lead')?.posts, 1, 'a use case with posts but no site numbers still appears');
eq(rows.find((r) => r.use_case === 'ld_lead')?.completions, undefined, 'and its completions are absent, not zero');
eq(rows.find((r) => r.use_case === 'sales_lead')?.posts, 0, 'an undated entry is not a post in any window');
eq(rows.find((r) => r.use_case === 'sales_lead')?.posts_per_completion, undefined, 'no completions, no ratio');
eq(rowsByUseCase([], undefined, '2026-08-07', '2026-09-05'), [], 'nothing in, nothing out');
eq(windowTotals(win), { visits: 134, completions: 7, bookings: 2 }, 'totals across use cases, absent fields stay absent');
eq(windowTotals(undefined), {}, 'no window, no totals');

/* ------------------------------------------------------------------ the store round trip */

const stored = normalizeSiteAnalytics({
  pulled_at: '2026-09-05T17:10:00Z',
  windows: { '30': win, junk: 'x' },
  error_kind: 'bogus',
});
eq(Object.keys(stored?.windows ?? {}), ['30'], 'a malformed window is dropped, the good one kept');
eq(stored?.windows['30'].use_cases.hiring_manager, { visits: 120, completions: 6, bookings: 2 }, 'numbers survive the round trip');
eq(stored?.error_kind, undefined, 'an unknown error kind is dropped');
eq(normalizeSiteAnalytics({ windows: {} }), null, 'no pulled_at means nothing was pulled');

console.log(`site-analytics: ${n} assertions passed`);
