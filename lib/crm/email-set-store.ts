import { getSheetState, saveSheetState } from '@/lib/content/shoot-sheet-store';
import { isBucketConfigured, getObjectText, putObjectText } from '@/lib/agents/bucket';

/**
 * A per-owner set of email addresses, persisted as config.
 *
 * Two features need exactly this and nothing more: the addresses waved away as "not a lead",
 * and the addresses a daily digest has already mentioned. Rather than two near-identical
 * sixty-line stores, this is the shape once, keyed by file.
 *
 * Only addresses are ever stored. No reasons, no meeting titles, nothing about the meeting
 * itself, which stays in Fireflies.
 *
 * Same bucket-or-interim dispatch as the other team-level config. Server-side only.
 */

export type EmailSetMap = Record<string, string[]>;

/** Bounded, so a set cannot grow without limit and slow every read down. */
const MAX_PER_OWNER = 2000;

function normalize(x: unknown): EmailSetMap {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return {};
  const out: EmailSetMap = {};
  for (const [owner, v] of Object.entries(x as Record<string, unknown>)) {
    const list = Array.isArray(v) ? v : [];
    const clean = [
      ...new Set(
        list
          .map((e) => (typeof e === 'string' ? e.trim().toLowerCase() : ''))
          .filter((e) => e !== '' && e.includes('@'))
      ),
    ].slice(-MAX_PER_OWNER); // Keep the most recent, since old entries matter least.
    if (clean.length > 0) out[owner] = clean;
  }
  return out;
}

async function readMap(file: string): Promise<EmailSetMap> {
  if (isBucketConfigured()) {
    return normalize(JSON.parse((await getObjectText(file)) || '{}') as unknown);
  }
  const s = (await getSheetState(file)) as { set?: unknown } | null;
  return normalize(s?.set);
}

async function writeMap(file: string, map: EmailSetMap): Promise<void> {
  const clean = normalize(map);
  if (isBucketConfigured()) {
    await putObjectText(file, JSON.stringify(clean, null, 2));
  } else {
    await saveSheetState(file, { set: clean });
  }
}

/**
 * One owner's set.
 *
 * Returns empty on any read failure rather than throwing. For both callers the cost of an
 * unreadable file is small (a candidate reappears, or a digest repeats itself once) and the
 * cost of throwing is the whole feature failing.
 */
export async function getEmailSet(file: string, owner: string): Promise<Set<string>> {
  try {
    return new Set((await readMap(file))[owner] ?? []);
  } catch (e) {
    console.error(
      `[email-set] read of ${file} failed, treating as empty: ${e instanceof Error ? e.message : String(e)}`
    );
    return new Set();
  }
}

/**
 * Add addresses to one owner's set.
 *
 * READ, MERGE, WRITE, because the file holds every owner and writing one key alone would
 * erase the others.
 */
export async function addToEmailSet(
  file: string,
  owner: string,
  emails: string[]
): Promise<void> {
  const raw = await readMap(file);
  const merged = new Set([
    ...(raw[owner] ?? []),
    ...emails.map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@')),
  ]);
  await writeMap(file, { ...raw, [owner]: [...merged] });
}
