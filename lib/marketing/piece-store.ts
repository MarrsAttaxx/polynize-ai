/**
 * Marketing piece persistence — Phase-1 INTERIM.
 *
 * Backs onto the existing `content_shoot_sheets` table via an owner-scoped key
 * (`marketing/{owner}/{pieceId}`), so the Script screen works BEFORE migration
 * 0009 (content_pieces) is applied. When 0009 lands, swap the internals here to
 * content_pieces; callers (the screen + the state route) do not change.
 * See docs/pam-console/storage-and-agent-socket.md (D2 / Phase-1 interim note).
 *
 * Server-side only (goes through supabaseService via shoot-sheet-store).
 */

import {
  getSheetState,
  saveSheetState,
  deleteSheetState,
} from '@/lib/content/shoot-sheet-store';
import { supabaseService } from '@/lib/supabase';

export type MarketingPiece = {
  piece_id: string;
  owner: string;
  /** The brand/owner bucket the content is FOR: marrs | polynize | shourov | team. */
  stream: string;
  format: string;
  title: string;
  concept_ref?: string;
  pillar?: string;
  stage?: string;
  /**
   * The video shot-list (short_form_video / medium_video). Empty for non-video
   * pieces, which carry their draft in `body`. Kept required-string so the
   * autosave PUT + isValidPiece round-trip is unchanged for existing pieces.
   */
  script: string;
  updated_at?: string;

  // --- Output-plan fields (D19/D23). All optional so existing pieces stay valid.
  //     Named to match migration 0009 content_pieces where a column exists, so
  //     the eventual DB swap is a lift, not a remap.
  /** The module family that renders this piece: video | text | image. */
  kind?: 'video' | 'text' | 'image';
  /** The concept's framing (0009: framing). */
  framing?: string;
  /**
   * THE ANGLE: the spin this particular piece takes on the concept, in the operator's own
   * words, captured before anything is drafted.
   *
   * A concept says what the piece is ABOUT and a template says what SHAPE it takes. Those
   * two are not enough to write from, which is why drafting straight off them produced
   * scripts that were "way off" (Marrs): they were written with no editorial intent
   * because nobody had supplied any. This is the third input, and only a human has it.
   * It also seeds the prezie's narrative, so the intent is stated once.
   */
  angle?: string;
  /** Selected ICP archetype id (see output-plan.ICP_ARCHETYPES). */
  icp?: string;
  /** Selected publish channels; become calendar_entries at the tail. */
  platforms?: string[];
  /** Lifecycle (0009: status): draft | in_progress | approved | published. */
  status?: string;
  /** The Content Pillar Template this piece was created from (D25): a stream
   *  template's storage key, or `library:{id}` for a built-in. */
  template_ref?: string;
  /** Provenance of the produced media (D22): human_capture | ai_generated | hybrid. */
  provenance?: 'human_capture' | 'ai_generated' | 'hybrid';
  /** The text draft for non-video pieces (post copy). Video uses `script`. */
  body?: string;
  /**
   * The TREATMENT: the pre-record screen plan for the touchscreen formats (D29
   * amended). Per beat, what is on the touchscreen and what the touch does. Kept
   * SEPARATE from `script` because the script is read off the teleprompter and must
   * stay spoken-only, while this is the brief the animation build works from.
   * Shares the script's beat labels. Absent for formats that do not need one.
   */
  treatment?: string;
  /**
   * The SLIDES plan as JSON (see lib/marketing/slides.ts): a short list of
   * `{visual, text}` cards, which is what the operator actually edits. Supersedes the
   * prose `treatment` brief, which is kept only so older pieces are not orphaned.
   */
  slides?: string;
  /**
   * READY TO RECORD: this piece is queued for the next studio session.
   *
   * Marrs described the gap: "once I'm done with the Prezi and I'm ready to go into record stage, I need
   * a button somewhere... it puts it into a cue somewhere." The queue is CROSS-STREAM by design, because
   * a studio session is one room and one rig, not one brand: his Polynize split-screen and his Marrs
   * piece get shot back to back.
   *
   * A flag on the piece rather than a separate queue object, so it cannot drift from the piece it points
   * at, and so deleting a piece cannot leave a row in a queue pointing at nothing.
   */
  shoot_ready?: boolean;
  shoot_ready_at?: string;
  /**
   * THIS ONE HIT THE STANDARD. Marked by hand, and it becomes a worked example in every
   * later draft for the same stream and format (lib/marketing/exemplars.ts).
   *
   * Marrs: "we don't have something that indicates what good looks like." This is that,
   * defined by what he blesses rather than by anyone's opinion of good. When the analytics
   * loop lands, a post that actually performed should set this same flag, so there stays
   * one definition of good with two sources of evidence.
   */
  exemplar?: boolean;
  /** Why it is good, in his words. Injected with the example, and usually the most useful part. */
  exemplar_note?: string;
  exemplar_at?: string;
  /** When it was actually shot. Set by the Recorded button, which also advances the stage. */
  recorded_at?: string;
  /** Attached media asset ids from this stream's media library (D2 amended
   *  2026-07-14). References into media-store; resolved to public URLs at publish
   *  time. Optional so existing pieces stay valid (isValidPiece unchanged). */
  media?: string[];
  /**
   * THE AGREED HOOKS AND THE AGREED ARC (D39). The staged build replaces the one-shot angle box.
   *
   * Marrs, on why the one box was not working: "I get to this page, I'm a little ambiguous on
   * what to do. What angle do I want to take is a little weird." And on what he wants instead:
   * "a collaborative process to excavate the good stuff out of me to get to a good script."
   *
   * The measurement that settled it: the angle he typed was 1% of the instruction April read, and
   * she wrote 100% of the piece from it in a single call. Every disagreement therefore surfaced
   * only in the finished script, where it is most expensive to fix. These two fields are the two
   * cheap checkpoints in front of that: agree the hooks, agree the arc, then write.
   *
   * `concept_read` is April's account of the usable material in the concept, kept because it is
   * the answer to a separate complaint ("it's kind of a big document, I'm not really taking note
   * of what's in that"). Seeing what she can actually use, repeatedly, is what will eventually
   * tell us what a good concept has to contain.
   *
   * All optional, and `isValidPiece` is untouched: a piece from before this existed stays valid
   * and simply falls back to the one-shot path.
   */
  hooks?: string[];
  outline?: string;
  /** April's read of the usable material, one line per item. Array, matching HookProposal. */
  concept_read?: string[];
  /**
   * The Narrative this piece was built from (the Gates, D40). A master piece carries one
   * master asset (the article, the shorts, the carousel...) and Gate 5 expands it into
   * per-channel calendar entries. Optional: pieces from before the Gates stay valid.
   */
  narrative_ref?: string;
  /** Which master asset a Gates master piece carries: article, texts, shorts, long, carousel, images. */
  master?: string;
  /**
   * WHETHER YOUTUBE GETS THIS AS A SHORT (D84).
   *
   * A vertical file has to publish as a Short or Metricool refuses it for its orientation, and
   * nothing in a media asset says which way up it is. Only the operator knows, so it is asked once
   * on the caption screen and stamped onto the entry at prepare time, the same way publish_mode is.
   *
   * Absent means Short, which is right for every post this pipeline can currently make.
   */
  youtube_type?: 'short' | 'landscape';
  /**
   * THE USE CASE (D96): one of the six ids in use-case.ts. Copied from the Story when the piece is
   * minted; set by hand on the caption screen for a piece with no Story (a finished video posted
   * through the media-library door). Carried onto every calendar entry and into every link.
   */
  use_case?: string;
};

function keyFor(owner: string, pieceId: string): string {
  return `marketing/${owner}/${pieceId}`;
}

/**
 * Runtime shape guard over untrusted jsonb (the state column is not schema
 * enforced, and the PUT route persists arbitrary bodies). Every required field
 * must be a non-empty string. Malformed rows are treated as absent, so a bad
 * or partial row can never crash a consumer (`.format.replace`, `.script.split`).
 */
/**
 * THE RENAME'S ONE PERSISTED FIELD (D43). A piece saved before the Story was renamed the
 * Narrative carries `story_ref`, and every reader now asks for `narrative_ref`. Without this
 * adoption those pieces silently lose their source: `conceptBodyForPiece` finds no article and
 * Gate 4 reports "No concept to work from", which is exactly the bug that cost a walkthrough
 * once already.
 *
 * Read-time only, and it never deletes the old key: the piece heals permanently the next time
 * anything saves it, and until then both fields agree.
 */
function adoptLegacyRefs(p: MarketingPiece): MarketingPiece {
  const legacy = (p as MarketingPiece & { story_ref?: unknown }).story_ref;
  if (!p.narrative_ref && typeof legacy === 'string' && legacy) {
    return { ...p, narrative_ref: legacy };
  }
  return p;
}

export function isValidPiece(x: unknown): x is MarketingPiece {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const p = x as Record<string, unknown>;
  const str = (v: unknown) => typeof v === 'string' && v.length > 0;
  return (
    str(p.piece_id) &&
    str(p.owner) &&
    str(p.stream) &&
    str(p.format) &&
    str(p.title) &&
    typeof p.script === 'string'
  );
}

/**
 * List THIS owner's saved marketing pieces for the dashboard shell. Owner-scoped
 * (matches getPiece/savePiece keying) so the dashboard only shows pieces the
 * user can actually open, and malformed rows are dropped, never returned.
 * Interim: scans content_shoot_sheets keys under `marketing/{owner}/`. When 0009
 * lands this becomes `select from content_pieces where owner_id = ...`.
 */
export async function listSavedPieces(owner: string): Promise<MarketingPiece[]> {
  const prefix = `marketing/${owner}/`;
  const { data, error } = await supabaseService()
    .from('content_shoot_sheets')
    .select('episode_id, state')
    .like('episode_id', 'marketing/%');
  if (error) {
    throw new Error(`marketing piece list failed: ${error.message}`);
  }
  return (data ?? [])
    .filter((r) => {
      const id = (r as { episode_id?: unknown }).episode_id;
      return typeof id === 'string' && id.startsWith(prefix);
    })
    .map((r) => (r as { state: unknown }).state)
    .filter(isValidPiece)
    .map(adoptLegacyRefs);
}

/** Load a saved piece for this owner, or null if none saved or the row is malformed. */
export async function getPiece(
  owner: string,
  pieceId: string
): Promise<MarketingPiece | null> {
  const s = await getSheetState(keyFor(owner, pieceId));
  return isValidPiece(s) ? adoptLegacyRefs(s) : null;
}

/** Upsert a piece for this owner. Owner + id are the storage key. */
export async function savePiece(
  owner: string,
  piece: MarketingPiece
): Promise<{ updated_at: string }> {
  return saveSheetState(keyFor(owner, piece.piece_id), piece);
}

/** Delete a piece for this owner (idempotent). Owner-scoped. */
export async function deletePiece(owner: string, pieceId: string): Promise<void> {
  await deleteSheetState(keyFor(owner, pieceId));
}
