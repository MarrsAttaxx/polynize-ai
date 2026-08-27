/**
 * Client-side persistence helpers. Fire-and-forget — failures are
 * logged but never thrown into the UI; localStorage remains the
 * authoritative client-side cache while the visitor is in-flight.
 *
 * The httpOnly session cookie is attached automatically by fetch.
 */

import type { Answers, CapabilityMapV05 } from './types';

async function silentPost(path: string, body: unknown): Promise<void> {
  try {
    await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
    });
  } catch (e) {
     
    console.warn(`[persist] ${path} failed`, e);
  }
}

export function persistAnswers(answers: Partial<Answers>, completed: boolean): void {
  void silentPost('/api/session/answers', { answers, completed });
}

export function persistCapabilityMap(data: CapabilityMapV05): void {
  void silentPost('/api/session/capability-map', { data });
}

export async function createBlueprint(): Promise<{ id: string } | { error: string }> {
  try {
    const res = await fetch('/api/blueprints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { error: body.error ?? `HTTP ${res.status}` };
    }
    const body = (await res.json()) as { id: string };
    return { id: body.id };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/**
 * Awaitable end-of-Phase-B chain: persists the capability map server-side,
 * then upserts the blueprint row, then returns the blueprint id (or an
 * error). Caller awaits this so it can render the share/CTA buttons with
 * the resulting URL.
 *
 * /api/blueprints reads from the capability_maps table, so the persist call
 * must complete BEFORE we hit the create endpoint — that's why this is a
 * single awaitable function instead of two fire-and-forgets.
 */
export async function completeBlueprintFlow(
  data: CapabilityMapV05
): Promise<{ id: string } | { error: string }> {
  // 1. Persist the capability map (awaited).
  try {
    const res = await fetch('/api/session/capability-map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
      credentials: 'same-origin',
    });
    if (!res.ok) {
      return { error: `capability-map persist failed: HTTP ${res.status}` };
    }
  } catch (e) {
    return { error: `capability-map persist threw: ${(e as Error).message}` };
  }

  // 2. Create the blueprint (this also fires the Scout webhook server-side).
  return createBlueprint();
}
