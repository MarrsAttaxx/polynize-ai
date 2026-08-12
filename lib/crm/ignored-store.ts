import { getSheetState, saveSheetState } from '@/lib/content/shoot-sheet-store';
import { isBucketConfigured, getObjectText, putObjectText } from '@/lib/agents/bucket';

/**
 * PEOPLE WHO ARE NOT LEADS.
 *
 * Marrs: "we need a delete button because there are some here that I don't need, and I need
 * to be able to delete them or ignore them."
 *
 * Dismissing a Fireflies candidate has to be REMEMBERED, or it is not a dismissal: the scan
 * reads the same recent meetings every time, so anyone waved away would reappear on the next
 * press and the list would never get shorter. That is how a review list becomes something
 * nobody opens.
 *
 * Only an email is stored, never a reason and never anything from the meeting. Everything
 * about the meeting itself stays in Fireflies.
 *
 * Same bucket-or-interim dispatch as the notify config. Server-side only.
 */

/** owner -> the addresses to stop proposing. */
export type IgnoredMap = Record<string, string[]>;

const KEY = 'pam/config/crm-ignored.json';

function normalize(x: unknown): IgnoredMap {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return {};
  const out: IgnoredMap = {};
  for (const [owner, v] of Object.entries(x as Record<string, unknown>)) {
    const list = Array.isArray(v) ? v : [];
    const clean = [
      ...new Set(
        list
          .map((e) => (typeof e === 'string' ? e.trim().toLowerCase() : ''))
          .filter((e) => e !== '' && e.includes('@'))
      ),
      // Bounded, so this cannot grow without limit and slow every scan down.
    ].slice(0, 2000);
    if (clean.length > 0) out[owner] = clean;
  }
  return out;
}

export async function getIgnored(owner: string): Promise<Set<string>> {
  try {
    const map = isBucketConfigured()
      ? normalize(JSON.parse((await getObjectText(KEY)) || '{}') as unknown)
      : normalize((await getSheetState(KEY) as { ignored?: unknown } | null)?.ignored);
    return new Set(map[owner] ?? []);
  } catch (e) {
    // Empty, not thrown. Failing to read this costs a reappearing candidate; failing the
    // whole scan costs the feature.
    console.error(
      `[crm-ignored] read failed, treating as empty: ${e instanceof Error ? e.message : String(e)}`
    );
    return new Set();
  }
}

/** Add addresses to one owner's ignore list. Read, merge, write: the file holds every owner. */
export async function ignoreEmails(owner: string, emails: string[]): Promise<void> {
  const raw = isBucketConfigured()
    ? normalize(JSON.parse((await getObjectText(KEY)) || '{}') as unknown)
    : normalize((await getSheetState(KEY) as { ignored?: unknown } | null)?.ignored);

  const merged = new Set([...(raw[owner] ?? []), ...emails.map((e) => e.trim().toLowerCase())]);
  const next = normalize({ ...raw, [owner]: [...merged] });

  if (isBucketConfigured()) {
    await putObjectText(KEY, JSON.stringify(next, null, 2));
  } else {
    await saveSheetState(KEY, { ignored: next });
  }
}
