/**
 * Publish one calendar entry to Metricool (D24). Shared by the manual Schedule
 * route and the Add-to-queue route so there is one place that resolves the brand,
 * network, and timezone and calls the REST client. The caller sets entry.scheduled_at
 * (a chosen time, or a computed queue slot); this sends it and marks it scheduled.
 *
 * Returns a discriminated result rather than throwing, so routes map it straight
 * to a response. Server-side only.
 */

import { saveEntry, type CalendarEntry } from './calendar-store';
import { resolveMediaUrls } from './media-store';
import { getBrandMap, getPostingSchedule } from './metricool-config-store';
import { isMetricoolConfigured, schedulePost } from './metricool-client';
import { metricoolNetwork, channelLabel } from './channels';
import { streamLabel } from './streams';
import { defaultStreamSchedule, timezoneForEntry } from './posting-schedule';

export type PublishResult =
  | { ok: true; entry: CalendarEntry; warning?: string }
  | { ok: false; status: number; error: string };

/** Normalize a stored date/datetime to Metricool's 'YYYY-MM-DDTHH:mm:ss' (no Z). */
export function toDateTime(scheduledAt: string): string {
  const raw = scheduledAt.trim();
  if (raw.length <= 10) return `${raw}T09:00:00`; // date only -> default 9am
  if (raw.length === 16) return `${raw}:00`; // 'YYYY-MM-DDTHH:mm'
  return raw.replace(/\.\d+/, '').replace(/Z$/, '').slice(0, 19);
}

export async function publishEntry(
  owner: string,
  entry: CalendarEntry,
  /**
   * SEND IT AS A DRAFT INSTEAD OF PUBLISHING IT (D67).
   *
   * The first ever real call to Metricool should not be able to put anything in public. A draft
   * lands in Metricool's own planner with `autoPublish` off, so it proves the whole chain, the
   * token, the brand id, the payload shape, the media urls, the date and its timezone, while the
   * only person who can see the result is him.
   *
   * The client has always accepted `draft` and nothing ever passed it, so the capability was
   * documented and inert. Same shape of gap D42 found with `firstCommentText`.
   */
  opts: { draft?: boolean } = {}
): Promise<PublishResult> {
  const draft = opts.draft === true;
  if (!isMetricoolConfigured()) {
    return { ok: false, status: 400, error: 'Metricool is not connected. Add the keys in Vercel, then map your brands.' };
  }
  if (!entry.scheduled_at) {
    return { ok: false, status: 400, error: 'set a date and time on this post first' };
  }
  const network = metricoolNetwork(entry.channel);
  if (!network) {
    return { ok: false, status: 400, error: `${channelLabel(entry.channel)} is not published through Metricool.` };
  }
  const blogId = (await getBrandMap())[entry.stream];
  if (!blogId) {
    return {
      ok: false,
      status: 400,
      error: `Map the ${streamLabel(entry.stream)} stream to a Metricool brand first (Connect Metricool).`,
    };
  }

  const schedule = (await getPostingSchedule())[entry.stream] ?? defaultStreamSchedule();

  /**
   * THE ZONE THE TIME WAS CHOSEN IN (D61), not whatever config says now.
   *
   * `entry.scheduled_at` is local wall-clock and Metricool takes it paired with a separate IANA
   * zone, so the pair has to agree or the post goes out at the right numbers in the wrong place.
   * The wave stamps `entry.timezone` from the same lane schedule that picked the slot; the posting
   * schedule read above is a DIFFERENT setting that happens to hold the same default today, which
   * is the only reason this was invisible.
   *
   * The fallback is for entries planned before the stamp existed. It keeps their old behaviour
   * exactly rather than reinterpreting them, which is the conservative half of the fix.
   */
  const timezone = timezoneForEntry(entry, schedule.timezone);

  // Resolve attached media ids to current public URLs (Metricool fetches by URL).
  // Degrade to a text-only post rather than failing if the lookup hiccups.
  let media: string[] = [];
  try {
    media = await resolveMediaUrls(entry.stream, entry.media ?? []);
  } catch (err) {
    console.error('[publish] media resolve failed, posting without media:', err);
  }

  let result;
  try {
    result = await schedulePost({
      blogId,
      text: entry.post_copy,
      networks: [network],
      dateTime: toDateTime(entry.scheduled_at),
      timezone,
      media,
      draft,
      // The link belongs in the first comment on LinkedIn, never in the body (D42). The client
      // has always accepted this and it was never passed, so the rule was documented and inert.
      firstCommentText: entry.first_comment?.trim() || undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[publish] Metricool call failed: ${msg}`);
    return { ok: false, status: 502, error: `Metricool rejected the post: ${msg}` };
  }

  /**
   * A DRAFT IS NOT SCHEDULED, and the calendar must not say it is. It keeps its draft status so
   * nothing downstream counts it as live, and it keeps the returned id, which is the whole point
   * of a dry run: that id is the thing to compare against what the analytics endpoints take as
   * `postId` (todo item 8).
   */
  entry.status = draft ? 'draft' : 'scheduled';
  if (result.id) entry.external_ref = result.id;
  entry.metricool_url = 'https://app.metricool.com/planning';
  entry.updated_at = new Date().toISOString();

  try {
    await saveEntry(owner, entry);
  } catch (err) {
    console.error('[publish] entry save after schedule failed:', err);
    return { ok: true, entry, warning: 'Scheduled in Metricool, but the calendar record did not update. Refresh.' };
  }
  return { ok: true, entry };
}
