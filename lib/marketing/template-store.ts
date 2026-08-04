/**
 * Content Pillar Templates (D25) — per-stream persistence.
 *
 * A template is the creative loop's unit of reuse: it carries the plan (format +
 * platforms + ICP) and the production recipe, so "concept + template" is enough
 * to create content. Stored one JSON doc per template at
 * `pam/content-templates/{stream}/{slug}.json` (bucket when configured, else the
 * interim content_shoot_sheets row under the SAME key, like the concept store).
 *
 * Server-side only.
 */

import {
  getSheetState,
  saveSheetState,
  deleteSheetState,
} from '@/lib/content/shoot-sheet-store';
import { supabaseService } from '@/lib/supabase';
import {
  isBucketConfigured,
  getObjectText,
  putObjectText,
  deleteObject,
  listKeys,
} from '@/lib/agents/bucket';

export type TemplateStatus = 'active' | 'developing' | 'retired';

export type ContentTemplate = {
  /** Slug identity within the stream (also the storage key tail). */
  template_id: string;
  stream: string;
  name: string;
  /** What this template makes, in one or two sentences (shown in the picker). */
  description: string;
  status: TemplateStatus;
  /** The plan the template carries (D25): one format, its platforms, the ICP. */
  format: string;
  platforms: string[];
  icp?: string;
  /** What you bring / what you get — shown in the picker so expectations are set. */
  inputs?: string;
  outputs?: string;
  /** The recipe, split into the parts the draft prompt injects as named sections
   *  so none gets buried: how to OPEN (hook_recipe, followed as an ordered
   *  formula), the body STRUCTURE / beats (recipe), and how to CLOSE (cta_recipe,
   *  which may say "no CTA"). All optional and backward compatible: a legacy
   *  template that only has `recipe` still works (it injects as the structure). */
  hook_recipe?: string;
  recipe?: string;
  cta_recipe?: string;
  /** Target length (words for text, minutes/seconds for video). Prefilled from the
   *  format's industry default; injected into the draft prompt as a limit. */
  length?: string;
  /** A link to (or description of) an example piece made from this template. */
  example?: string;
  created_at: string;
  updated_at?: string;
};

export function templateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function templateKey(stream: string, slug: string): string {
  return `pam/content-templates/${stream}/${slug}.json`;
}

export function isValidTemplate(x: unknown): x is ContentTemplate {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const t = x as Record<string, unknown>;
  const str = (v: unknown) => typeof v === 'string' && v.length > 0;
  return (
    str(t.template_id) &&
    str(t.stream) &&
    str(t.name) &&
    typeof t.description === 'string' &&
    str(t.status) &&
    str(t.format) &&
    Array.isArray(t.platforms) &&
    (t.platforms as unknown[]).every((p) => typeof p === 'string')
  );
}

async function readAt(key: string): Promise<ContentTemplate | null> {
  if (isBucketConfigured()) {
    const text = await getObjectText(key);
    if (!text) return null;
    try {
      const obj = JSON.parse(text) as unknown;
      return isValidTemplate(obj) ? obj : null;
    } catch {
      return null;
    }
  }
  const s = await getSheetState(key);
  return isValidTemplate(s) ? s : null;
}

export async function getTemplate(
  stream: string,
  slug: string
): Promise<ContentTemplate | null> {
  return readAt(templateKey(stream, slug));
}

export async function saveTemplate(t: ContentTemplate): Promise<void> {
  const key = templateKey(t.stream, t.template_id);
  if (isBucketConfigured()) {
    await putObjectText(key, JSON.stringify(t, null, 2));
  } else {
    await saveSheetState(key, t);
  }
}

export async function deleteTemplate(stream: string, slug: string): Promise<void> {
  const key = templateKey(stream, slug);
  if (isBucketConfigured()) {
    await deleteObject(key);
  } else {
    await deleteSheetState(key);
  }
}

/** List a stream's templates. Malformed rows dropped; active first, then name. */
export async function listTemplates(stream: string): Promise<ContentTemplate[]> {
  const prefix = `pam/content-templates/${stream}/`;
  let docs: ContentTemplate[] = [];
  if (isBucketConfigured()) {
    const keys = (await listKeys(prefix)).filter((k) => k.endsWith('.json'));
    // Read every key at once rather than one latency per template.
    docs = (await Promise.all(keys.map((k) => readAt(k)))).filter(
      (t): t is ContentTemplate => t !== null
    );
  } else {
    const { data, error } = await supabaseService()
      .from('content_shoot_sheets')
      .select('episode_id, state')
      .like('episode_id', 'pam/content-templates/%');
    if (error) throw new Error(`template list failed: ${error.message}`);
    docs = (data ?? [])
      .filter((r) => {
        const id = (r as { episode_id?: unknown }).episode_id;
        return typeof id === 'string' && id.startsWith(prefix);
      })
      .map((r) => (r as { state: unknown }).state)
      .filter(isValidTemplate);
  }
  const rank: Record<TemplateStatus, number> = { active: 0, developing: 1, retired: 2 };
  return docs.sort(
    (a, b) => (rank[a.status] ?? 3) - (rank[b.status] ?? 3) || a.name.localeCompare(b.name)
  );
}
