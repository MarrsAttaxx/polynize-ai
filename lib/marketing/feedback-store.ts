/**
 * WHERE THE NOTES LIVE (D93).
 *
 * ONE FILE, `pam/feedback/notes.json`, for every note at every scope.
 *
 * One rather than one-per-scope or one-per-stream because the review screen needs all of them at
 * once and the count is tiny by design: the cap is eight per scope and in practice he will have a
 * handful. A file per scope would be three reads to answer one question, and a file per stream would
 * be six.
 *
 * NOTHING IS EVER DELETED. Retiring a note stamps `retired_at`, which takes it out of every prompt
 * and leaves it on the review screen. The whole value of this feature is being able to see what has
 * been said to April and what happened to it, and a delete throws away the half that explains the
 * other half.
 *
 * Same bucket-or-interim dispatch as every other store here. Server-side only.
 */

import { randomUUID } from 'node:crypto';
import { getSheetState, saveSheetState } from '@/lib/content/shoot-sheet-store';
import { isBucketConfigured, getObjectText, putObjectText } from '@/lib/agents/bucket';
import { isJobId, type FeedbackNote, type FeedbackScope } from './feedback';

const KEY = 'pam/feedback/notes.json';

/**
 * Tolerant, like every normalize in this codebase: a note written by an older shape degrades to
 * fewer fields rather than taking the review screen or, worse, every draft prompt down with it.
 */
function normalizeNote(raw: unknown): FeedbackNote | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const id = str(o.id);
  const text = str(o.text);
  const at = str(o.at);
  if (!id || !text || !at) return null;
  const scope: FeedbackScope =
    o.scope === 'house' || o.scope === 'stream' || o.scope === 'job' ? o.scope : 'house';
  return {
    id,
    at,
    by: str(o.by) ?? 'unknown',
    text,
    scope,
    stream: str(o.stream),
    job: isJobId(o.job) ? o.job : undefined,
    /** Anything that is not explicitly a defect is a rule, so a bad value cannot silence a note. */
    kind: o.kind === 'defect' ? 'defect' : 'rule',
    retired_at: str(o.retired_at),
    from: str(o.from),
  };
}

export async function listNotes(): Promise<FeedbackNote[]> {
  try {
    const raw = isBucketConfigured()
      ? JSON.parse((await getObjectText(KEY)) || '{"notes":[]}')
      : ((await getSheetState(KEY)) ?? { notes: [] });
    const arr = (raw as { notes?: unknown }).notes;
    return Array.isArray(arr)
      ? arr.map(normalizeNote).filter((n): n is FeedbackNote => n !== null)
      : [];
  } catch (err) {
    /**
     * A READ FAILURE COSTS THE NOTES AND NOTHING ELSE. Every caller treats an empty list as "no
     * corrections", which is exactly the behaviour the system had before this existed. Feedback must
     * never be able to stop a draft: the worst case is one draft written without his corrections,
     * not a draft that fails.
     */
    console.error('[feedback] read failed, drafting without corrections:', err);
    return [];
  }
}

async function writeAll(notes: FeedbackNote[]): Promise<void> {
  const payload = { notes };
  if (isBucketConfigured()) {
    await putObjectText(KEY, JSON.stringify(payload, null, 2));
    return;
  }
  await saveSheetState(KEY, payload as unknown as Record<string, unknown>);
}

/**
 * Add one note. Read-merge-write, because two chat windows in two tabs are a real thing and the
 * loser of a plain write would lose a note he watched being confirmed.
 */
export async function addNote(
  note: Omit<FeedbackNote, 'id' | 'at'> & { id?: string; at?: string }
): Promise<FeedbackNote> {
  const full: FeedbackNote = {
    ...note,
    id: note.id ?? randomUUID(),
    at: note.at ?? new Date().toISOString(),
  };
  const all = await listNotes();
  await writeAll([...all, full]);
  return full;
}

/** Retire, revive, re-scope, or mark as a defect. Anything the review screen can do. */
export async function updateNote(
  id: string,
  patch: Partial<Pick<FeedbackNote, 'scope' | 'stream' | 'job' | 'kind' | 'retired_at'>>
): Promise<FeedbackNote | null> {
  const all = await listNotes();
  const ix = all.findIndex((n) => n.id === id);
  if (ix === -1) return null;
  /**
   * A SCOPE CHANGE CLEARS THE FIELDS THE OLD SCOPE OWNED. Widening a job note to the house and
   * leaving its `job` set would leave a note that reads as both, and the next reader would have to
   * guess which field wins.
   */
  const next: FeedbackNote = { ...all[ix], ...patch };
  /**
   * REVIVING means the key is GONE, not set to undefined: this object is JSON.stringified into the
   * store, and `undefined` survives a spread but not a serialise, so leaving it would work by
   * accident today and break the day something reads the in-memory object instead.
   */
  if ('retired_at' in patch && patch.retired_at === undefined) delete next.retired_at;
  if (patch.scope === 'house') {
    next.stream = undefined;
    next.job = undefined;
  }
  if (patch.scope === 'stream') next.job = undefined;
  all[ix] = next;
  await writeAll(all);
  return next;
}
