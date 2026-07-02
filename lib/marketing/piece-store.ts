/**
 * Marketing piece persistence — Phase-1 INTERIM.
 *
 * Backs onto the existing `content_shoot_sheets` table via an owner-scoped key
 * (`marketing/{owner}/{pieceId}`), so the Script screen works BEFORE migration
 * 0009 (content_pieces) is applied. When 0009 lands, swap the internals here to
 * content_pieces; callers (the screen + the state route) do not change.
 * See docs/pam-console/storage-and-agent-socket.md (D2 / Phase-1 interim note).
 *
 * Server-side only (goes through supabaseService via shoot-sheet-store).
 */

import { getSheetState, saveSheetState } from '@/lib/content/shoot-sheet-store';
import { supabaseService } from '@/lib/supabase';

export type MarketingPiece = {
  piece_id: string;
  owner: string;
  /** The brand/owner bucket the content is FOR: marrs | polynize | shourov | team. */
  stream: string;
  format: string;
  title: string;
  concept_ref?: string;
  pillar?: string;
  stage?: string;
  script: string;
  updated_at?: string;
};

function keyFor(owner: string, pieceId: string): string {
  return `marketing/${owner}/${pieceId}`;
}

/**
 * Runtime shape guard over untrusted jsonb (the state column is not schema
 * enforced, and the PUT route persists arbitrary bodies). Every required field
 * must be a non-empty string. Malformed rows are treated as absent, so a bad
 * or partial row can never crash a consumer (`.format.replace`, `.script.split`).
 */
export function isValidPiece(x: unknown): x is MarketingPiece {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const p = x as Record<string, unknown>;
  const str = (v: unknown) => typeof v === 'string' && v.length > 0;
  return (
    str(p.piece_id) &&
    str(p.owner) &&
    str(p.stream) &&
    str(p.format) &&
    str(p.title) &&
    typeof p.script === 'string'
  );
}

/**
 * List THIS owner's saved marketing pieces for the dashboard shell. Owner-scoped
 * (matches getPiece/savePiece keying) so the dashboard only shows pieces the
 * user can actually open, and malformed rows are dropped, never returned.
 * Interim: scans content_shoot_sheets keys under `marketing/{owner}/`. When 0009
 * lands this becomes `select from content_pieces where owner_id = ...`.
 */
export async function listSavedPieces(owner: string): Promise<MarketingPiece[]> {
  const prefix = `marketing/${owner}/`;
  const { data, error } = await supabaseService()
    .from('content_shoot_sheets')
    .select('episode_id, state')
    .like('episode_id', 'marketing/%');
  if (error) {
    throw new Error(`marketing piece list failed: ${error.message}`);
  }
  return (data ?? [])
    .filter((r) => {
      const id = (r as { episode_id?: unknown }).episode_id;
      return typeof id === 'string' && id.startsWith(prefix);
    })
    .map((r) => (r as { state: unknown }).state)
    .filter(isValidPiece);
}

/** Load a saved piece for this owner, or null if none saved or the row is malformed. */
export async function getPiece(
  owner: string,
  pieceId: string
): Promise<MarketingPiece | null> {
  const s = await getSheetState(keyFor(owner, pieceId));
  return isValidPiece(s) ? s : null;
}

/** Upsert a piece for this owner. Owner + id are the storage key. */
export async function savePiece(
  owner: string,
  piece: MarketingPiece
): Promise<{ updated_at: string }> {
  return saveSheetState(keyFor(owner, piece.piece_id), piece);
}
