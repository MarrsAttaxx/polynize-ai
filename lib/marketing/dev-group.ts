/**
 * The ONE grouping definition for the "in development" view, shared by the stream
 * page, the develop hub, and the adopt / delete / move routes so they can never
 * disagree about which pieces belong to a group.
 *
 * This previously split into two: the stream page grouped cards with a loose,
 * owner-agnostic regex on concept_ref, while the hub/delete matched on the exact
 * owner-scoped concept-bank key. When those disagreed (a concept_ref that embeds
 * a different owner, or a non-standard path), a card would show on the stream
 * page but its hub was empty and its Delete was a silent no-op, i.e. an
 * undeletable in-development item. Keying everything off `groupKeyOf` fixes that
 * by construction: whatever the stream page groups under a slug, the hub and
 * delete operate on exactly those pieces. The piece set is already owner-scoped
 * by listSavedPieces(owner), and slugs are unique per owner, so dropping the
 * owner from the match introduces no cross-owner collision.
 */

import type { MarketingPiece } from './piece-store';

/**
 * The dev-group key for a piece. Concept-backed pieces group by the slug inside
 * their concept_ref; pre-concept-bank pieces group by their ref tail, or failing
 * that their own id (so a ref-less piece still gets its own hub).
 */
export function groupKeyOf(p: MarketingPiece): string {
  const m = p.concept_ref?.match(/core-concept-(.+)\.md$/);
  if (m) return m[1];
  const tail = p.concept_ref?.split('/').filter(Boolean).pop();
  return tail || p.piece_id;
}

/** Whether a piece belongs to the dev group at `slug`. */
export function pieceInDevGroup(p: MarketingPiece, slug: string): boolean {
  return groupKeyOf(p) === slug;
}
