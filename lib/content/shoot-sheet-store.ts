/**
 * Supabase read/write for content_shoot_sheets (one JSON blob per content slug).
 *
 * The slug `episode_id` is the URL-aligned "<show>/<episode>" (e.g. "pam/ep00").
 * `state` is stored verbatim as jsonb in the migratable shape documented in
 * supabase/migrations/0007_content_shoot_sheets.sql. Server-side only.
 */

import { supabaseService } from '@/lib/supabase';

const TABLE = 'content_shoot_sheets';

export function slugFor(show: string, episode: string): string {
  return `${show}/${episode}`;
}

/** Load saved state for a slug, or null if no row yet. */
export async function getSheetState(slug: string): Promise<unknown | null> {
  const { data, error } = await supabaseService()
    .from(TABLE)
    .select('state')
    .eq('episode_id', slug)
    .maybeSingle();
  if (error) throw new Error(`content_shoot_sheets read failed: ${error.message}`);
  return data?.state ?? null;
}

/** Upsert state for a slug. Returns the updated_at stamp written. */
export async function saveSheetState(
  slug: string,
  state: unknown
): Promise<{ updated_at: string }> {
  const updated_at = new Date().toISOString();
  const { error } = await supabaseService()
    .from(TABLE)
    .upsert({ episode_id: slug, state, updated_at }, { onConflict: 'episode_id' });
  if (error) throw new Error(`content_shoot_sheets write failed: ${error.message}`);
  return { updated_at };
}

/** Delete a row by slug (idempotent — no error if the row is already gone). */
export async function deleteSheetState(slug: string): Promise<void> {
  const { error } = await supabaseService().from(TABLE).delete().eq('episode_id', slug);
  if (error) throw new Error(`content_shoot_sheets delete failed: ${error.message}`);
}
