/**
 * THE URL JOIN (D98): after a post has gone out, ask Metricool where it ended up.
 *
 * At schedule time we store Metricool's own post id (`external_ref`). Their analytics rows carry
 * the PLATFORM's url instead, and nowhere does their spec say the two ids are the same space
 * (they are not: 367684553 against urn:li:ugcPost:7498...). The bridge, read off the spec and
 * proven against his account in D84, is `GET /v2/scheduler/posts`, whose `providers[]` carry a
 * `publicUrl` per network once the platform has published.
 *
 * So: for every entry that has an external_ref and no public_url yet, read the scheduled posts
 * for its brand over the last 90 days, find the post by id, take the url for the entry's network,
 * store it. A stored url also means the platform confirmed the post exists, so a 'scheduled'
 * entry whose time has passed becomes 'published' here, which is what turns D85's inferred
 * "Posted" into a confirmed one.
 *
 * ONE LIST READ PER BRAND, not one per entry. It never throws; a brand that cannot be read is
 * reported and the others proceed.
 */

import { listAllEntries, saveEntry, type CalendarEntry } from './calendar-store';
import { getBrandMap } from './metricool-config-store';
import { mcProbeGet } from './metricool-client';
import { laneTimezone } from './channel-schedule';
import { rangeStart } from './analytics-metrics';

export type UrlJoinResult = { checked: number; joined: number; errors: string[] };

/** Our channel id against Metricool's network name. X is still `twitter` there. */
function sameNetwork(channel: string, network: unknown): boolean {
  if (typeof network !== 'string') return false;
  const n = network.toLowerCase();
  return n === channel || (channel === 'x' && n === 'twitter');
}

/**
 * Pure: pick the public url for one entry out of a scheduled-posts response. Exported for tests.
 * Accepts the list as a bare array or wrapped in `data`, and ids as numbers or strings.
 */
export function publicUrlFor(entry: Pick<CalendarEntry, 'external_ref' | 'channel'>, json: unknown): string | undefined {
  const list = Array.isArray(json)
    ? json
    : json && typeof json === 'object' && Array.isArray((json as { data?: unknown }).data)
      ? ((json as { data: unknown[] }).data)
      : [];
  for (const post of list) {
    if (!post || typeof post !== 'object') continue;
    const p = post as Record<string, unknown>;
    if (String(p.id ?? '') !== String(entry.external_ref ?? '')) continue;
    const providers = Array.isArray(p.providers) ? p.providers : [];
    let fallback: string | undefined;
    for (const pr of providers) {
      if (!pr || typeof pr !== 'object') continue;
      const r = pr as Record<string, unknown>;
      const url = typeof r.publicUrl === 'string' && /^https?:\/\//.test(r.publicUrl) ? r.publicUrl : undefined;
      if (!url) continue;
      if (sameNetwork(entry.channel, r.network)) return url;
      fallback = fallback ?? url;
    }
    return fallback;
  }
  return undefined;
}

export async function joinPublishedUrls(now = new Date()): Promise<UrlJoinResult> {
  const out: UrlJoinResult = { checked: 0, joined: 0, errors: [] };
  let entries: CalendarEntry[];
  try {
    entries = await listAllEntries();
  } catch (err) {
    out.errors.push(`could not list the calendar: ${err instanceof Error ? err.message : String(err)}`);
    return out;
  }
  const wanting = entries.filter((e) => e.external_ref && !e.public_url && e.publish_mode !== 'manual');
  if (wanting.length === 0) return out;

  let brands: Record<string, string> = {};
  try {
    brands = await getBrandMap();
  } catch (err) {
    out.errors.push(`could not read the brand map: ${err instanceof Error ? err.message : String(err)}`);
    return out;
  }

  const to = now.toISOString().slice(0, 10);
  const from = rangeStart(to, 90);
  const byStream = new Map<string, CalendarEntry[]>();
  for (const e of wanting) byStream.set(e.stream, [...(byStream.get(e.stream) ?? []), e]);

  for (const [stream, list] of byStream) {
    const blogId = brands[stream];
    if (!blogId) continue;
    // FULL ISO DATETIMES, and the names are start/end for the scheduler family (metricool-api.md).
    const call = await mcProbeGet('/v2/scheduler/posts', {
      blogId,
      params: { start: `${from}T00:00:00`, end: `${to}T23:59:59`, timezone: laneTimezone(stream) },
    });
    if (call.status !== 200) {
      out.errors.push(`${stream}: scheduler read returned ${call.status ?? 'no status'}`);
      continue;
    }
    for (const e of list) {
      out.checked += 1;
      const url = publicUrlFor(e, call.json);
      if (!url) continue;
      const passed = e.scheduled_at ? e.scheduled_at.slice(0, 10) <= to : true;
      try {
        await saveEntry(e.owner, {
          ...e,
          public_url: url,
          status: e.status === 'scheduled' && passed ? 'published' : e.status,
          updated_at: now.toISOString(),
        });
        out.joined += 1;
      } catch (err) {
        out.errors.push(`${e.entry_id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  return out;
}
