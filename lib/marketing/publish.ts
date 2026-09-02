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
import { resolveMedia } from './media-store';
import { getBrandMap, getPostingSchedule } from './metricool-config-store';
import {
  isMetricoolConfigured,
  schedulePost,
  metricoolCalendarUrl,
  youtubeTitleFrom,
} from './metricool-client';
import { metricoolNetwork, channelLabel } from './channels';
import { streamLabel } from './streams';
import { defaultStreamSchedule, timezoneForEntry } from './posting-schedule';
import { getChannelSchedule, NETWORKS, type Network } from './channel-schedule';
import { resolvePostTime } from './when-to-post';

export type PublishResult =
  | { ok: true; entry: CalendarEntry; warning?: string }
  | { ok: false; status: number; error: string };

/**
 * `toDateTime` used to live here and is gone (D83). It turned a date with no time into 09:00 by way
 * of a constant, and nothing checked that 09:00 was still ahead: setting today's date in the
 * afternoon produced a post Metricool refused for being in the past. Its replacement,
 * `resolvePostTime` in ./when-to-post, takes the time from the channel's own posting times and
 * refuses a past one with a sentence. Nothing else ever called it.
 */

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

  /**
   * WHEN, RESOLVED AND CHECKED (D83).
   *
   * A date with no time used to become 09:00 by way of a constant inside `toDateTime`, and nothing
   * asked whether 09:00 was still ahead. Set today's date after 9am and Metricool refused the post
   * with a 400 carrying a Java object, which is not something an operator can act on.
   *
   * The invented time now comes from this channel's own posting times, the same table the queue and
   * the wave read, and a time in the past is refused here with a sentence naming the two ways out.
   *
   * The slot read is best effort: without it the resolver still works, it simply has no times to
   * choose from and falls back to the old constant, which is exactly the previous behaviour.
   */
  let slots: readonly string[] = [];
  if ((NETWORKS as readonly string[]).includes(entry.channel)) {
    try {
      slots = (await getChannelSchedule(entry.stream)).channels[entry.channel as Network] ?? [];
    } catch (err) {
      console.error('[publish] slot read failed, falling back to a fixed time:', err);
    }
  }
  const when = resolvePostTime({
    scheduledAt: entry.scheduled_at,
    timezone,
    slots,
    channel: channelLabel(entry.channel),
  });
  if (!when.ok) {
    return { ok: false, status: 400, error: when.error };
  }

  // Resolve attached media ids to current public URLs (Metricool fetches by URL).
  // Degrade to a text-only post rather than failing if the lookup hiccups.
  /**
   * THE ASSETS, not just their urls (D81), because whether one of them is a VIDEO changes the
   * payload: Instagram refuses a single-video post unless it is declared a Reel. The stored kind is
   * the answer rather than the url's extension, since a Box direct link need not carry one.
   */
  let media: string[] = [];
  let hasVideo = false;
  try {
    const assets = await resolveMedia(entry.stream, entry.media ?? []);
    media = assets.map((a) => a.url);
    hasVideo = assets.some((a) => a.kind === 'video');
  } catch (err) {
    console.error('[publish] media resolve failed, posting without media:', err);
  }

  let result;
  try {
    result = await schedulePost({
      blogId,
      text: entry.post_copy,
      networks: [network],
      dateTime: when.dateTime,
      timezone,
      media,
      draft,
      // The link belongs in the first comment on LinkedIn, never in the body (D42). The client
      // has always accepted this and it was never passed, so the rule was documented and inert.
      firstCommentText: entry.first_comment?.trim() || undefined,
      /**
       * THE FIRST LINE OF THE POST IS THE TITLE (D82), with the entry's own label as the fallback for
       * a post with no copy.
       *
       * This was the other way round and it was wrong: the entry title is an internal filing name
       * (the media library's label, or "<headline>: Numbered rules"), while the first line is the one
       * sentence written to be read. Marrs asked how the title was being chosen, which is the right
       * question to ask of anything derived and invisible, so it is now derived from the better
       * source AND printed on the caption screen.
       */
      youtubeTitle:
        network === 'youtube' ? youtubeTitleFrom(entry.post_copy, entry.title) : undefined,
      // Instagram needs to be told it is a Reel, or it refuses the post outright (D81).
      hasVideo,
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
  /**
   * THE TIME IT ACTUALLY WENT OUT AT, written back when we chose it (D83). A card still reading as
   * a bare date after the console picked 12:30 for it is a card that cannot be checked against
   * Metricool, and the next press would re-derive against a later "now" and pick a different slot.
   */
  if (when.derived) entry.scheduled_at = when.dateTime;
  if (result.id) entry.external_ref = result.id;
  /**
   * THE LINK THAT 404'D (D77). Marrs: "the 'View in Metricool' button sends me to the following
   * error: https://app.metricool.com/public/error/404. It probably should just redirect straight to
   * the calendar page."
   *
   * `/planning` is not a path Metricool serves. The real one is `/planner/calendar`, and the url he
   * was actually looking at carries the brand and the account, so the link lands on the calendar for
   * THIS stream rather than on whichever brand the session last had open. That matters with five
   * streams mapped to five brands.
   *
   * There is no per-post deep link to build: their API returns an id but documents no url for one,
   * which is the same open question the analytics join turns on. The calendar for the right brand is
   * the closest honest destination, and it beats a 404 by a distance.
   */
  entry.metricool_url = metricoolCalendarUrl(blogId);
  entry.updated_at = new Date().toISOString();

  try {
    await saveEntry(owner, entry);
  } catch (err) {
    console.error('[publish] entry save after schedule failed:', err);
    return { ok: true, entry, warning: 'Scheduled in Metricool, but the calendar record did not update. Refresh.' };
  }
  return { ok: true, entry };
}

/**
 * SHIP ONE ENTRY THE WAY ITS CHANNEL IS SET UP (D41, enforced everywhere D80).
 *
 * `publish_mode` existed on the entry from D41 and exactly one caller read it: the wave's ship
 * branch. Both of the calendar's own buttons, Schedule and Add to queue, called `publishEntry`
 * directly, so an entry stamped 'manual' went through Metricool anyway.
 *
 * That is not a cosmetic gap. Marrs's own LinkedIn is hand-posted for a measured reason: "posting
 * content via platforms like Metricool severely restricts reach... I'll do that on my own via my
 * phone, which just supercharges reach in my experience." The setting existed, the console showed
 * it, and the two buttons he actually presses ignored it. Found while building the door for finished
 * video, which is exactly the content most likely to go out on his personal LinkedIn.
 *
 * A manual entry is PREPARED, EMAILED AND LEFT AS A DRAFT, the same three things the wave does. It
 * is not scheduled, it gets no external_ref, and it stays on the calendar until he posts it himself.
 */
export async function shipEntry(
  owner: string,
  entry: CalendarEntry,
  opts: { draft?: boolean } = {}
): Promise<PublishResult> {
  if (entry.publish_mode !== 'manual') return publishEntry(owner, entry, opts);

  if (!entry.scheduled_at) {
    return { ok: false, status: 400, error: 'Set a date first, so the brief can tell you when.' };
  }

  const { sendHandPostBrief, handPostFromEntry } = await import('./hand-post');
  const brief = await sendHandPostBrief(entry.stream, entry.title || 'A post to publish', [
    handPostFromEntry(entry),
  ]);

  /**
   * STAMPED EVEN WHEN THE EMAIL FAILED, deliberately, and the same way the wave does it. The send is
   * best effort by contract and never throws; recording that the attempt happened is what stops a
   * second press re-sending the same brief, and the post itself is on the calendar either way.
   */
  const stamped: CalendarEntry = { ...entry, handed_at: new Date().toISOString() };
  try {
    await saveEntry(owner, stamped);
  } catch (err) {
    console.error('[ship] hand-post stamp failed:', err);
  }

  return {
    ok: true,
    entry: stamped,
    warning: brief.skipped
      ? `${channelLabel(entry.channel)} on this stream is set to post by hand, so nothing was sent to Metricool. The brief could not be emailed: ${brief.skipped}. The post is on the calendar.`
      : `${channelLabel(entry.channel)} on this stream is set to post by hand, so it was emailed to you rather than scheduled. Post it, then mark it published.`,
  };
}
