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
};

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

/** Metricool's best-time-to-publish suggestions for a brand (feeds Raph, Step 3). */
export async function bestTimes(blogId: string): Promise<unknown> {
  return mcFetch('/planner/best-time-to-publish', { method: 'GET', blogId });
}
