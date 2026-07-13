/**
 * The development-hub grouping predicate, shared by the hub page and the adopt
 * route so they can never disagree about which pieces belong to a group.
 *
 * A piece belongs to the hub at `slug` when its concept_ref is the owner's
 * concept-bank key for that slug, or (for pre-concept-bank pieces) when its
 * non-bank ref's tail or its piece id equals the slug.
 */

import type { MarketingPiece } from './piece-store';
import { conceptKey } from './concept-store';

export function pieceInDevGroup(
  p: MarketingPiece,
  owner: string,
  slug: string
): boolean {
  if (p.concept_ref === conceptKey(owner, slug)) return true;
  if (/core-concept-.+\.md$/.test(p.concept_ref ?? '')) return false;
  const tail = p.concept_ref?.split('/').filter(Boolean).pop();
  return tail === slug || p.piece_id === slug;
}
