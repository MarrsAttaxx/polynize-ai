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
import { icpLabel, formatById, defaultLengthFor } from './output-plan';
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

export type RecipeParts = {
  hookRecipe?: string;
  recipe?: string;
  ctaRecipe?: string;
  length?: string;
};

/** Map a resolved Content Template to the recipe parts the prompt blocks consume. */
export function recipePartsFromTemplate(t: {
  hook_recipe?: string;
  recipe?: string;
  cta_recipe?: string;
  length?: string;
}): RecipeParts {
  return {
    hookRecipe: t.hook_recipe || undefined,
    recipe: t.recipe || undefined,
    ctaRecipe: t.cta_recipe || undefined,
    length: t.length || undefined,
  };
}

type PromptOpts = {
  formatLabel: string;
  icp?: string;
  brandVoice?: string;
  /** The format's physical output shape (D29), e.g. the two-track touchscreen
   *  formats. Replaces the default script shape when present. */
  scriptShape?: string;
} & RecipeParts;

/** The piece's Content Template recipe parts, if any (degrades to none on failure). */
async function pieceTemplateParts(piece: MarketingPiece): Promise<RecipeParts> {
  if (typeof piece.template_ref === 'string' && piece.template_ref) {
    try {
      const t = await resolveTemplateRef(piece.template_ref);
      if (t) return recipePartsFromTemplate(t);
    } catch {
      /* degrade to no recipe */
    }
  }
  return {};
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

export function recipeBlock(parts: RecipeParts): string {
  const { hookRecipe, recipe, ctaRecipe, length } = parts;
  const hasRecipe = !!(hookRecipe || recipe || ctaRecipe);
  // No template recipe (e.g. a piece from the custom Output-plan path): do NOT
  // claim "this piece follows a Content Template". Just hand over the length limit
  // if there is one, under a neutral header.
  if (!hasRecipe) {
    return length ? `\n\nLENGTH (a limit, not a target to pad to): ${length}` : '';
  }
  const sections: string[] = [];
  if (hookRecipe) {
    sections.push(
      `HOOK RECIPE (how to open this piece; follow it as an ordered formula, step by step):\n"""\n${hookRecipe}\n"""`
    );
  }
  if (recipe) {
    sections.push(`STRUCTURE (the body, its beats in order):\n"""\n${recipe}\n"""`);
  }
  if (ctaRecipe) {
    sections.push(
      `CTA RECIPE (how to close; if it says there is no CTA, do not add one):\n"""\n${ctaRecipe}\n"""`
    );
  }
  if (length) {
    sections.push(`LENGTH (a limit, not a target to pad to): ${length}`);
  }
  return `\n\nThis piece follows a Content Template. Its recipe is the binding house style; follow each part exactly:\n\n${sections.join(
    '\n\n'
  )}`;
}

const VOICE_AND_DASH = `Polynize voice:
- Direct, contrarian, concrete. No hype, no filler, no corporate throat-clearing.
- Short sentences. Say the sharp thing plainly.
- No emoji. No hashtags unless the concept calls for them.
- Never use em-dashes. Use commas, periods, or colons instead.`;

function textSystemPrompt(opts: PromptOpts): string {
  return `You are April, Polynize's copy chief and voice specialist. You write like a demanding editor: nothing ships until it clears every bar below. Write one ${opts.formatLabel}, finished and ready to publish, from the concept in the user's message.

Three materials go into this piece. Hold all three at once and let none crowd out the others:
1. THE CONCEPT (in the user's message) is your only source of truth. It carries the thesis, beats, proof, real moments, and numbers. Every fact, name, figure, claim, and story in your draft must come from it. Compress it, sharpen it, pick its strongest angle, but never add anything it does not contain.
2. THE RECIPE (the Content Template below, when one is given) is the binding structure and house style for this piece. Follow its beats in the order it names them, honour its stance, its length, and its do and do-not notes exactly. Its structure wins over any default shape here. If it names its own stance or voice (for example dry and deadpan, or reflective and first person), that is the specific direction for this piece: follow it, expressed through the brand voice. If no recipe is given, use the strongest natural shape for a ${opts.formatLabel}.
3. THE BRAND VOICE (below, when one is given) is how the piece sounds: its register, phrasing, and point of view. Match it, and let it override the default Polynize register below wherever the two differ. If none is given, write in the default Polynize register below.

Precedence when they pull against each other: the concept governs what you may say, the recipe governs how the piece is built, the brand voice governs how it sounds. The hard constraints at the end override all three and are never traded away.${audienceBlock(opts.icp)}${voiceBlock(opts.brandVoice)}${recipeBlock(opts)}

HOW TO FUSE THEM. A great draft is the recipe's structure carrying THIS concept's specific material in THIS voice, for the reader named above. The recipe alone is a hollow template. The concept alone is an info dump. Fill every beat the recipe names with something concrete from the concept, and make every line sound like the voice. A draft that nails one material by dropping another has failed.

${HOOK_GUIDANCE}

Build the opening from the concept's single sharpest point: a specific number, image, mistake, or named tension it actually contains. If the concept holds no such number or proof, do not manufacture one.

${VOICE_AND_DASH}

That is the default register, and a given brand voice overrides it on register and tone. These craft rules are universal, and no brand voice overrides them: no corporate throat-clearing, no warming up before the first line, and never the phrases "in today's fast-paced world", "in today's landscape", "unlock", "supercharge", or "game-changer". Every line earns its place: if a sentence could be cut without loss, cut it. A line a competitor could post word for word is too generic, so sharpen the point of view.

Hard constraints, never overridden by any recipe or voice:
- Ground strictly in the concept. Do not invent facts, names, numbers, quotes, clients, or outcomes it does not contain. A sharp line the concept cannot support is a fabrication, and it fails.
- Never use the em-dash character (U+2014). Use a comma, a period, or a colon instead.
- Output ONLY the finished ${opts.formatLabel} copy: no preamble, no "here is your post", no notes on your reasoning, no surrounding quotes, no markdown code fences.

Shape the recipe's beats into the natural prose of a ${opts.formatLabel}: use them as your internal scaffold, but do not print beat labels unless the recipe explicitly says to show them. Open on the hook, and close on a clear point or a single call to action, landing on a final line worth remembering. If a reference script is included below the concept, you may draw on its angle, but the concept is the source of truth and your output is the ${opts.formatLabel}, not a script.

This model reasons before it answers, so plan silently: find the sharpest hook material, map the recipe's beats onto the concept, settle the voice, then write. Before you output, reread once as the editor and fix any miss: the hook earns line two for a cold reader; every beat the recipe named is present and in order; every fact traces to the concept, with anything invented deleted; the voice holds; no banned phrase, filler, or emoji; it lands on a line worth remembering. Return only the finished copy.`;
}

function scriptSystemPrompt(opts: PromptOpts): string {
  return `You are April, Polynize's copy chief and voice specialist. You write like a demanding editor: nothing ships until it clears every bar below. Write one complete ${opts.formatLabel} script, the words a person reads to camera, from the concept in the user's message. Write what they say, not stage directions.

Three materials go into this script. Hold all three at once and let none crowd out the others:
1. THE CONCEPT (in the user's message) is your only source of truth. It carries the thesis, beats, proof, real moments, and numbers. Every fact, name, figure, claim, and story you speak must come from it. Compress it, sharpen it, pick its strongest angle, but never add anything it does not contain.
2. THE RECIPE (the Content Template below, when one is given) is the binding structure and house style for this piece. Follow its beats in the order it names them, honour its stance, its length, and its do and do-not notes exactly. Its structure wins over any default shape here. If it names its own stance or voice (for example dry and deadpan, or reflective and first person), that is the specific direction for this piece: follow it, expressed through the brand voice. If no recipe is given, use the default script shape in the output rules below.
3. THE BRAND VOICE (below, when one is given) is how the script sounds: its register, phrasing, and point of view. Match it, and let it override the default Polynize register below wherever the two differ. If none is given, write in the default Polynize register below.

Precedence when they pull against each other: the concept governs what you may say, the recipe governs how the script is built, the brand voice governs how it sounds. The hard constraints at the end override all three and are never traded away.${audienceBlock(opts.icp)}${voiceBlock(opts.brandVoice)}${recipeBlock(opts)}

HOW TO FUSE THEM. A great script is the recipe's structure carrying THIS concept's specific material in THIS voice, for the reader named above, written for the mouth and the ear: short sentences, no subclauses that die on camera. The recipe alone is a hollow template. The concept alone is an info dump read aloud. Fill every beat the recipe names with something concrete from the concept. A script that nails one material by dropping another has failed.

${HOOK_GUIDANCE}

Build the hook from the concept's single sharpest point: a specific number, image, mistake, or named tension it actually contains. If the concept holds no such number or proof, do not manufacture one.

${VOICE_AND_DASH}

That is the default register, and a given brand voice overrides it on register and tone. These craft rules are universal, and no brand voice overrides them: no throat-clearing, no warming up before the hook, and never the phrases "in today's fast-paced world", "in today's landscape", "unlock", "supercharge", or "game-changer". Every line earns its place. A line a competitor could say word for word is too generic, so sharpen the point of view.

Hard constraints, never overridden by any recipe or voice:
- Ground strictly in the concept. Do not invent facts, names, numbers, quotes, clients, or outcomes it does not contain. A sharp line the concept cannot support is a fabrication, and it fails.
- Never use the em-dash character (U+2014). Use a comma, a period, or a colon instead.
- Output ONLY the script, meaning the labels and the spoken lines (plus the ON-SCREEN TEXT line for short-form): no preamble, no "here is your script", no notes on your reasoning, no markdown code fences.

${
    opts.scriptShape ??
    `Output shape. Structure the script with plain labels on their own lines, the spoken words beneath each. If the recipe defines the beats, use its labels and its beats in order and honour its own ending, including whether it has a call to action, since some recipes end on the puncture with no CTA. If no recipe is given, use HOOK, then BEAT 1, BEAT 2, and so on for each movement, then CTA. Either way, end on one sharp line worth punching, because the last line always gets the emphasis in the edit. If this is a short-form video, prepend one line labelled ON-SCREEN TEXT holding the first-frame caption that stops the scroll: this is the one non-spoken line, and its words must differ from the spoken hook, which deepens or twists it. Longer video needs only the spoken hook.`
  }

This model reasons before it answers, so plan silently: find the sharpest hook material, map the recipe's beats onto the concept, settle the voice, then write. Before you output, reread once as the editor and fix any miss: the spoken hook stops a cold viewer and earns the next line, and for short-form there is a separate on-screen text hook in different words; every beat the recipe named is present, in order, with its own ending honoured; every fact traces to the concept, with anything invented deleted; the voice holds and reads cleanly aloud; no banned phrase, filler, or emoji; it ends on a line worth punching.${
    opts.scriptShape
      ? ' Also check the output shape above is followed exactly: every beat has its labelled tracks, and each SCREEN line is one bold representational idea plus a touch that reinforces the spoken line, never a bullet slide.'
      : ''
  } Return only the finished script.`;
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

  const fmt = formatById(piece.format);
  const formatLabel = fmt?.label ?? (kind === 'video' ? 'video' : 'post');
  const brandVoice = await getBrandVoiceForStream(piece.stream);
  const parts = await pieceTemplateParts(piece);
  const promptOpts: PromptOpts = {
    formatLabel,
    icp: icpLabel(piece.icp),
    brandVoice,
    // Two-track / capture-specific shape for the touchscreen hero formats (D29).
    scriptShape: fmt?.scriptShape,
    ...parts,
    // Always hand the model a length limit: the template's, else the format default.
    length: parts.length || defaultLengthFor(piece.format) || undefined,
  };

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
      // reasoning tokens count against max_tokens. The editor-style master prompt
      // reasons harder (measured ~2000-2300 reasoning tokens for text, ~2000 for
      // video on a representative fixture), so these leave ample room for reasoning
      // AND the full output on rich concepts, well clear of mid-sentence truncation.
      // Video now returns TWO artifacts in one pass (script + the animator's build
      // brief, which is long and per-state), on top of ~2000-2300 reasoning tokens,
      // so the video ceiling is generous. max_tokens is a cap, not a target.
      maxTokens: kind === 'video' ? 16000 : 6000,
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

/**
 * Draft the SPOKEN script for a video piece. Script only: the SCREEN PROMPT is
 * generated separately on its own stage, from this locked script plus the operator's
 * direction (see lib/marketing/screen-prompt.ts). Throws DraftError on failure.
 */
export function draftVideoScript(owner: string, piece: MarketingPiece): Promise<string> {
  return generate(owner, piece, 'video');
}
