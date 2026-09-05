/**
 * WHICH AUTOLIST IS OURS (D100). One Metricool autolist per stream per network, created the first
 * time a post on that stream and network is promoted, remembered here so the second promotion
 * joins the same list. `pam/config/autolists.json`. Same bucket-or-interim dispatch as the other
 * config stores; server-side only.
 *
 * Keyed by stream then network. The value is Metricool's list id as a string plus when we made it,
 * so a list someone deleted in Metricool's UI can be recognised (their read 404s) and remade.
 */

import { getSheetState, saveSheetState } from '@/lib/content/shoot-sheet-store';
import { isBucketConfigured, getObjectText, putObjectText } from '@/lib/agents/bucket';

const KEY = 'pam/config/autolists.json';

export type AutolistRef = { list_id: string; created_at: string };
export type AutolistMap = Record<string, Record<string, AutolistRef>>;

export async function getAutolists(): Promise<AutolistMap> {
  try {
    const raw = isBucketConfigured() ? await getObjectText(KEY) : null;
    const parsed = raw ? JSON.parse(raw) : isBucketConfigured() ? null : await getSheetState(KEY);
    return normalize(parsed);
  } catch (err) {
    console.error('[autolist.store] read failed:', err);
    return {};
  }
}

export async function saveAutolists(map: AutolistMap): Promise<void> {
  if (isBucketConfigured()) {
    await putObjectText(KEY, JSON.stringify(map, null, 2));
    return;
  }
  await saveSheetState(KEY, map as unknown as Record<string, unknown>);
}

function normalize(raw: unknown): AutolistMap {
  const out: AutolistMap = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [stream, nets] of Object.entries(raw as Record<string, unknown>)) {
    if (!nets || typeof nets !== 'object') continue;
    for (const [network, ref] of Object.entries(nets as Record<string, unknown>)) {
      if (!ref || typeof ref !== 'object') continue;
      const r = ref as Record<string, unknown>;
      if (typeof r.list_id !== 'string' || !r.list_id) continue;
      out[stream] = out[stream] ?? {};
      out[stream][network] = { list_id: r.list_id, created_at: typeof r.created_at === 'string' ? r.created_at : '' };
    }
  }
  return out;
}
