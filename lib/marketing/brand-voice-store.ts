/**
 * The owner's personal brand-voice doc, read from the polynize-agents bucket at
 * pam/brand-voice-docs/{owner}/ (D2 / D16). Used to condition April's console-run
 * interview in the owner's register.
 *
 * DORMANT-safe: if the bucket is not configured, returns undefined and the
 * interview runs without the personal register (same as the interim flow today).
 * Server-side only.
 */

import { isBucketConfigured, getObjectText, listKeys } from '@/lib/agents/bucket';

/**
 * Concatenate the owner's brand-voice markdown docs (filenames are not fixed, so
 * we read every .md under the owner's prefix). Returns undefined if the bucket is
 * unconfigured or the owner has no docs.
 */
export async function getBrandVoice(owner: string): Promise<string | undefined> {
  if (!isBucketConfigured()) return undefined;
  // Brand voice is advisory conditioning. A transient bucket error (throttling,
  // rotated creds, network blip) must NOT abort the interview or the concept doc;
  // degrade to no personal register, exactly as when the doc is absent.
  try {
    const prefix = `pam/brand-voice-docs/${owner}/`;
    const keys = (await listKeys(prefix)).filter((k) => k.toLowerCase().endsWith('.md'));
    if (keys.length === 0) return undefined;
    const parts: string[] = [];
    for (const key of keys) {
      const text = await getObjectText(key);
      if (text && text.trim()) parts.push(text.trim());
    }
    const joined = parts.join('\n\n---\n\n');
    return joined.length > 0 ? joined : undefined;
  } catch (e) {
    console.error(
      `[brand-voice] read failed for ${owner}, continuing without it: ${
        e instanceof Error ? e.message : String(e)
      }`
    );
    return undefined;
  }
}
