/**
 * PREZIE persistence (D31 amended 2026-08-01). A prezie is the interactive presentation
 * the presenter operates on the touchscreen: the scene DATA plus who it belongs to.
 *
 * Two changes from the per-piece scene store this replaces, both from Marrs using it:
 *
 * 1. A PREZIE BELONGS TO THE CONCEPT, not to a piece. "The concept has a collection of
 *    all the interfaces that are built, and in the piece itself you have the ones
 *    created specifically for that piece." A concept is a living document that many
 *    pieces draw from, and the same prezie gets reused: a short today, a podcast segment
 *    later, a talk after that. Keying it to one piece made it a throwaway.
 *
 * 2. PREZIES ARE VERSIONED AND NEVER OVERWRITTEN BY GENERATION. Generating produces a
 *    NEW prezie; only a hand edit updates one in place. Marrs: "I'm happier to have
 *    iterations of the interface, and all of them ready for me to click on." It also
 *    removes a whole class of loss: a regeneration can no longer eat the version that
 *    was working.
 *
 * Keyed `pam/prezies/{concept}/{prezieId}.json`. Nested by concept so listing one
 * concept's prezies is a bounded prefix read rather than a scan of every prezie in the
 * system, which is why the concept appears in the performance URL too. The prezie id is
 * a uuid, so an unlisted link stays unguessable and the route that serves it needs no
 * owner: the studio machine opens it with no console login.
 *
 * Server-side only.
 */

import { getSheetState, saveSheetState, deleteSheetState } from '@/lib/content/shoot-sheet-store';
import { isBucketConfigured, getObjectText, putObjectText, deleteObject, listKeys } from '@/lib/agents/bucket';
import { supabaseService } from '@/lib/supabase';
import type { Scene } from './scene';

/** Pieces with no concept behind them still need somewhere to live. */
export const UNFILED = '_unfiled';

export type Prezie = {
  /** uuid; also the storage key tail and the id in the performance URL. */
  prezie_id: string;
  /** The concept slug that OWNS this prezie. `_unfiled` when the piece has no concept. */
  concept: string;
  /** The piece it was built for, if any. A prezie can outlive and outgrow that piece. */
  piece_id?: string;
  stream: string;
  owner: string;
  /** Human label in the version list, e.g. "Force multiplier". */
  name: string;
  /** What the engine renders. */
  scene: Scene;
  created_at: string;
  updated_at?: string;
};

const PREFIX = 'pam/prezies';

export function prezieKey(concept: string, id: string): string {
  return `${PREFIX}/${concept}/${id}.json`;
}

export function isPrezie(x: unknown): x is Prezie {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const p = x as Record<string, unknown>;
  const str = (v: unknown) => typeof v === 'string' && v.length > 0;
  const scene = p.scene as { concept?: unknown; nodes?: unknown } | undefined;
  return (
    str(p.prezie_id) &&
    str(p.concept) &&
    Boolean(scene) &&
    typeof scene?.concept === 'string' &&
    Array.isArray(scene?.nodes)
  );
}

async function readAt(key: string): Promise<Prezie | null> {
  if (isBucketConfigured()) {
    const text = await getObjectText(key);
    if (!text) return null;
    const parsed: unknown = JSON.parse(text);
    return isPrezie(parsed) ? parsed : null;
  }
  const state = await getSheetState(key);
  return isPrezie(state) ? state : null;
}

export async function savePrezie(prezie: Prezie): Promise<void> {
  const key = prezieKey(prezie.concept, prezie.prezie_id);
  if (isBucketConfigured()) {
    await putObjectText(key, JSON.stringify(prezie, null, 2));
  } else {
    await saveSheetState(key, prezie as unknown as Record<string, unknown>);
  }
}

export async function getPrezie(concept: string, id: string): Promise<Prezie | null> {
  try {
    return await readAt(prezieKey(concept, id));
  } catch (err) {
    console.error('[prezie-store] read failed:', err);
    return null;
  }
}

export async function deletePrezie(concept: string, id: string): Promise<void> {
  const key = prezieKey(concept, id);
  if (isBucketConfigured()) {
    await deleteObject(key);
  } else {
    await deleteSheetState(key);
  }
}

/** Every prezie built for a concept, newest first. Malformed rows are dropped. */
export async function listPreziesForConcept(concept: string): Promise<Prezie[]> {
  const prefix = `${PREFIX}/${concept}/`;
  let docs: Prezie[] = [];
  try {
    if (isBucketConfigured()) {
      const keys = (await listKeys(prefix)).filter((k) => k.endsWith('.json'));
      for (const k of keys) {
        const p = await readAt(k);
        if (p) docs.push(p);
      }
    } else {
      const { data, error } = await supabaseService()
        .from('content_shoot_sheets')
        .select('episode_id, state')
        .like('episode_id', `${prefix}%`);
      if (error) throw new Error(error.message);
      docs = (data ?? [])
        .map((r) => (r as { state: unknown }).state)
        .filter(isPrezie);
    }
  } catch (err) {
    console.error('[prezie-store] list failed:', err);
    return [];
  }
  return docs.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
}
