/**
 * Metricool REST client — the console's "hands" for publishing (D18 update / D24).
 *
 * The console reaches Metricool over its REST API (NOT the MCP): headless-safe on
 * Vercel, and we control the payload so `providers` are objects, not strings (the
 * bug D18 flagged). Server-side only. Reference: docs/pam-console/metricool-api.md.
 *
 * Mirrors the resend-client pattern: reads creds from env lazily and reports a
 * skip when unconfigured, so importing/calling it never throws just because the
 * keys are not set yet (it is dormant until METRICOOL_USER_TOKEN + _USER_ID land).
 */

const BASE_URL = 'https://app.metricool.com/api';

function creds(): { token: string; userId: string } | null {
  const token = process.env.METRICOOL_USER_TOKEN;
  const userId = process.env.METRICOOL_USER_ID;
  if (!token || !userId) return null;
  return { token, userId };
}

/** True once the token + user id are set (Metricool publishing can run). */
export function isMetricoolConfigured(): boolean {
  return creds() !== null;
}

async function mcFetch(
  path: string,
  opts: { method: string; blogId?: string; body?: unknown }
): Promise<unknown> {
  const c = creds();
  if (!c) throw new Error('Metricool is not configured (METRICOOL_USER_TOKEN / METRICOOL_USER_ID)');
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set('userId', c.userId);
  if (opts.blogId) url.searchParams.set('blogId', opts.blogId);

  const res = await fetch(url.toString(), {
    method: opts.method,
    headers: {
      'X-Mc-Auth': c.token,
      'Content-Type': 'application/json',
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Metricool ${opts.method} ${path} failed: ${res.status} ${detail.slice(0, 300)}`);
  }
  return res.json().catch(() => ({}));
}

/**
 * WHERE TO SEND SOMEONE LOOKING FOR A POST (D77).
 *
 * `/planning`, which the console used, is not a path Metricool serves: it redirects to
 * `/public/error/404`. The working one is `/planner/calendar`, and it takes the brand and the
 * account as query params, so the link opens the calendar for the RIGHT brand rather than whichever
 * one the session last had open. With five streams mapped to five brands that is the difference
 * between a useful link and a confusing one.
 *
 * The userId comes from the same env the API calls use. Without it the path still works and simply
 * lands on the default brand, so a missing env degrades rather than breaks.
 */
export function metricoolCalendarUrl(blogId?: string): string {
  const base = 'https://app.metricool.com/planner/calendar';
  const params = new URLSearchParams();
  if (blogId) params.set('blogId', blogId);
  const userId = process.env.METRICOOL_USER_ID;
  if (userId) params.set('userId', userId);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export type MetricoolBrand = { blogId: string; label: string; raw: unknown };

/**
 * List the account's Metricool brands. Field names in the response are not firmly
 * documented, so parse defensively (blogId/id, label/title/name) and confirm on
 * the first real call. Each brand carries the `blogId` a post is scheduled under.
 */
export async function listBrands(): Promise<MetricoolBrand[]> {
  const data = await mcFetch('/admin/simpleProfiles', { method: 'GET' });
  const arr: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray((data as { data?: unknown[] })?.data)
      ? (data as { data: unknown[] }).data
      : [];
  return arr
    .map((raw) => {
      const b = raw as Record<string, unknown>;
      const blogId = String(b.blogId ?? b.id ?? b.blog_id ?? '');
      const label = String(b.label ?? b.title ?? b.name ?? b.brand ?? (blogId || 'Brand'));
      return { blogId, label, raw };
    })
    .filter((b) => b.blogId);
}

export type SchedulePostInput = {
  blogId: string;
  text: string;
  /** Metricool network names, e.g. ['linkedin','instagram'] (see metricoolNetwork). */
  networks: string[];
  /** Local wall-clock 'YYYY-MM-DDTHH:mm:ss' (no Z), paired with timezone. */
  dateTime: string;
  /** IANA timezone, e.g. 'Australia/Sydney'. */
  timezone: string;
  media?: string[];
  /** true = park unpublished; false (default) = autoPublish at dateTime. */
  draft?: boolean;
  firstCommentText?: string;
  /**
   * THE TITLE A YOUTUBE POST CANNOT GO OUT WITHOUT (D80).
   *
   * YouTube is the one network here whose post has a field the caption cannot stand in for, and this
   * client sent it nowhere: `text` became the description and the video published untitled. The kit
   * has promised a Short "its own 100-character title" since D49 and nothing could deliver it.
   *
   * Read off their OpenAPI spec on 1 September 2026 rather than assumed: `ScheduledPost` carries
   * `youtubeData` with `title`, alongside `tiktokData`, `linkedinData` and `instagramData`. Only the
   * title is sent, because it is the only one of those fields whose absence produces a wrong post
   * rather than a default one.
   *
   * Capped at 100 characters, which is YouTube's own limit: sending more is a rejected post.
   */
  youtubeTitle?: string;
};

/** YouTube's own cap. A title over it is rejected rather than truncated by them. */
export const YOUTUBE_TITLE_MAX = 100;

/**
 * A title for a YouTube post, from whatever the entry can offer.
 *
 * Pure and exported so the cap is asserted in tests rather than trusted. An empty result means send
 * no `youtubeData` at all, which is the old behaviour and better than sending an empty title.
 */
export function youtubeTitleFrom(title: string | undefined, fallback: string): string {
  const pick = (title ?? '').trim() || fallback.trim().split(/\r?\n/)[0].trim();
  return pick.slice(0, YOUTUBE_TITLE_MAX).trim();
}

/** Schedule (or draft) one post to one brand across the given networks. */
export async function schedulePost(
  input: SchedulePostInput
): Promise<{ id?: string; raw: unknown }> {
  const draft = input.draft ?? false;
  const body: Record<string, unknown> = {
    text: input.text,
    providers: input.networks.map((network) => ({ network })),
    publicationDate: { dateTime: input.dateTime, timezone: input.timezone },
    draft,
    autoPublish: !draft,
    media: input.media ?? [],
  };
  if (input.firstCommentText) body.firstCommentText = input.firstCommentText;
  // Only when it is actually a YouTube post and there is something to call it.
  if (input.youtubeTitle && input.networks.includes('youtube')) {
    body.youtubeData = { title: input.youtubeTitle };
  }

  const data = await mcFetch('/v2/scheduler/posts', {
    method: 'POST',
    blogId: input.blogId,
    body,
  });
  const d = data as { id?: unknown; data?: { id?: unknown } };
  const id = d?.id ?? d?.data?.id;
  return { id: id != null ? String(id) : undefined, raw: data };
}

/** Remove a scheduled post from a brand. */
export async function deleteScheduledPost(blogId: string, id: string): Promise<void> {
  await mcFetch(`/v2/scheduler/posts/${id}`, { method: 'DELETE', blogId });
}

/**
 * Metricool's best-time-to-publish suggestions for a brand, per network.
 *
 * THE PATH WAS WRONG (D49). This called `/planner/best-time-to-publish`, which does not exist:
 * grepping Metricool's own OpenAPI spec (app.metricool.com/api/swagger.json, 527 paths) for
 * "planner" returns nothing. The documented path is per PROVIDER, which also means there is no
 * single call for a whole brand: the slot table has to be assembled network by network.
 *
 * Nothing calls this yet, which is the only reason it has never 404'd. It is on the Step 0 spike
 * list as the source for the real posting times, so it would have failed the moment that ran.
 *
 * Timezone is passed explicitly because every Metricool endpoint defaults to Europe/Madrid,
 * which is the same trap D24 caught on the publish side.
 */
export async function bestTimes(
  blogId: string,
  provider: 'facebook' | 'instagram' | 'tiktok' | 'linkedin' | 'youtube',
  opts?: { start?: string; end?: string; timezone?: string }
): Promise<unknown> {
  const q = new URLSearchParams();
  if (opts?.start) q.set('start', opts.start);
  if (opts?.end) q.set('end', opts.end);
  q.set('timezone', opts?.timezone ?? 'Australia/Sydney');
  return mcFetch(`/v2/scheduler/besttimes/${provider}?${q.toString()}`, {
    method: 'GET',
    blogId,
  });
}

/**
 * A READ-ONLY PROBE THAT REPORTS INSTEAD OF THROWING (D69).
 *
 * `mcFetch` throws on a non-200, which is right for publishing: a failed schedule must stop. It is
 * exactly wrong for finding out what an endpoint does, where the status IS the answer. A 403 means
 * the account tier does not include API analytics, a 404 means the path moved, and a 200 carrying
 * `text/csv` means the documented JSON schema is not what comes back. All three are findings, and
 * a thrown error turns all three into "something broke".
 *
 * GET only, and it never writes. This is the tool that answers the four open questions in
 * docs/pam-console/todo.md item 8 without putting anything at risk.
 */
export type McProbe = {
  path: string;
  url: string;
  status: number | null;
  contentType: string | null;
  /** Parsed when the body was JSON. */
  json?: unknown;
  /** The first part of the raw body, always, so a CSV or an HTML error page is visible as itself. */
  bodyHead: string;
  error?: string;
};

export async function mcProbeGet(
  path: string,
  opts: { blogId?: string; params?: Record<string, string> } = {}
): Promise<McProbe> {
  const c = creds();
  const shown = `${BASE_URL}${path}`;
  if (!c) {
    return { path, url: shown, status: null, contentType: null, bodyHead: '', error: 'Metricool is not configured.' };
  }
  const url = new URL(shown);
  url.searchParams.set('userId', c.userId);
  if (opts.blogId) url.searchParams.set('blogId', opts.blogId);
  for (const [k, v] of Object.entries(opts.params ?? {})) url.searchParams.set(k, v);

  // The token is in a header, so the url is safe to show back on screen for diagnosis.
  const safeUrl = url.toString();

  try {
    const res = await fetch(safeUrl, {
      method: 'GET',
      headers: { 'X-Mc-Auth': c.token, Accept: 'application/json' },
    });
    const contentType = res.headers.get('content-type');
    const text = await res.text().catch(() => '');
    let json: unknown;
    if (text && /json/i.test(contentType ?? '')) {
      try {
        json = JSON.parse(text);
      } catch {
        // Left undefined: bodyHead still carries what actually arrived.
      }
    }
    return {
      path,
      url: safeUrl,
      status: res.status,
      contentType,
      json,
      bodyHead: text.slice(0, 1200),
    };
  } catch (e) {
    return {
      path,
      url: safeUrl,
      status: null,
      contentType: null,
      bodyHead: '',
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
