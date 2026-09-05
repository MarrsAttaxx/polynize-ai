/**
 * THE SITE'S NUMBERS, KEPT (D98). One file, `pam/analytics/site.json`, holding the latest pull for
 * every range the panel offers. A cache, not a ledger, like the per-stream analytics store: a lost
 * file costs one pull. Same bucket-or-interim dispatch. Server-side only.
 */

import { getSheetState, saveSheetState } from '@/lib/content/shoot-sheet-store';
import { isBucketConfigured, getObjectText, putObjectText } from '@/lib/agents/bucket';
import { normalizeSiteAnalytics, type SiteAnalytics } from './site-analytics';

const KEY = 'pam/analytics/site.json';

export async function getSiteAnalytics(): Promise<SiteAnalytics | null> {
  try {
    if (isBucketConfigured()) {
      const text = await getObjectText(KEY);
      return text ? normalizeSiteAnalytics(JSON.parse(text)) : null;
    }
    const row = await getSheetState(KEY);
    return row ? normalizeSiteAnalytics(row) : null;
  } catch (err) {
    console.error('[site-analytics.store] read failed:', err);
    return null;
  }
}

export async function saveSiteAnalytics(value: SiteAnalytics): Promise<void> {
  if (isBucketConfigured()) {
    await putObjectText(KEY, JSON.stringify(value, null, 2));
    return;
  }
  await saveSheetState(KEY, value as unknown as Record<string, unknown>);
}
