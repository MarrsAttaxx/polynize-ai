/**
 * Shared output fan-out (D19/D25): create one piece per selected BUILT format
 * from a concept. Used by both creation paths — the template picker (default)
 * and the custom Output-plan form — so piece seeding/idempotency lives once.
 *
 * Idempotency: a template creation reuses the piece with the same
 * (concept, format, template_ref); a custom creation reuses the same
 * (concept, format) among non-template pieces. Re-running never duplicates.
 *
 * Server-side only.
 */

import type { ConceptDoc } from './concept-store';
import {
  listSavedPieces,
  savePiece,
  type MarketingPiece,
} from './piece-store';
import { formatById, type FormatDef } from './output-plan';
import { scaffoldScript } from './concept-parse';
import { templateKey, getTemplate, type ContentTemplate } from './template-store';
import { getLibraryTemplate, type LibraryTemplate } from './template-library';

export type CreatedOutput = { pieceId: string; format: string; kind: string; reused: boolean };

export type OutputSpec = {
  format: FormatDef;
  platforms: string[];
  icp?: string;
  pillar?: string;
  template_ref?: string;
};

export async function createOutputs(
  owner: string,
  concept: ConceptDoc,
  specs: OutputSpec[],
  opts?: { forceNew?: boolean }
): Promise<CreatedOutput[]> {
  // forceNew skips the reuse check so every call creates a fresh piece. The
  // template path ("Use this template") passes it: the user expects a NEW draft
  // each time, and silent reuse of a prior piece made "it just gives me the same
  // post" (the old stored draft, which the auto-draft then skips as already
  // filled). The custom Output-plan path omits it and stays idempotent (re-running
  // a fan-out never duplicates).
  const existing = opts?.forceNew ? [] : await listSavedPieces(owner);
  const out: CreatedOutput[] = [];

  for (const spec of specs) {
    const fmt = spec.format;
    const prior = existing.find((p) => {
      if (p.concept_ref !== concept.concept_ref || p.format !== fmt.id) return false;
      // Template creations match on the same template; custom matches custom.
      return (p.template_ref ?? undefined) === (spec.template_ref ?? undefined);
    });
    if (prior) {
      out.push({ pieceId: prior.piece_id, format: fmt.id, kind: fmt.kind, reused: true });
      continue;
    }

    // An explicitly-empty selection stays empty (the prepare step tells the user
    // to re-plan); absent selections default to all channels at the callers.
    const platforms = spec.platforms.filter((c) => fmt.channels.includes(c));
    const piece: MarketingPiece = {
      piece_id: crypto.randomUUID(),
      owner,
      stream: concept.stream,
      format: fmt.id,
      kind: fmt.kind,
      title: concept.title,
      concept_ref: concept.concept_ref,
      framing: concept.framing,
      pillar: spec.pillar || undefined,
      template_ref: spec.template_ref || undefined,
      icp: spec.icp || undefined,
      platforms,
      status: 'draft',
      // Video is a human on-camera capture (D22). Text is authored copy.
      ...(fmt.kind === 'video' ? { provenance: 'human_capture' as const } : {}),
      stage: fmt.kind === 'video' ? 'script' : 'draft',
      script: fmt.kind === 'video' ? scaffoldScript(concept.framing, concept.body_md) : '',
      body: fmt.kind === 'video' ? undefined : '',
    };
    await savePiece(owner, piece);
    out.push({ pieceId: piece.piece_id, format: fmt.id, kind: fmt.kind, reused: false });
  }
  return out;
}

/** Where the client should land after creation: the single piece, or the concept hub. */
export function creationTarget(outputs: CreatedOutput[], conceptSlug: string): string {
  return outputs.length === 1
    ? `/console/marketing/piece/${outputs[0].pieceId}`
    : `/console/marketing/concept/${conceptSlug}`;
}

export type ResolvedTemplate = ContentTemplate | (LibraryTemplate & { stream?: undefined });

/**
 * Resolve a piece's template_ref to its template: `library:{id}` hits the
 * built-in library; otherwise the ref is the stream-template storage key.
 * Returns null when the ref is missing/unknown (piece proceeds template-less).
 */
export async function resolveTemplateRef(ref: string): Promise<ResolvedTemplate | null> {
  if (ref.startsWith('library:')) {
    return getLibraryTemplate(ref.slice('library:'.length)) ?? null;
  }
  const m = ref.match(/^pam\/content-templates\/([^/]+)\/(.+)\.json$/);
  if (!m) return null;
  try {
    return await getTemplate(m[1], m[2]);
  } catch {
    return null;
  }
}

/** The stored ref for a stream template. */
export function streamTemplateRef(t: ContentTemplate): string {
  return templateKey(t.stream, t.template_id);
}
