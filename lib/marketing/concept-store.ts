/**
 * Concept bank persistence — Phase-1 INTERIM.
 *
 * The concept doc (`core-concept-{framing}.md`) is the intake screen's output and
 * the input to the rest of the spine. Its durable home is the polynize-agents
 * bucket at `pam/concept-bank/{owner}/core-concept-{framing-slug}.md` (see
 * docs/pam-console/agent-socket-contract.md §5). Until the bucket access keys
 * land, the body rides the existing content_shoot_sheets table under the SAME KEY
 * as the eventual bucket object key, so the swap to S3 is a store-internal change
 * (read/write the object instead of the row) with no caller change.
 *
 * Owner key = signed-in email (D16 / confirmed). `@` and `.` are valid in both
 * S3 keys and our interim keys, so no slug mapping is needed.
 *
 * Server-side only.
 */

import { getSheetState, saveSheetState } from '@/lib/content/shoot-sheet-store';
import { supabaseService } from '@/lib/supabase';

export type ConceptDoc = {
  /** The storage key === the eventual bucket object key. Stable identity. */
  concept_ref: string;
  owner: string;
  stream: string;
  framing: string;
  framing_slug: string;
  title: string;
  body_md: string;
  created_at: string;
  updated_at: string;
};

/** Slugify a framing into a filename-safe, url-safe token. */
export function framingSlug(framing: string): string {
  return framing
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** The canonical bucket-path key for a concept doc (used verbatim as the S3 key later). */
export function conceptKey(owner: string, slug: string): string {
  return `pam/concept-bank/${owner}/core-concept-${slug}.md`;
}

function isConceptDoc(x: unknown): x is ConceptDoc {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const c = x as Record<string, unknown>;
  const str = (v: unknown) => typeof v === 'string' && v.length > 0;
  return (
    str(c.concept_ref) &&
    str(c.owner) &&
    str(c.framing) &&
    str(c.framing_slug) &&
    str(c.title) &&
    typeof c.body_md === 'string'
  );
}

export async function saveConcept(doc: {
  owner: string;
  stream: string;
  framing: string;
  title: string;
  body_md: string;
}): Promise<ConceptDoc> {
  const baseSlug = framingSlug(doc.framing);
  if (!baseSlug) throw new Error('framing produced an empty slug');
  const framing = doc.framing.trim();

  // Resolve the target key. Distinct framings can normalize to the same slug
  // (case/punctuation/whitespace, or shared 80-char prefixes), so we must not
  // blind-upsert on baseSlug or one silently overwrites the other. Walk
  // baseSlug, baseSlug-2, baseSlug-3, ... and take the first slot that is either
  // free OR already holds THIS exact framing (a re-finalize updates in place).
  // Interim note: this read-then-upsert is not atomic (the interim store is
  // last-write-wins with no conditional insert), so two same-owner finalizes of
  // two distinct-but-colliding framings within the same sub-second window could
  // still clobber. Acceptable for the small-team interim; when the bucket store
  // lands, acquire slots with a conditional put (ON CONFLICT DO NOTHING).
  let slug = baseSlug;
  let existing: ConceptDoc | null = null;
  for (let n = 1; n <= 50; n++) {
    const candidate = n === 1 ? baseSlug : `${baseSlug}-${n}`;
    const found = await getSheetState(conceptKey(doc.owner, candidate));
    if (!isConceptDoc(found)) {
      slug = candidate;
      existing = null;
      break;
    }
    if (found.framing.trim() === framing) {
      slug = candidate;
      existing = found;
      break;
    }
    if (n === 50) throw new Error('too many concept-slug collisions for this framing');
  }

  const key = conceptKey(doc.owner, slug);
  const now = new Date().toISOString();
  const record: ConceptDoc = {
    concept_ref: key,
    owner: doc.owner,
    stream: doc.stream,
    framing,
    framing_slug: slug,
    title: doc.title,
    body_md: doc.body_md,
    created_at: existing ? existing.created_at : now,
    updated_at: now,
  };
  await saveSheetState(key, record);
  return record;
}

/** Load one concept for this owner by framing slug, or null. */
export async function getConcept(owner: string, slug: string): Promise<ConceptDoc | null> {
  const s = await getSheetState(conceptKey(owner, slug));
  return isConceptDoc(s) ? s : null;
}

/**
 * List this owner's concepts for the dashboard. Owner-scoped (matches the key
 * prefix) and malformed rows are dropped. Interim: scans content_shoot_sheets
 * keys under `pam/concept-bank/{owner}/`. When the bucket lands this becomes a
 * prefix ListObjects call.
 */
export async function listConcepts(owner: string): Promise<ConceptDoc[]> {
  const prefix = `pam/concept-bank/${owner}/`;
  const { data, error } = await supabaseService()
    .from('content_shoot_sheets')
    .select('episode_id, state')
    .like('episode_id', 'pam/concept-bank/%');
  if (error) throw new Error(`concept list failed: ${error.message}`);
  return (data ?? [])
    .filter((r) => {
      const id = (r as { episode_id?: unknown }).episode_id;
      return typeof id === 'string' && id.startsWith(prefix);
    })
    .map((r) => (r as { state: unknown }).state)
    .filter(isConceptDoc)
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}
