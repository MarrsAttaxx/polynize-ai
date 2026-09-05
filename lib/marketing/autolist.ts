/**
 * PROMOTE A POST TO EVERGREEN (D100): put it in a Metricool autolist that repeats.
 *
 * Marrs: "If we find one type of content that's working, we create a channel specifically for that
 * content and double down." The console decides what is proven (the leaderboard); this is the
 * double down. One list per stream per network, made on first use, remembered in autolist-store.
 *
 * THEIR `/lists/*` FAMILY IS THE OLD PLANNER API: mutations are mostly GETs with query params,
 * the spec documents no request bodies, and the summaries are blank. So every step here is a
 * probe call that reports its status, the whole run is a list of sentences the operator can read,
 * and the last step READS THE LIST BACK to confirm the text landed rather than trusting a 200.
 * That is how every other Metricool feature in this console was proven: against his account,
 * with the failure shown. The first press is the test.
 *
 * THE LINK IS NOT IN THE TEXT. A list item is text and media only (no first comment), and the kit
 * puts LinkedIn links in the first comment for a reason (18.8% median reach). So evergreen items
 * carry the caption's own call to action ("comment MAP") and no url. Their reach shows up in the
 * brand feed; their clicks arrive through ManyChat like everyone else's. Said in the docs.
 *
 * THREE VARIANTS, NOT ONE. Metricool's fair use policy names "repetitive publication of identical
 * content"; a repeating list of one text is exactly that. April writes two rewrites in the
 * stream's voice; the list cycles through three. If she fails, one is still stored, and the run says so.
 */

import type { CalendarEntry } from './calendar-store';
import { saveEntry } from './calendar-store';
import { getBrandMap } from './metricool-config-store';
import { isMetricoolConfigured, mcProbeGet, mcProbePost } from './metricool-client';
import { metricoolNetwork, channelLabel } from './channels';
import { streamLabel } from './streams';
import { resolveMedia } from './media-store';
import { getChannelSchedule, NETWORKS, type Network } from './channel-schedule';
import { getBrandVoiceForStream } from './brand-voice-store';
import { complete } from '@/lib/llm';
import { stripEmDashes } from '@/lib/em-dash';
import { getAutolists, saveAutolists } from './autolist-store';
import { evergreenSlotTime, newestListId, itemIds, parseVariants } from './evergreen';
import { youtubeTypeToken } from './youtube-type';

export type PromoteResult = {
  ok: boolean;
  /** What happened, one sentence per step, in order. Printed to the operator. */
  steps: string[];
  error?: string;
  list_id?: string;
  item_ids?: string[];
};

export async function promoteToEvergreen(owner: string, entry: CalendarEntry): Promise<PromoteResult> {
  const steps: string[] = [];
  const fail = (error: string): PromoteResult => ({ ok: false, steps, error });

  if (!isMetricoolConfigured()) return fail('Metricool is not connected.');
  if (entry.evergreen) return { ok: true, steps: ['Already evergreen.'], list_id: entry.evergreen.list_id, item_ids: entry.evergreen.item_ids };
  const network = metricoolNetwork(entry.channel);
  if (!network) return fail(`${channelLabel(entry.channel)} is not published through Metricool.`);
  const blogId = (await getBrandMap())[entry.stream];
  if (!blogId) return fail(`Map the ${streamLabel(entry.stream)} stream to a Metricool brand first.`);

  /* media, and whether there is a video (the list-level presets depend on it) */
  let media: string[] = [];
  let hasVideo = false;
  try {
    const assets = await resolveMedia(entry.stream, entry.media ?? []);
    media = assets.map((a) => a.url);
    hasVideo = assets.some((a) => a.kind === 'video');
  } catch (err) {
    steps.push(`Media could not be resolved (${err instanceof Error ? err.message : String(err)}); the list item will be text only.`);
  }

  /* the list: ours if we have one, else made now */
  const lists = await getAutolists();
  let listId: string | undefined = lists[entry.stream]?.[entry.channel]?.list_id;
  if (listId) {
    const check = await mcProbeGet('/lists/getlist', { blogId, params: { listid: listId } });
    if (check.status !== 200 || (check.json as { deleted?: unknown } | null)?.deleted === true) {
      steps.push(`The remembered list ${listId} is gone from Metricool (${check.status ?? 'no status'}); making a new one.`);
      listId = undefined;
    }
  }
  if (!listId) {
    const before = await mcProbeGet('/lists', { blogId });
    const known = new Set(itemIds(before.json));
    const made = await mcProbePost('/lists/create', { blogId });
    if (made.status !== 200) return fail(`Metricool would not create a list (${made.status ?? 'no status'}): ${made.bodyHead.slice(0, 200)}`);
    listId = newestListId(made.json, known);
    if (!listId) {
      const after = await mcProbeGet('/lists', { blogId });
      listId = newestListId(after.json, known);
    }
    if (!listId) return fail(`Metricool said it created a list but none new could be found: ${made.bodyHead.slice(0, 200)}`);
    steps.push(`Made autolist ${listId} on the ${streamLabel(entry.stream)} brand.`);

    const name = `Evergreen · ${streamLabel(entry.stream)} · ${channelLabel(entry.channel)}`;
    const params: Record<string, string> = {
      listid: listId,
      name,
      [network]: 'true',
      repeat: 'true',
      random: 'false',
      shortener: 'false',
      enable: 'false',
    };
    /* the same per-network tokens the scheduler needed (D81, D84), at list level (D94) */
    if (network === 'instagram' && hasVideo) {
      params.igType = 'REEL';
      params.igShowReelOnFeed = 'true';
    }
    if (network === 'tiktok') params.tkPrivacy = 'PUBLIC_TO_EVERYONE';
    if (network === 'youtube') {
      params.ytPrivacy = 'public';
      params.ytMadeForKids = 'false';
      const t = youtubeTypeToken(entry.youtube_type);
      if (t) params.ytType = t;
    }
    const conf = await mcProbeGet('/lists/update', { blogId, params });
    if (conf.status !== 200) return fail(`The list was made but could not be configured (${conf.status ?? 'no status'}): ${conf.bodyHead.slice(0, 200)}`);
    steps.push(`Named it "${name}", ${channelLabel(entry.channel)} only, repeating, shortener off.`);

    /* one quiet slot, every day */
    let slots: readonly string[] = [];
    try {
      if ((NETWORKS as readonly string[]).includes(entry.channel)) {
        slots = (await getChannelSchedule(entry.stream)).channels[entry.channel as Network] ?? [];
      }
    } catch {
      /* the default time still works */
    }
    const time = evergreenSlotTime(slots);
    const timing = await mcProbeGet('/lists/timing/create', { blogId, params: { listid: listId } });
    const timingId = timing.status === 200 ? itemIds(timing.json).sort((a, b) => Number(b) - Number(a))[0] : undefined;
    if (!timingId) {
      steps.push(`Could not add a posting time (${timing.status ?? 'no status'}); set one on the list in Metricool.`);
    } else {
      const days = Object.fromEntries(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((d) => [d, 'true']));
      const set = await mcProbeGet('/lists/timing/update', { blogId, params: { id: timingId, listid: listId, time, ...days } });
      steps.push(set.status === 200 ? `Posts every day at ${time}, six hours after the channel's first slot.` : `The posting time could not be set (${set.status ?? 'no status'}); set one in Metricool.`);
    }

    lists[entry.stream] = { ...(lists[entry.stream] ?? {}), [entry.channel]: { list_id: listId, created_at: new Date().toISOString() } };
    try {
      await saveAutolists(lists);
    } catch (err) {
      steps.push(`Warning: the list id could not be remembered (${err instanceof Error ? err.message : String(err)}); the next promotion may make a second list.`);
    }
  } else {
    steps.push(`Using the existing autolist ${listId}.`);
  }

  /* the copy, three ways */
  const variants = await writeVariants(entry);
  steps.push(variants.length > 1 ? `April wrote ${variants.length - 1} rewrite${variants.length - 1 === 1 ? '' : 's'} so the cycles are not identical.` : 'Stored with the original copy only; April could not write rewrites this time.');

  /* add, then read back */
  const wanted = variants.map((text) => ({ listId: Number(listId), text, mediaUrls: media, enabled: true }));
  const add = await mcProbePost('/lists/posts/new', { blogId, params: { listid: listId }, body: wanted });
  if (add.status !== 200) return fail(`Metricool would not add the posts to list ${listId} (${add.status ?? 'no status'}): ${add.bodyHead.slice(0, 200)}`);
  const back = await mcProbeGet('/lists/posts', { blogId, params: { listid: listId } });
  const ids = itemIds(back.json, variants);
  if (ids.length === 0) {
    return fail(`Metricool accepted the add but the list does not show the text when read back. Their response: ${add.bodyHead.slice(0, 200)}`);
  }
  steps.push(`${ids.length} of ${variants.length} item${variants.length === 1 ? '' : 's'} confirmed on the list.`);

  /* switch it on, now that it has something to post */
  const on = await mcProbeGet('/lists/enable', { blogId, params: { listid: listId, enable: 'true' } });
  steps.push(on.status === 200 ? 'List switched on.' : `The list could not be switched on (${on.status ?? 'no status'}); enable it in Metricool.`);

  try {
    await saveEntry(owner, { ...entry, evergreen: { list_id: listId, item_ids: ids, added_at: new Date().toISOString() }, updated_at: new Date().toISOString() });
  } catch (err) {
    steps.push(`Warning: the post is on the list but the console could not record it (${err instanceof Error ? err.message : String(err)}).`);
  }
  return { ok: true, steps, list_id: listId, item_ids: ids };
}

async function writeVariants(entry: CalendarEntry): Promise<string[]> {
  const original = stripEmDashes(entry.post_copy).trim();
  if (!original) return [];
  try {
    const voice = await getBrandVoiceForStream(entry.stream).catch(() => undefined);
    const raw = await complete({
      system: [
        'You rewrite one social post two different ways for the same platform, keeping its meaning, its call to action and its length.',
        'Do not add links or hashtags that were not there. Do not use em dashes. Return ONLY a JSON array of two strings.',
        voice ? `\nVOICE:\n${voice}` : '',
      ].join('\n'),
      messages: [{ role: 'user', content: `PLATFORM: ${channelLabel(entry.channel)}\n\nPOST:\n"""\n${original}\n"""` }],
      maxTokens: 1500,
      temperature: 0.8,
      apiKey: process.env.APRIL_OPENROUTER_API_KEY,
    });
    return parseVariants(stripEmDashes(raw), original, 3);
  } catch (err) {
    console.error('[evergreen] variants failed:', err);
    return [original];
  }
}
