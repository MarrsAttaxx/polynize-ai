/**
 * Concept bank persistence.
 *
 * The concept doc (`core-concept-{framing}.md`) is the intake screen's output and
 * the input to the rest of the spine. Durable home: the polynize-agents bucket at
 * `pam/concept-bank/{owner}/core-concept-{framing-slug}.md` (agent-socket-contract §5).
 *
 * Backend is chosen at runtime: when the bucket is configured (AGENTS_S3_*), docs
 * are real Markdown files with a small frontmatter block (human-readable in the
 * bucket, metadata inline). Otherwise they ride the interim content_shoot_sheets
 * table under the SAME KEY (= the eventual S3 object key), so the swap to S3 is a
 * config flip with no caller change.
 *
 * Owner key = signed-in email (D16). `@`/`.` are valid in both S3 and interim keys.
 * Server-side only.
 */

import { getSheetState, saveSheetState } from '@/lib/content/shoot-sheet-store';
import { supabaseService } from '@/lib/supabase';
import {
  isBucketConfigured,
  getObjectText,
  putObjectText,
  listKeys,
} from '@/lib/agents/bucket';

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

/** The canonical bucket-path key for a concept doc (used verbatim as the S3 key). */
export function conceptKey(owner: string, slug: string): string {
  return `pam/concept-bank/${owner}/core-concept-${slug}.md`;
}

function slugFromKey(key: string): string {
  const m = key.match(/core-concept-(.+)\.md$/);
  return m ? m[1] : '';
}
function ownerFromKey(key: string): string {
  const m = key.match(/^pam\/concept-bank\/(.+?)\/core-concept-/);
  return m ? m[1] : '';
}

export function isConceptDoc(x: unknown): x is ConceptDoc {
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

// --- Markdown-with-frontmatter (de)serialization for the S3 backend ----------

function serializeConcept(r: ConceptDoc): string {
  const meta: Record<string, string> = {
    owner: r.owner,
    stream: r.stream,
    framing: r.framing,
    framing_slug: r.framing_slug,
    title: r.title,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
  // JSON-encode each value so colons/quotes/newlines in a framing can't corrupt
  // the frontmatter.
  const fm = Object.entries(meta)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join('\n');
  return `---\n${fm}\n---\n\n${r.body_md}\n`;
}

function parseConcept(text: string, key: string): ConceptDoc | null {
  const meta: Record<string, string> = {};
  let body = text;
  // Match the frontmatter block exactly: `---\n <fm> \n---\n`.
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (fm) {
    for (const line of fm[1].split(/\r?\n/)) {
      const i = line.indexOf(':');
      if (i === -1) continue;
      const k = line.slice(0, i).trim();
      const raw = line.slice(i + 1).trim();
      try {
        const v = JSON.parse(raw);
        if (typeof v === 'string') meta[k] = v;
      } catch {
        meta[k] = raw;
      }
    }
    // Body follows the frontmatter block. serializeConcept writes exactly one
    // blank-line separator and one trailing newline; strip exactly those (one
    // leading + one trailing newline), NOT greedily, so a body that legitimately
    // begins or ends with blank lines round-trips byte-exact.
    body = text.slice(fm[0].length);
    if (body.startsWith('\n')) body = body.slice(1);
    if (body.endsWith('\n')) body = body.slice(0, -1);
  }
  const slug = meta.framing_slug || slugFromKey(key);
  const record: ConceptDoc = {
    concept_ref: key,
    owner: meta.owner || ownerFromKey(key),
    stream: meta.stream || 'polynize',
    framing: meta.framing || meta.title || slug,
    framing_slug: slug,
    title: meta.title || meta.framing || slug,
    body_md: body,
    created_at: meta.created_at || '',
    updated_at: meta.updated_at || '',
  };
  return isConceptDoc(record) ? record : null;
}

// --- Backend-dispatching raw read/write -------------------------------------

async function readConceptAt(key: string): Promise<ConceptDoc | null> {
  if (isBucketConfigured()) {
    const text = await getObjectText(key);
    return text ? parseConcept(text, key) : null;
  }
  const s = await getSheetState(key);
  return isConceptDoc(s) ? s : null;
}

async function writeConceptAt(key: string, record: ConceptDoc): Promise<void> {
  if (isBucketConfigured()) {
    await putObjectText(key, serializeConcept(record));
  } else {
    await saveSheetState(key, record);
  }
}

// --- Public API --------------------------------------------------------------

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
  // blind-write baseSlug or one silently overwrites the other. Walk baseSlug,
  // baseSlug-2, ... and take the first slot that is free OR already holds THIS
  // exact framing (a re-finalize updates in place).
  // Interim note: read-then-write is not atomic (neither the interim upsert nor a
  // plain S3 put is a conditional insert), so two same-owner finalizes of two
  // distinct-but-colliding framings within the same sub-second window could still
  // clobber. Acceptable for the small-team interim; revisit with a conditional put.
  let slug = baseSlug;
  let existing: ConceptDoc | null = null;
  for (let n = 1; n <= 50; n++) {
    const candidate = n === 1 ? baseSlug : `${baseSlug}-${n}`;
    const found = await readConceptAt(conceptKey(doc.owner, candidate));
    if (!found) {
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
  await writeConceptAt(key, record);
  return record;
}

/** Load one concept for this owner by framing slug, or null. */
export async function getConcept(owner: string, slug: string): Promise<ConceptDoc | null> {
  return readConceptAt(conceptKey(owner, slug));
}

/**
 * List this owner's concepts for the dashboard. Owner-scoped; malformed rows are
 * dropped. S3 backend lists the owner's prefix; interim scans content_shoot_sheets.
 */
export async function listConcepts(owner: string): Promise<ConceptDoc[]> {
  const prefix = `pam/concept-bank/${owner}/`;
  let docs: ConceptDoc[] = [];
  if (isBucketConfigured()) {
    const keys = (await listKeys(prefix)).filter((k) => k.endsWith('.md'));
    for (const k of keys) {
      const d = await readConceptAt(k);
      if (d) docs.push(d);
    }
  } else {
    const { data, error } = await supabaseService()
      .from('content_shoot_sheets')
      .select('episode_id, state')
      .like('episode_id', 'pam/concept-bank/%');
    if (error) throw new Error(`concept list failed: ${error.message}`);
    docs = (data ?? [])
      .filter((r) => {
        const id = (r as { episode_id?: unknown }).episode_id;
        return typeof id === 'string' && id.startsWith(prefix);
      })
      .map((r) => (r as { state: unknown }).state)
      .filter(isConceptDoc);
  }
  return docs.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}
