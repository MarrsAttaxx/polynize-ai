/**
 * Deck persistence (D29). A deck is stored as its STATES, not as rendered HTML, so
 * every improvement to the deck engine lifts every deck that already exists.
 *
 * Keyed by PIECE ID ALONE (`pam/decks/{pieceId}.json`), deliberately unlike the other
 * marketing stores which are owner- or stream-scoped. The studio machine opens the
 * deck from an unlisted URL with no console login, so the route that serves it cannot
 * know an owner. The piece id is a uuid, so the URL is unguessable, and the content is
 * pre-publication marketing material rather than anything sensitive (Marrs's call).
 *
 * Rides the same bucket-or-interim dispatch as the other stores. Server-side only.
 */

import { getSheetState, saveSheetState } from '@/lib/content/shoot-sheet-store';
import {
  isBucketConfigured,
  getObjectText,
  putObjectText,
} from '@/lib/agents/bucket';
import type { Deck } from './deck';

export function deckKey(pieceId: string): string {
  return `pam/decks/${pieceId}.json`;
}

function isDeck(x: unknown): x is Deck {
  if (!x || typeof x !== 'object') return false;
  const d = x as { title?: unknown; states?: unknown };
  return typeof d.title === 'string' && Array.isArray(d.states);
}

export async function saveDeck(pieceId: string, deck: Deck): Promise<void> {
  const key = deckKey(pieceId);
  if (isBucketConfigured()) {
    await putObjectText(key, JSON.stringify(deck));
  } else {
    await saveSheetState(key, deck as unknown as Record<string, unknown>);
  }
}

/** Read a deck, or null when there is none / the stored row is malformed. */
export async function getDeck(pieceId: string): Promise<Deck | null> {
  const key = deckKey(pieceId);
  try {
    if (isBucketConfigured()) {
      const text = await getObjectText(key);
      if (!text) return null;
      const parsed: unknown = JSON.parse(text);
      return isDeck(parsed) ? parsed : null;
    }
    const state = await getSheetState(key);
    return isDeck(state) ? state : null;
  } catch (err) {
    console.error('[deck-store] read failed:', err);
    return null;
  }
}
