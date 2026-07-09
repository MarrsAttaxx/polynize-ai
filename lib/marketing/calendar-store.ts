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
  status: CalendarStatus;
  /** Metricool post id, set once actually scheduled there (0009: external_ref). */
  external_ref?: string;
  /** Deep link to the post in Metricool, set at schedule time. */
  metricool_url?: string;
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
