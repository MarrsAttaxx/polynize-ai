import { getSheetState, saveSheetState } from '@/lib/content/shoot-sheet-store';
import { isBucketConfigured, getObjectText, putObjectText } from '@/lib/agents/bucket';

/**
 * WHO GETS PINGED when a lead lands in a CRM.
 *
 * Marrs: "we can work out a way to ping the individual when the lead comes in so they
 * have a direct link back to the CRM. For instance if a new lead comes in on Polynize,
 * Shourov and I get pinged on email."
 *
 * Stored as config the console edits, NOT as environment variables. Two reasons: adding
 * a recipient should not need a redeploy, and I should never be the one typing a
 * colleague's address into a repo or a Vercel dashboard. Marrs fills this in himself.
 *
 * Same bucket-or-interim dispatch as the Metricool config, so it lives beside the other
 * team-level settings rather than inventing a third storage pattern. Server-side only.
 */

/** stream id -> the addresses to notify for that stream's CRM. */
export type NotifyMap = Record<string, string[]>;

const KEY = 'pam/config/crm-notify.json';

/** A loose check, deliberately. It only has to stop obvious nonsense reaching Resend. */
function looksLikeEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

function normalize(x: unknown): NotifyMap {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return {};
  const out: NotifyMap = {};
  for (const [stream, v] of Object.entries(x as Record<string, unknown>)) {
    const list = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,\s]+/) : [];
    const clean = [
      ...new Set(
        list
          .map((e) => (typeof e === 'string' ? e.trim().toLowerCase() : ''))
          .filter((e) => e !== '' && looksLikeEmail(e))
      ),
      // Capped so a paste accident cannot turn one lead into a hundred emails.
    ].slice(0, 20);
    if (clean.length > 0) out[stream] = clean;
  }
  return out;
}

export async function getNotifyMap(): Promise<NotifyMap> {
  try {
    if (isBucketConfigured()) {
      const text = await getObjectText(KEY);
      return text ? normalize(JSON.parse(text) as unknown) : {};
    }
    const s = await getSheetState(KEY);
    return normalize((s as { notify?: unknown } | null)?.notify);
  } catch (e) {
    // Empty, not thrown. Nobody being notified is bad; a lead failing to save because
    // the notify config could not be read would be much worse.
    console.error(
      `[crm-notify] read failed, treating as empty: ${e instanceof Error ? e.message : String(e)}`
    );
    return {};
  }
}

export async function saveNotifyMap(map: NotifyMap): Promise<void> {
  const clean = normalize(map);
  if (isBucketConfigured()) {
    await putObjectText(KEY, JSON.stringify(clean, null, 2));
  } else {
    await saveSheetState(KEY, { notify: clean });
  }
}

/** Parse a textarea or comma-separated field into the stored list. */
export function parseRecipients(raw: string): string[] {
  return normalize({ x: raw.split(/[,\n;]+/) }).x ?? [];
}
