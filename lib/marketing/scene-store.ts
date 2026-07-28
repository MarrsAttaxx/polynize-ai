/**
 * Scene persistence (D31). A scene is stored as its DATA (concept, nodes, facts, close),
 * never as rendered HTML, so every improvement to the scene engine lifts every scene
 * that already exists without a regeneration or a single LLM call.
 *
 * Keyed by PIECE ID ALONE (`pam/scenes/{pieceId}.json`), deliberately unlike the other
 * marketing stores which are owner- or stream-scoped. The studio machine opens the scene
 * from an unlisted URL with no console login, so the route that serves it cannot know an
 * owner. The piece id is a uuid, so the URL is unguessable, and the content is
 * pre-publication marketing material rather than anything sensitive (Marrs's call).
 *
 * Rides the same bucket-or-interim dispatch as the other stores. Server-side only.
 */

import { getSheetState, saveSheetState } from '@/lib/content/shoot-sheet-store';
import { isBucketConfigured, getObjectText, putObjectText } from '@/lib/agents/bucket';
import type { Scene } from './scene';

export function sceneKey(pieceId: string): string {
  return `pam/scenes/${pieceId}.json`;
}

function isScene(x: unknown): x is Scene {
  if (!x || typeof x !== 'object') return false;
  const s = x as { concept?: unknown; nodes?: unknown };
  return typeof s.concept === 'string' && Array.isArray(s.nodes);
}

export async function saveScene(pieceId: string, scene: Scene): Promise<void> {
  const key = sceneKey(pieceId);
  if (isBucketConfigured()) {
    await putObjectText(key, JSON.stringify(scene));
  } else {
    await saveSheetState(key, scene as unknown as Record<string, unknown>);
  }
}

/** Read a scene, or null when there is none / the stored row is malformed. */
export async function getScene(pieceId: string): Promise<Scene | null> {
  const key = sceneKey(pieceId);
  try {
    if (isBucketConfigured()) {
      const text = await getObjectText(key);
      if (!text) return null;
      const parsed: unknown = JSON.parse(text);
      return isScene(parsed) ? parsed : null;
    }
    const state = await getSheetState(key);
    return isScene(state) ? state : null;
  } catch (err) {
    console.error('[scene-store] read failed:', err);
    return null;
  }
}
