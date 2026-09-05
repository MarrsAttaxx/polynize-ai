/**
 * Publish-calendar persistence — Phase-1 INTERIM.
 *
 * One row per (piece x channel) = one publish unit, mirroring migration 0009's
 * `calendar_entries`. Backs onto content_shoot_sheets via an owner-scoped key
 * (`calendar/{owner}/{entryId}`) so the calendar works before 0009 is applied.
 * When 0009 lands, swap the internals here to calendar_entries; callers do not
 * change. Field names track the 0009 columns (owner_id, channel, scheduled_at,
 * status, external_ref) so the DB swap is a lift, not a remap; `post_copy` maps
 * into 0009's `variant` jsonb, and `title`/`stream` are denormalized here for a
 * fast calendar render.
 *
 * Server-side only.
 */

import {
  getSheetState,
  saveSheetState,
  deleteSheetState,
} from '@/lib/content/shoot-sheet-store';
import { supabaseService } from '@/lib/supabase';

export type CalendarStatus = 'draft' | 'scheduled' | 'published';

export type CalendarEntry = {
  entry_id: string;
  owner: string;
  /** Who the content is FOR (maps to a Metricool brand at publish time). */
  stream: string;
  piece_id: string;
  /** Denormalized piece title, so the calendar list needn't load every piece. */
  title: string;
  /** ChannelId (linkedin | instagram | ...). */
  channel: string;
  /** The channel-specific caption (0009: variant.post_copy). */
  post_copy: string;
  /** Planned/scheduled time, ISO. Absent = an unscheduled draft. */
  scheduled_at?: string;
  /**
   * THE TIMEZONE THAT TIME WAS CHOSEN IN, stamped when the time is set (D61).
   *
   * `scheduled_at` is local wall-clock, never UTC, because that is what Metricool takes: a
   * 'YYYY-MM-DDTHH:mm:ss' paired with a separate IANA zone. A wall-clock time without its zone is
   * not a time, so the two have to travel together on the entry rather than being re-derived from
   * config at ship time. Re-deriving is how "the morning video" goes out in the afternoon: the
   * wave picked the slot from the LANE's schedule and publish read the zone off the STREAM's
   * posting schedule, which is a different setting that happens to hold the same default.
   *
   * Same discipline as publish_mode, which is already stamped rather than read late for exactly
   * this reason. Absent on entries planned before D61, which fall back to config.
   */
  timezone?: string;
  status: CalendarStatus;
  /** Metricool post id, set once actually scheduled there (0009: external_ref). */
  external_ref?: string;
  /** Deep link to the post in Metricool, set at schedule time. */
  metricool_url?: string;
  /** Attached media asset ids (copied from the piece at prepare time), resolved to
   *  public URLs and sent to Metricool at publish time. Optional; existing entries
   *  stay valid (isValidEntry unchanged). Maps into 0009's variant jsonb. */
  media?: string[];
  /**
   * HOW this entry reaches the platform, stamped when the wave is planned (D41).
   *
   * 'auto' goes through Metricool at `scheduled_at`. 'manual' is prepared by the console
   * and sent to the operator to post himself, because he measures better reach posting
   * natively from his phone on his own LinkedIn.
   *
   * Stamped at PLAN time rather than read at ship time on purpose: changing the lane's
   * setting later must not silently rewrite how an already-planned wave will go out.
   * Absent on entries planned before this existed, which are treated as 'auto', matching
   * how they were already behaving.
   */
  publish_mode?: 'auto' | 'manual';
  /**
   * SHORT OR LANDSCAPE, for a YouTube entry (D84). Stamped at prepare time from the piece, for the
   * same reason publish_mode and timezone are stamped: anything decided while authoring has to
   * travel on the entry rather than be re-derived at ship time. Absent means Short.
   */
  youtube_type?: 'short' | 'landscape';
  /** When the operator was sent a manual post to publish by hand. */
  handed_at?: string;
  /**
   * THE FIRST COMMENT, which is where a link goes on LinkedIn (D42).
   *
   * One external link in the body costs about 18.8% of median reach, and a post cannot carry
   * both a link preview and an image, so the kit catalogue declares `link: 'first_comment'` on
   * every LinkedIn text output. This is the field that makes that declaration real: the
   * Metricool client has always accepted firstCommentText and publishEntry never sent it, and
   * the hand-post brief has always had a place to print it and never had one to read.
   *
   * Nothing writes it yet. The caption card at Gate 4 is what will, and until it exists this
   * is deliberately empty rather than filled with a guessed url.
   */
  first_comment?: string;
  /**
   * THE USE CASE THIS POST SERVES (D96), copied from the piece (which copied it from the Story)
   * when the entry is made. Stamped, like publish_mode and timezone, so relabelling a Story later
   * does not silently rewrite what an already-published post was counted under.
   */
  use_case?: string;
  /**
   * THIS POST'S OWN LINK (D96): polynize.ai plus four labels (network, delivery, use case, and
   * this entry's id) built by lib/marketing/tracking-link.ts. Where it goes depends on the network:
   * on LinkedIn it is also the first comment; on Instagram and TikTok the operator pastes it into
   * the ManyChat flow; on YouTube it belongs in the description. The console never puts it into
   * post_copy, because the copy is the operator's words and the kit says where links live.
   */
  link?: string;
  /**
   * WHERE THE POST ACTUALLY IS (D98): the platform's public url, read back from Metricool after
   * publication (`GET /v2/scheduler/posts`, `providers[].publicUrl`). Two things hang off it: the
   * analytics feed's rows carry the same url, so this is the exact join from a Metricool number to
   * our entry; and its presence is the platform confirming the post exists, which is what turns
   * D85's inferred "Posted" into a confirmed one.
   */
  public_url?: string;
  /**
   * WHICH POST TYPE THIS IS (D99): the kit output id the wave made it from (contrarian post, reel
   * two of three), or the piece's format for a piece with no Story. The leaderboard groups by it.
   * Stamped at creation like everything else decided while authoring. Absent on older entries,
   * which the ladder shows as "unlabelled" rather than dropping.
   */
  frame?: string;
  /**
   * PROMOTED TO EVERGREEN (D100): this post now also lives in a Metricool autolist that repeats on
   * its network's quiet slots. The list and item ids are kept so the recycled post still joins back
   * to this entry's frame and use case, and so it can be taken out again.
   */
  evergreen?: {
    list_id: string;
    /** One item per copy variant April wrote, so the cycles are not identical text. */
    item_ids: string[];
    added_at: string;
  };
  created_at: string;
  updated_at?: string;
};

function keyFor(owner: string, entryId: string): string {
  return `calendar/${owner}/${entryId}`;
}

/**
 * Runtime shape guard over untrusted jsonb. Required fields must be non-empty
 * strings so a malformed row can never crash the calendar render.
 */
export function isValidEntry(x: unknown): x is CalendarEntry {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const e = x as Record<string, unknown>;
  const str = (v: unknown) => typeof v === 'string' && v.length > 0;
  return (
    str(e.entry_id) &&
    str(e.owner) &&
    str(e.stream) &&
    str(e.piece_id) &&
    str(e.channel) &&
    typeof e.post_copy === 'string' &&
    str(e.status)
  );
}

/** List THIS owner's calendar entries. Owner-scoped; malformed rows are dropped. */
export async function listEntries(owner: string): Promise<CalendarEntry[]> {
  const prefix = `calendar/${owner}/`;
  const { data, error } = await supabaseService()
    .from('content_shoot_sheets')
    .select('episode_id, state')
    .like('episode_id', 'calendar/%');
  if (error) throw new Error(`calendar list failed: ${error.message}`);
  return (data ?? [])
    .filter((r) => {
      const id = (r as { episode_id?: unknown }).episode_id;
      return typeof id === 'string' && id.startsWith(prefix);
    })
    .map((r) => (r as { state: unknown }).state)
    .filter(isValidEntry);
}

/**
 * EVERY ENTRY, EVERY OWNER. For the nightly jobs (the url join, the site numbers) which run with
 * no signed-in user and have to see the whole calendar. Malformed rows are dropped as everywhere.
 */
export async function listAllEntries(): Promise<CalendarEntry[]> {
  const { data, error } = await supabaseService()
    .from('content_shoot_sheets')
    .select('episode_id, state')
    .like('episode_id', 'calendar/%');
  if (error) throw new Error(`calendar list-all failed: ${error.message}`);
  return (data ?? []).map((r) => (r as { state: unknown }).state).filter(isValidEntry);
}

/** All calendar entries for one piece (used to make prepare idempotent per channel). */
export async function listEntriesForPiece(
  owner: string,
  pieceId: string
): Promise<CalendarEntry[]> {
  return (await listEntries(owner)).filter((e) => e.piece_id === pieceId);
}

export async function getEntry(
  owner: string,
  entryId: string
): Promise<CalendarEntry | null> {
  const s = await getSheetState(keyFor(owner, entryId));
  return isValidEntry(s) ? s : null;
}

export async function saveEntry(
  owner: string,
  entry: CalendarEntry
): Promise<{ updated_at: string }> {
  return saveSheetState(keyFor(owner, entry.entry_id), entry);
}

export async function deleteEntry(owner: string, entryId: string): Promise<void> {
  await deleteSheetState(keyFor(owner, entryId));
}
