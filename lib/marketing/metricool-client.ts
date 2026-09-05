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
   * THE POST CARRIES A VIDEO (D81).
   *
   * Instagram REJECTS a single-video post unless it is declared a Reel, and it is Metricool's own
   * validator that says so in as many words: "Instagram does not allow single-video posts. Change
   * the Instagram post type to REEL or add more videos or images." Sending no instagramData at all
   * left it as the deprecated VIDEO media type, and Meta refused it.
   *
   * So this is not a preference, it is the only way a video reaches an Instagram feed.
   */
  hasVideo?: boolean;
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
  /**
   * `short` for a vertical file, or absent for a landscape one (D84). See ./youtube-type: the token
   * was read off his own scheduled posts rather than guessed, and the landscape case deliberately
   * sends nothing because its token is not in that data and the default already accepts horizontal.
   */
  youtubeType?: string;
};

/**
 * The YouTube title rules live in their own pure module (D82) so the caption screen can show the
 * operator exactly what will be sent without importing this file, which would drag the publishing
 * layer into the browser bundle. Re-exported so callers here read as they did.
 */
export { youtubeTitleFrom, YOUTUBE_TITLE_MAX } from './youtube-title';

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

  /**
   * A VIDEO ON INSTAGRAM IS A REEL, or it is refused (D81). Their validator, verbatim: "Instagram
   * does not allow single-video posts. Change the Instagram post type to REEL or add more videos or
   * images." Sending nothing left the deprecated VIDEO media type in place.
   */
  if (input.hasVideo && input.networks.includes('instagram')) {
    /**
     * REEL, UPPERCASE, and `showReelOnFeed` alongside it, both copied from his own posts (D84):
     *   "instagramData": { "autoPublish": true, "type": "REEL", "showReelOnFeed": true }
     *
     * The feed flag is what puts the Reel on the profile grid as well as in the Reels tab, which is
     * what his own composer does and what anyone would expect of a post they just published.
     */
    body.instagramData = { type: 'REEL', showReelOnFeed: true, autoPublish: !draft };
  }

  /**
   * TIKTOK NEEDS A PRIVACY OPTION OR IT REFUSES TO PUBLISH (D84 addendum).
   *
   * "Publish Tiktok video error: does not specified privacy options", and their composer showed the
   * field as the literal string `planner.planner.presets.tiktok.privacyStatus.null`: an untranslated
   * i18n key, which is their UI's way of rendering a null.
   *
   * I had this wrong. When their validator listed four errors on a three-network post, TikTok raised
   * none, and I read that as TikTok needing nothing. It needed something their form validation does
   * not check and their publisher does. **A validator's silence is not a guarantee.**
   *
   * PUBLIC_TO_EVERYONE is copied from his own scheduled post, and it is also TikTok's own documented
   * enum value rather than a Metricool invention. Comments, duet and stitch are left alone: their
   * defaults are permissive, which matches what his composer shows, and nothing has complained.
   */
  if (input.hasVideo && input.networks.includes('tiktok')) {
    body.tiktokData = { privacyOption: 'PUBLIC_TO_EVERYONE' };
  }

  if (input.networks.includes('youtube')) {
    /**
     * THREE FIELDS, none of them guessed (D81, completed D84).
     *
     * `title`, because a YouTube post has one and the caption cannot stand in for it. Their
     * validator: "Video or short title is required and must be shorter than 100 characters."
     *
     * `madeForKids`, because "It is necessary to select the audience of the video" is YouTube's
     * made-for-kids declaration and it has no default. FALSE is the truthful answer for everything
     * this console posts: it is business content for adults, and declaring otherwise would strip
     * comments and personalisation from the video. If a channel ever needs the other answer it
     * belongs on the stream's settings, not hard-coded here.
     *
     * `type`, for a vertical file, as the lowercase `short` read off his own scheduled posts through
     * the probe. It is what stops "Invalid video orientation, only horizontal is allowed". A
     * landscape file sends no type, because that token is not in the data and the default already
     * accepts horizontal. See ./youtube-type.
     *
     * `privacy: 'public'` is sent explicitly, though nothing complained about it, because YouTube is
     * the one channel this console had never successfully published to and an unseen default that
     * turned out to be private is a post that went out invisible.
     */
    /**
     * EVERY VALUE HERE IS COPIED FROM HIS OWN ACCOUNT (D84), read back through the probe rather than
     * invented. Their composer sends, on a real Short of his:
     *   { title, type: "short", privacy: "public", category: "SCIENCE_TECHNOLOGY", madeForKids: false }
     *
     * `privacy` is sent explicitly even though nothing complained about it, because YouTube is the
     * one channel this console had never successfully published to: an unseen default that turned
     * out to be private would be a post that went out invisible, which is the worst kind of failure
     * to debug. `category` and `tags` are NOT sent: they are editorial choices with no source here,
     * and Metricool clearly defaults them.
     */
    const youtubeData: Record<string, unknown> = { madeForKids: false, privacy: 'public' };
    if (input.youtubeTitle) youtubeData.title = input.youtubeTitle;
    if (input.youtubeType) youtubeData.type = input.youtubeType;
    body.youtubeData = youtubeData;
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

/**
 * A POST that reports its status instead of throwing (D100), for the autolist calls whose request
 * shapes their spec does not document: the status and body ARE the answer, and the operator needs
 * to read them. Query params are supported because their `/lists/*` family takes most inputs that
 * way, even on POST.
 */
export async function mcProbePost(
  path: string,
  opts: { blogId?: string; params?: Record<string, string>; body?: unknown } = {}
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
  const safeUrl = url.toString();
  try {
    const res = await fetch(safeUrl, {
      method: 'POST',
      headers: { 'X-Mc-Auth': c.token, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const contentType = res.headers.get('content-type');
    const text = await res.text().catch(() => '');
    let json: unknown;
    if (contentType?.includes('json')) {
      try {
        json = JSON.parse(text);
      } catch {
        json = undefined;
      }
    }
    return { path, url: safeUrl, status: res.status, contentType, json, bodyHead: text.slice(0, 600) };
  } catch (e) {
    return { path, url: safeUrl, status: null, contentType: null, bodyHead: '', error: e instanceof Error ? e.message : String(e) };
  }
}

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
