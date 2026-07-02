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

export type MarketingPiece = {
  piece_id: string;
  owner: string;
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

/** Load a saved piece for this owner, or null if none saved yet. */
export async function getPiece(
  owner: string,
  pieceId: string
): Promise<MarketingPiece | null> {
  const s = (await getSheetState(keyFor(owner, pieceId))) as MarketingPiece | null;
  return s && typeof s === 'object' && !Array.isArray(s) ? s : null;
}

/** Upsert a piece for this owner. Owner + id are the storage key. */
export async function savePiece(
  owner: string,
  piece: MarketingPiece
): Promise<{ updated_at: string }> {
  return saveSheetState(keyFor(owner, piece.piece_id), piece);
}
