/**
 * THE SITE'S NUMBERS, AS A SHAPE (D98). Pure: what a Vercel response becomes, how posts join to
 * entries, and how everything folds up per use case. The store and the pull import this; so do
 * the tests, which is the point of keeping the fetch out of here.
 */

import type { CalendarEntry } from './calendar-store';
import type { PostMetrics } from './analytics-metrics';

/** What the site knows about one post, or one use case. Absent is "not reported", never zero. */
export type SiteNumbers = {
  /** Page views from labelled arrivals. */
  visits?: number;
  /** Distinct visitors from labelled arrivals. */
  visitors?: number;
  /** email_captured events: a lead magnet completed. */
  completions?: number;
  /** booking_click events: a discovery-call link pressed. */
  bookings?: number;
};

export type SiteWindow = {
  since: string;
  until: string;
  /** Keyed by entry id (utm_content / eventData.entry). */
  entries: Record<string, SiteNumbers>;
  /** Keyed by use case id (utm_campaign / eventData.use_case), including 'none'. */
  use_cases: Record<string, SiteNumbers>;
};

export type SiteAnalytics = {
  pulled_at: string;
  /** One window per range the panel offers, so a range switch never needs a network call. */
  windows: Record<string, SiteWindow>;
  error?: string;
  error_kind?: 'unconfigured' | 'refused' | 'failed';
};

/* ------------------------------------------------------------------ reading a response */

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/**
 * Vercel's rows carry the dimension under its own name ('utmContent', 'country') for visits and
 * under 'eventData' for events. Both shapes are accepted, and rows whose dimension is empty or
 * 'Others' (the bucket Vercel makes past the limit) are dropped, because neither is a post.
 */
export function rowsToMap(
  json: unknown,
  metric: 'visits' | 'completions' | 'bookings'
): Record<string, SiteNumbers> {
  const out: Record<string, SiteNumbers> = {};
  const data = json && typeof json === 'object' ? (json as { data?: unknown }).data : undefined;
  if (!Array.isArray(data)) return out;
  for (const row of data) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const keyField = Object.keys(r).find(
      (k) => !['pageviews', 'visitors', 'count', 'timestamp'].includes(k)
    );
    const key = keyField ? r[keyField] : undefined;
    if (typeof key !== 'string' || !key || key === 'Others' || key === '(none)') continue;
    const cur = out[key] ?? {};
    if (metric === 'visits') {
      const pv = num(r.pageviews);
      const vs = num(r.visitors);
      if (pv !== undefined) cur.visits = pv;
      if (vs !== undefined) cur.visitors = vs;
    } else {
      const c = num(r.count);
      if (c !== undefined) cur[metric] = c;
    }
    out[key] = cur;
  }
  return out;
}

/** Fold several maps of the same key space into one, field by field. */
export function mergeNumbers(...maps: Record<string, SiteNumbers>[]): Record<string, SiteNumbers> {
  const out: Record<string, SiteNumbers> = {};
  for (const m of maps) {
    for (const [k, v] of Object.entries(m)) out[k] = { ...(out[k] ?? {}), ...v };
  }
  return out;
}

/* ------------------------------------------------------------------ joining */

/** Metricool's post for one of our entries, matched on the public url the url join stored. */
export function joinPostsToEntries(
  posts: PostMetrics[],
  entries: Pick<CalendarEntry, 'entry_id' | 'public_url'>[]
): Map<string, PostMetrics> {
  const byUrl = new Map<string, PostMetrics>();
  for (const p of posts) if (p.url) byUrl.set(normaliseUrl(p.url), p);
  const out = new Map<string, PostMetrics>();
  for (const e of entries) {
    if (!e.public_url) continue;
    const hit = byUrl.get(normaliseUrl(e.public_url));
    if (hit) out.set(e.entry_id, hit);
  }
  return out;
}

function normaliseUrl(u: string): string {
  return u.trim().replace(/^http:/, 'https:').replace(/\/+$/, '').replace(/\?.*$/, '').toLowerCase();
}

/* ------------------------------------------------------------------ the sentence */

export type UseCaseRow = {
  use_case: string;
  /** Entries published or scheduled in the window. */
  posts: number;
  visits?: number;
  completions?: number;
  bookings?: number;
  /** Posts per completion, the number that turns into "double the posts". Absent under 1 completion. */
  posts_per_completion?: number;
};

/**
 * "X posts a week gets us X discovery calls for this use case." One row per use case that has
 * either posts or numbers in the window. Posts are counted from OUR entries (the site cannot
 * know how many we posted), numbers from the site's window.
 */
export function rowsByUseCase(
  entries: Pick<CalendarEntry, 'use_case' | 'scheduled_at' | 'status'>[],
  window: SiteWindow | undefined,
  from: string,
  to: string
): UseCaseRow[] {
  const posts = new Map<string, number>();
  for (const e of entries) {
    if (!e.scheduled_at) continue;
    const day = e.scheduled_at.slice(0, 10);
    if (day < from || day > to) continue;
    if (e.status === 'draft') continue;
    const k = e.use_case ?? 'none';
    posts.set(k, (posts.get(k) ?? 0) + 1);
  }
  const keys = new Set<string>([...posts.keys(), ...Object.keys(window?.use_cases ?? {})]);
  const rows: UseCaseRow[] = [];
  for (const k of keys) {
    const n = window?.use_cases[k] ?? {};
    const p = posts.get(k) ?? 0;
    const row: UseCaseRow = { use_case: k, posts: p, ...n };
    if (n.completions && n.completions > 0 && p > 0) {
      row.posts_per_completion = Math.round((p / n.completions) * 10) / 10;
    }
    rows.push(row);
  }
  // Most completions first, then most posts, then name, so the table reads as a ladder.
  return rows.sort(
    (a, b) =>
      (b.completions ?? 0) - (a.completions ?? 0) || b.posts - a.posts || a.use_case.localeCompare(b.use_case)
  );
}

/** Totals across a window's use cases, for the tiles. Absent when nothing was reported. */
export function windowTotals(window: SiteWindow | undefined): SiteNumbers {
  const out: SiteNumbers = {};
  if (!window) return out;
  for (const n of Object.values(window.use_cases)) {
    for (const k of ['visits', 'visitors', 'completions', 'bookings'] as const) {
      if (n[k] !== undefined) out[k] = (out[k] ?? 0) + n[k]!;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ tolerant read of the store */

export function normalizeSiteAnalytics(raw: unknown): SiteAnalytics | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const pulled = typeof o.pulled_at === 'string' ? o.pulled_at : '';
  if (!pulled) return null;
  const windows: Record<string, SiteWindow> = {};
  const w = o.windows;
  if (w && typeof w === 'object') {
    for (const [k, v] of Object.entries(w as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue;
      const win = v as Record<string, unknown>;
      windows[k] = {
        since: typeof win.since === 'string' ? win.since : '',
        until: typeof win.until === 'string' ? win.until : '',
        entries: numbersMap(win.entries),
        use_cases: numbersMap(win.use_cases),
      };
    }
  }
  return {
    pulled_at: pulled,
    windows,
    error: typeof o.error === 'string' && o.error ? o.error : undefined,
    error_kind:
      o.error_kind === 'unconfigured' || o.error_kind === 'refused' || o.error_kind === 'failed'
        ? o.error_kind
        : undefined,
  };
}

function numbersMap(v: unknown): Record<string, SiteNumbers> {
  const out: Record<string, SiteNumbers> = {};
  if (!v || typeof v !== 'object') return out;
  for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
    if (!n || typeof n !== 'object') continue;
    const r = n as Record<string, unknown>;
    const x: SiteNumbers = {};
    for (const f of ['visits', 'visitors', 'completions', 'bookings'] as const) {
      const val = num(r[f]);
      if (val !== undefined) x[f] = val;
    }
    out[k] = x;
  }
  return out;
}
