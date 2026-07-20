/**
 * Shared first-draft generation (D23/D25). April writes a piece's first draft by
 * mashing the concept with the piece's Content Template recipe, its ICP, and the
 * stream's brand voice. One place so text and video drafts share voice, hook
 * guidance, and recipe handling.
 *
 * Used by:
 *  - the template creation path (create/go) to AUTO-draft on "Use this template",
 *  - the text screen's "Draft from the concept" button (piece/[id]/text-draft),
 *  - the script screen's "Draft from the concept" button (piece/[id]/script-draft).
 *
 * Server-side only; billed to April's key (falls back to the console key). Em-dashes
 * are stripped by the LLM layer and prohibited in the prompts.
 */

import type { MarketingPiece } from './piece-store';
import { getConcept } from './concept-store';
import { getBrandVoiceForStream } from './brand-voice-store';
import { icpLabel, formatById } from './output-plan';
import { resolveTemplateRef } from './create-outputs';
import { complete } from '@/lib/llm';
import { stripEmDashes } from '@/lib/em-dash';
import { HOOK_GUIDANCE } from './hook-guidance';

/** Why a draft could not be produced, so callers can map to the right response. */
export type DraftFailure = 'no-concept' | 'llm-unavailable' | 'empty';

export class DraftError extends Error {
  constructor(public reason: DraftFailure) {
    super(reason);
    this.name = 'DraftError';
  }
}

/** Resolve the concept body a piece is drafted from (its concept_ref is truth). */
export async function conceptBodyForPiece(
  owner: string,
  piece: MarketingPiece
): Promise<string> {
  if (typeof piece.concept_ref === 'string' && piece.concept_ref) {
    const m = piece.concept_ref.match(/core-concept-(.+)\.md$/);
    if (m) {
      try {
        const concept = await getConcept(owner, m[1]);
        return concept?.body_md ?? '';
      } catch (err) {
        console.error('[draft] concept read failed:', err);
      }
    }
  }
  return '';
}

/** The piece's Content Template recipe, if any (degrades to none on any failure). */
async function pieceRecipe(piece: MarketingPiece): Promise<string | undefined> {
  if (typeof piece.template_ref === 'string' && piece.template_ref) {
    try {
      const t = await resolveTemplateRef(piece.template_ref);
      return t?.recipe || undefined;
    } catch {
      /* degrade to no recipe */
    }
  }
  return undefined;
}

function audienceBlock(icp?: string): string {
  return icp
    ? `\n\nWrite it for this audience: ${icp}. Speak to their world and what they care about, without naming the persona in the copy.`
    : '';
}

function voiceBlock(brandVoice?: string): string {
  return brandVoice
    ? `\n\nWrite in this brand voice. Match its register, phrasing, and point of view:\n"""\n${brandVoice}\n"""`
    : '';
}

function recipeBlock(recipe?: string): string {
  return recipe
    ? `\n\nThis piece follows a Content Template. Its production recipe is the house style for this piece; follow it exactly:\n"""\n${recipe}\n"""`
    : '';
}

const VOICE_AND_DASH = `Polynize voice:
- Direct, contrarian, concrete. No hype, no filler, no corporate throat-clearing.
- Short sentences. Say the sharp thing plainly.
- No emoji. No hashtags unless the concept calls for them.
- Never use em-dashes. Use commas, periods, or colons instead.`;

function textSystemPrompt(opts: {
  formatLabel: string;
  icp?: string;
  brandVoice?: string;
  recipe?: string;
}): string {
  return `You are April, Polynize's copy and voice specialist. Write a ${opts.formatLabel} from the concept the user gives you.${audienceBlock(opts.icp)}${voiceBlock(opts.brandVoice)}${recipeBlock(opts.recipe)}

${HOOK_GUIDANCE}

${VOICE_AND_DASH}

Rules:
- Ground the post in the concept: use its thesis, beats, and proof. Do not invent facts it does not contain.
- Open with a hook that earns the next line. Close with a clear point or call to action.
- Output ONLY the post copy. No preamble, no "here is your post", no surrounding quotes, no markdown code fences.`;
}

function scriptSystemPrompt(opts: {
  formatLabel: string;
  icp?: string;
  brandVoice?: string;
  recipe?: string;
}): string {
  return `You are April, Polynize's copy and voice specialist. Write a complete ${opts.formatLabel} script from the concept the user gives you.${audienceBlock(opts.icp)}${voiceBlock(opts.brandVoice)}${recipeBlock(opts.recipe)}

${HOOK_GUIDANCE}

${VOICE_AND_DASH}

Script rules:
- This is a SPOKEN script the person reads to camera. Write the words they say, not stage directions.
- Ground it in the concept: use its thesis, beats, and proof. Do not invent facts it does not contain.
- The first spoken line is the hook and matters most; it must earn the next line.
- Structure it with plain section labels on their own lines: HOOK, then BEAT 1, BEAT 2, and so on for each movement, then CTA. Put the spoken lines under each label.
- End on the call to action, then one sharp closing line to punch.
- Output ONLY the script (the labels and the spoken lines). No preamble, no "here is your script", no markdown code fences.`;
}

/** Strip stray code fences / wrapping the model sometimes adds, then em-dashes. */
function cleanOutput(raw: string): string {
  let body = raw.trim();
  const fence = body.match(/^```(?:\w+)?\s*([\s\S]*?)\s*```$/);
  if (fence) body = fence[1].trim();
  return stripEmDashes(body);
}

async function generate(
  owner: string,
  piece: MarketingPiece,
  kind: 'text' | 'video'
): Promise<string> {
  const conceptBody = await conceptBodyForPiece(owner, piece);
  if (!conceptBody.trim()) throw new DraftError('no-concept');

  const formatLabel = formatById(piece.format)?.label ?? (kind === 'video' ? 'video' : 'post');
  const brandVoice = await getBrandVoiceForStream(piece.stream);
  const recipe = await pieceRecipe(piece);
  const promptOpts = { formatLabel, icp: icpLabel(piece.icp), brandVoice, recipe };

  // For text, if a script draft already exists, offer it as reference.
  const source =
    kind === 'text' && piece.script?.trim()
      ? `CONCEPT:\n"""\n${conceptBody}\n"""\n\nSCRIPT (draft, for reference):\n"""\n${piece.script}\n"""`
      : `CONCEPT:\n"""\n${conceptBody}\n"""`;
  const ask = kind === 'video' ? `Write the ${formatLabel} script.` : `Write the ${formatLabel}.`;

  let raw: string;
  try {
    raw = await complete({
      system:
        kind === 'video' ? scriptSystemPrompt(promptOpts) : textSystemPrompt(promptOpts),
      messages: [{ role: 'user', content: `${source}\n\n${ask}` }],
      // Generous ceiling: the model is a thinking model (Gemini 3.5 Flash), whose
      // reasoning tokens count against max_tokens. At 1800 a heavy recipe prompt
      // could spend most of the budget on reasoning and truncate the visible draft
      // mid-sentence. These leave ample room for reasoning AND the full output.
      maxTokens: kind === 'video' ? 6000 : 4000,
      temperature: 0.7,
      json: false,
      apiKey: process.env.APRIL_OPENROUTER_API_KEY,
    });
  } catch (e) {
    console.error(
      `[draft] LLM call threw (${kind}): ${e instanceof Error ? e.message : String(e)}`
    );
    throw new DraftError('llm-unavailable');
  }

  const out = cleanOutput(raw);
  if (!out) throw new DraftError('empty');
  return out;
}

/** Draft the post copy for a text piece. Throws DraftError on failure. */
export function draftTextBody(owner: string, piece: MarketingPiece): Promise<string> {
  return generate(owner, piece, 'text');
}

/** Draft the spoken script for a video piece. Throws DraftError on failure. */
export function draftVideoScript(owner: string, piece: MarketingPiece): Promise<string> {
  return generate(owner, piece, 'video');
}
