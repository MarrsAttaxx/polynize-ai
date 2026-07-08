/**
 * Per-STREAM brand voice (D20). A concept is *for* a stream regardless of who is
 * signed in, so the voice follows the stream (Polynize / Marrs / Shourov / …),
 * not the owner email. Content creation in a stream reads this: concept synthesis
 * (finalize), the interview register (converse), and post authoring (text-draft).
 *
 * Durable home: the polynize-agents bucket at
 * `pam/brand-voice-docs/{stream}/brand-voice.md` (one canonical, editable doc per
 * stream). Backend is chosen at runtime like the concept store: real Markdown in
 * the bucket when configured, else the interim content_shoot_sheets row under the
 * SAME KEY, so the S3 swap is a config flip with no caller change.
 *
 * DORMANT-safe: a missing doc or a transient backend error degrades to undefined
 * (content is produced without the personal register), never an exception.
 * Server-side only.
 */

import { getSheetState, saveSheetState } from '@/lib/content/shoot-sheet-store';
import { isBucketConfigured, getObjectText, putObjectText } from '@/lib/agents/bucket';

/** The canonical bucket-path key for a stream's brand-voice doc (used verbatim as the S3 key). */
export function brandVoiceKey(stream: string): string {
  return `pam/brand-voice-docs/${stream}/brand-voice.md`;
}

/**
 * The stream's brand-voice Markdown, or undefined if none is set. Advisory
 * conditioning: any backend error degrades to undefined so it can never abort the
 * interview, a concept synthesis, or a draft.
 */
export async function getBrandVoiceForStream(stream: string): Promise<string | undefined> {
  const key = brandVoiceKey(stream);
  try {
    if (isBucketConfigured()) {
      const text = await getObjectText(key);
      return text && text.trim() ? text : undefined;
    }
    const s = await getSheetState(key);
    const md = (s as { md?: unknown } | null)?.md;
    return typeof md === 'string' && md.trim() ? md : undefined;
  } catch (e) {
    console.error(
      `[brand-voice] read failed for stream ${stream}, continuing without it: ${
        e instanceof Error ? e.message : String(e)
      }`
    );
    return undefined;
  }
}

/** Upsert the stream's brand-voice doc. Writes raw Markdown to the bucket, or the
 * interim row under the same key. Throws on write failure (the editor surfaces it). */
export async function saveBrandVoiceForStream(stream: string, md: string): Promise<void> {
  const key = brandVoiceKey(stream);
  if (isBucketConfigured()) {
    await putObjectText(key, md);
  } else {
    await saveSheetState(key, { md });
  }
}
