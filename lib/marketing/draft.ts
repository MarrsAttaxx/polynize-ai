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
import { getNarrative } from './narrative-store';
import { getBrandVoiceForStream } from './brand-voice-store';
import { icpLabel, formatById, defaultLengthFor, HOOK_CRAFT } from './output-plan';
import { promptFragment } from './kit';
import { resolveTemplateRef } from './create-outputs';
import { complete } from '@/lib/llm';
import { resolveModel } from '@/lib/llm/openrouter';
import { stripEmDashes } from '@/lib/em-dash';
import { stripMarkdownEmphasis, NO_MARKDOWN_INSTRUCTION } from '@/lib/plain-copy';
import { HOOK_GUIDANCE } from './hook-guidance';
import { exemplarBlock, pickExemplars } from './exemplars';

/**
 * The model that writes. Falls through to OPENROUTER_MODEL when unset, so this is a
 * no-op until it is set and nothing changes by adding it.
 *
 * Drafting is the one job in PAM that is pure writing, and writing quality is the thing
 * that is actually being judged here. Same per-task shape as FIGURE_MODEL and
 * PODCAST_MODEL: the choice sits next to the code that knows what kind of work it is, and
 * moving it does not move any of the others. An env var rather than a constant so the same
 * concept can be run through two models back to back without a deploy between them.
 */
const scriptModel = () => process.env.SCRIPT_MODEL || undefined;

/**
 * Which model actually wrote this, resolved from the same line of code that picks it.
 *
 * Marrs asked "are we using Gemini Flash for April? Is that what she's actually using?" and
 * nothing in the console could answer him: the model is a Vercel env var, so the only honest
 * answers were the OpenRouter bill or a guess. The figure and clip paths already expose
 * `figureModelInUse` / `clipModelInUse` for exactly this reason. Drafting did not, which is
 * how the question became unanswerable for the one job whose output is judged most often.
 *
 * Derived, never stored: a readout reconstructed anywhere else drifts the moment one of them
 * changes, which is worse than no readout because it is believed.
 */
export const scriptModelInUse = () => resolveModel(scriptModel());

/** Why a draft could not be produced, so callers can map to the right response. */
export type DraftFailure = 'no-concept' | 'no-hooks' | 'llm-unavailable' | 'empty';

export class DraftError extends Error {
  constructor(public reason: DraftFailure) {
    super(reason);
    this.name = 'DraftError';
  }
}

/**
 * The source text a piece is drafted from.
 *
 * TWO SHAPES, because there are two eras of piece. A piece from the streams flow points at
 * a concept doc via `concept_ref`. A piece from the Gates (D40) points at a Narrative via
 * `narrative_ref`, and its source is that narrative's ARTICLE: the long form is approved at gate 2
 * precisely so every piece is cut from it and nothing downstream invents past it.
 *
 * This was a real break on the first walkthrough. Gate 4's masters carry narrative_ref and no
 * concept_ref, so every draft and hook call on them failed with "no concept to work from",
 * which reads like a mis-planned piece rather than a missing lookup. The narrative branch goes
 * FIRST: when a piece has both, the article is the nearer and more specific source.
 */
export async function conceptBodyForPiece(
  owner: string,
  piece: MarketingPiece
): Promise<string> {
  if (typeof piece.narrative_ref === 'string' && piece.narrative_ref) {
    try {
      const narrative = await getNarrative(piece.narrative_ref);
      const article = narrative?.article?.trim() ?? '';
      if (article) return article;
    } catch (err) {
      console.error('[draft] narrative read failed:', err);
    }
  }
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
  /** How many hook variants to write. 1 or undefined = one hook, as before. */
  hookVariants?: number;
};

/** Map a resolved Content Template to the recipe parts the prompt blocks consume. */
export function recipePartsFromTemplate(t: {
  hook_recipe?: string;
  recipe?: string;
  cta_recipe?: string;
  length?: string;
  hook_variants?: number;
}): RecipeParts {
  const variants = Number(t.hook_variants);
  return {
    hookRecipe: t.hook_recipe || undefined,
    recipe: t.recipe || undefined,
    ctaRecipe: t.cta_recipe || undefined,
    length: t.length || undefined,
    // Clamped here so a bad stored value cannot ask for forty hooks.
    hookVariants:
      Number.isFinite(variants) && variants > 1 ? Math.min(Math.floor(variants), 6) : undefined,
  };
}

type PromptOpts = {
  formatLabel: string;
  /** Worked examples of the house standard, already rendered. Empty when none are marked. */
  exemplars?: string;
  icp?: string;
  brandVoice?: string;
  /** The format's physical output shape (D29), e.g. the two-track touchscreen
   *  formats. Replaces the default script shape when present. */
  scriptShape?: string;
  /**
   * THE END STATE, from the kit catalogue: what this finished post actually has to be, with
   * its length band, its image, its link rule, and the things we do not know and must not
   * claim. Present on any piece cut from a Narrative (D42), absent on the older custom
   * Output-plan path, which has no typed output behind it.
   */
  outputSpec?: string;
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

/**
 * HOW TO USE THE VOICE DOC, not just "here is a voice doc".
 *
 * The docs are freeform Markdown, so what they contain varies: some describe a register in
 * adjectives, some carry actual sentences. Adjectives are the weak case and sample lines are
 * the strong one, for the same reason the hook pattern library beats the hook rules: a
 * writer can imitate a line and can only approximate an adjective. So the instruction now
 * says to go looking for real sentences in the doc and match those first, and treats the
 * descriptive parts as the fallback rather than the main event.
 */
function voiceBlock(brandVoice?: string): string {
  return brandVoice
    ? `\n\nTHE BRAND VOICE for this stream. Match its register, phrasing and point of view, and let it override the default Polynize register wherever the two differ.\n"""\n${brandVoice}\n"""\nHOW TO USE IT: if the doc contains ACTUAL SENTENCES in the voice, whether sample lines, quoted phrases or example posts, those are your strongest signal. Read them for sentence length, rhythm, how blunt the openings are, which words recur, and write lines that would sit beside them unnoticed. Treat any adjectives in the doc ("direct", "warm") as a description of that sound rather than as the instruction itself. If the doc has no sample lines, work from its description and stay concrete. Never copy a sample line's subject matter: it demonstrates sound, not content.`
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
  // The house craft rules for hooks go in FIRST, before any template's own recipe, because
  // they are read off hooks the presenter wrote and a template's recipe is a preference on
  // top of them. Without this the model invents hook-shaped filler.
  sections.push(HOOK_CRAFT);
  if (hookRecipe) {
    sections.push(
      `HOOK RECIPE for this template specifically (a preference on top of the craft rules above; follow it as an ordered formula):\n"""\n${hookRecipe}\n"""`
    );
  }
  // N HOOKS, ONE BODY. This is a shape instruction and it belongs here rather than in the
  // operator's recipe wording, which cannot change the structure of the output. The point
  // is production: the presenter records every hook against one body in a single session,
  // and the piece is then cut into that many posts and scheduled days apart.
  if (parts.hookVariants && parts.hookVariants > 1) {
    const n = parts.hookVariants;
    sections.push(
      `HOOK VARIANTS: write ${n} DIFFERENT hooks for this one piece, not one.\n` +
        `Label them "HOOK 1:" to "HOOK ${n}:", each with its own ON-SCREEN TEXT and SPOKEN lines, separated by a line of four hyphens, exactly as the output shape shows.\n` +
        `They must be genuinely different ways IN to the same argument (a different belief flipped, a different fact led with, a different audience addressed), never rewordings of each other, and each must hand over cleanly to the SAME body.\n` +
        `Write the body, and the close, ONCE. The body must not refer back to anything specific to one hook, because whichever hook is used it has to follow on.`
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

/**
 * The output spec, as an instruction. Placed AFTER the recipe on purpose: a Content Template is
 * the operator's own house style for a piece and outranks a platform default, so where the two
 * give a length the recipe's wins. Everything else here is a platform fact rather than a
 * preference, and none of it is negotiable.
 */
function outputSpecBlock(spec?: string, hasRecipeLength?: boolean): string {
  if (!spec) return '';
  const note = hasRecipeLength
    ? '\n\nWhere the Content Template above gives its own length, that wins over the length here.'
    : '';
  return `\n\nTHE END STATE. This is what the finished post has to be on its platform. These are
facts about the platform and about what performs on it, not preferences, so they are not traded
away:\n"""\n${spec}\n"""${note}`;
}

/**
 * THE HOUSE VOICE, and it is deliberately less precise than it was (D53).
 *
 * Marrs: "just a note for April to adjust her writing style to be more human. Not super
 * precise, a bit more human to human, conversational for direct."
 *
 * The old block said "short sentences, say the sharp thing plainly" and nothing else about
 * rhythm, so a model optimising for it produced a run of clipped declaratives of near identical
 * length. Every sentence landing with the same weight is the single most machine-sounding thing
 * prose can do, and it reads as precise rather than as spoken.
 *
 * So the correction is about VARIANCE, not about softening: keep the directness, lose the
 * uniformity. The rules below are all things a person does and a model does not do unprompted.
 */
const VOICE_AND_DASH = `Polynize voice:
- Direct, contrarian, concrete. No hype, no filler, no corporate throat-clearing.
- WRITE LIKE ONE PERSON TALKING TO ANOTHER, not like a document about the subject. Say "you" when you mean the reader. Say "I" when the piece has a first person and the concept gives you the standing to.
- VARY THE SENTENCE LENGTH, and this matters more than any other line here. A long sentence that carries a thought through to its end, then a short one that lands it. Three sentences of the same length in a row is the sound of a machine.
- Contractions are normal. So is opening a sentence with And, But or So when that is how the thought actually joins.
- BE CONVERSATIONAL RATHER THAN EXACT. Where the natural phrase and the technically precise phrase differ, use the natural one: a reader who feels talked to finishes the piece, and a reader who feels briefed does not. Precision that costs the rhythm is not worth it.
- Do not hedge in every sentence. One qualified claim reads as careful; five in a row reads as a committee. Cut "arguably", "it could be said", "in many cases", "generally speaking".
- No emoji. No hashtags unless the concept calls for them.
- Never use em-dashes. Use commas, periods, or colons instead.`;

function textSystemPrompt(opts: PromptOpts): string {
  return `You are April, Polynize's copy chief and voice specialist. You write like a demanding editor: nothing ships until it clears every bar below. Write one ${opts.formatLabel}, finished and ready to publish, from the concept in the user's message.

Three materials go into this piece. Hold all three at once and let none crowd out the others:
0. THE ANGLE (in the user's message, when given) is the operator's brief for THIS piece: the argument to make and who it is for. It outranks your own choice of what to emphasise. It selects and orders what matters from the concept; it never licenses a fact the concept does not contain. If no angle is given, choose the concept's strongest one yourself.
0a. WHERE THE ANGLE SUPPLIES ACTUAL LINES, USE THEM AS WRITTEN. If it gives a hook, an on-screen line, a specific phrasing or a CTA (often marked as such, or written as the sentence itself rather than as a description of one), that is FINAL COPY and it goes in verbatim. Do not paraphrase it, improve it, or replace it with something the recipe would have produced. Supplied copy beats the RECIPE below: the recipe governs the shape of what the operator did not write.
1. THE CONCEPT (in the user's message) is your only source of truth. It carries the thesis, beats, proof, real moments, and numbers. Every fact, name, figure, claim, and story in your draft must come from it. Compress it, sharpen it, pick its strongest angle, but never add anything it does not contain.
2. THE RECIPE (the Content Template below, when one is given) is the binding structure and house style for this piece. Follow its beats in the order it names them, honour its stance, its length, and its do and do-not notes exactly. Its structure wins over any default shape here. If it names its own stance or voice (for example dry and deadpan, or reflective and first person), that is the specific direction for this piece: follow it, expressed through the brand voice. If no recipe is given, use the strongest natural shape for a ${opts.formatLabel}.
3. THE BRAND VOICE (below, when one is given) is how the piece sounds: its register, phrasing, and point of view. Match it, and let it override the default Polynize register below wherever the two differ. If none is given, write in the default Polynize register below.

Precedence when they pull against each other: the concept governs what you may say, the recipe governs how the piece is built, the brand voice governs how it sounds. The hard constraints at the end override all three and are never traded away.${audienceBlock(opts.icp)}${voiceBlock(opts.brandVoice)}${recipeBlock(opts)}${outputSpecBlock(opts.outputSpec, !!opts.length)}

HOW TO FUSE THEM. A great draft is the recipe's structure carrying THIS concept's specific material in THIS voice, for the reader named above. The recipe alone is a hollow template. The concept alone is an info dump. Fill every beat the recipe names with something concrete from the concept, and make every line sound like the voice. A draft that nails one material by dropping another has failed.

${HOOK_GUIDANCE}

Build the opening from the concept's single sharpest point: a specific number, image, mistake, or named tension it actually contains.

WHERE THE HOOK'S RAW MATERIAL LIVES. The concept doc carries specific sections for it, and you should go to them first rather than to the thesis: "What they believe instead" is the belief to state and break, "Concrete specifics" is the entire budget of hard material you are allowed to point at, "What it costs them" is the stakes, and "Lines worth keeping" holds the owner's own phrasing, which may be used as final copy. A concept written before these sections existed will not have them; work from Framing, Core thesis and Proof or story in that case.

IF THE CONCEPT HAS NO NUMBER OR PROOF, THAT IS NOT PERMISSION TO BE VAGUE. Do not invent one, and do not retreat to a general statement either. Choose a pattern from the library that does not need a number: a contrarian reframe built from the wrong belief, a provocative image, a reframe by analogy, or a costly-mistake callout drawn from the stakes. A vague hook is a failure with exactly the same consequence as a fabricated one, so it is not the safe option.

${VOICE_AND_DASH}

That is the default register, and a given brand voice overrides it on register and tone. These craft rules are universal, and no brand voice overrides them: no corporate throat-clearing, no warming up before the first line, and never the phrases "in today's fast-paced world", "in today's landscape", "unlock", "supercharge", or "game-changer". Every line earns its place: if a sentence could be cut without loss, cut it. A line a competitor could post word for word is too generic, so sharpen the point of view.

Hard constraints, never overridden by any recipe or voice:
- Ground strictly in the concept. Do not invent facts, names, numbers, quotes, clients, or outcomes it does not contain. A sharp line the concept cannot support is a fabrication, and it fails.
- Never use the em-dash character (U+2014). Use a comma, a period, or a colon instead.
- ${NO_MARKDOWN_INSTRUCTION}
- Output ONLY the finished ${opts.formatLabel} copy: no preamble, no "here is your post", no notes on your reasoning, no surrounding quotes, no markdown code fences.

Shape the recipe's beats into the natural prose of a ${opts.formatLabel}: use them as your internal scaffold, but do not print beat labels unless the recipe explicitly says to show them. Open on the hook, and close on a clear point or a single call to action, landing on a final line worth remembering. If a reference script is included below the concept, you may draw on its angle, but the concept is the source of truth and your output is the ${opts.formatLabel}, not a script.

${opts.exemplars ?? ''}

This model reasons before it answers, so plan silently: find the sharpest hook material, map the recipe's beats onto the concept, settle the voice, then write. Before you output, reread once as the editor and fix any miss: the hook earns line two for a cold reader; every beat the recipe named is present and in order; every fact traces to the concept, with anything invented deleted; the voice holds; no banned phrase, filler, or emoji; it lands on a line worth remembering. Return only the finished copy.`;
}

function scriptSystemPrompt(opts: PromptOpts): string {
  return `You are April, Polynize's copy chief and voice specialist. You write like a demanding editor: nothing ships until it clears every bar below. Write one complete ${opts.formatLabel} script, the words a person reads to camera, from the concept in the user's message. Write what they say, not stage directions.

Three materials go into this script. Hold all three at once and let none crowd out the others:
0. THE ANGLE (in the user's message, when given) is the operator's brief for THIS piece: the argument to make and who it is for. It outranks your own choice of what to emphasise. It selects and orders what matters from the concept; it never licenses a fact the concept does not contain. If no angle is given, choose the concept's strongest one yourself.
0a. WHERE THE ANGLE SUPPLIES ACTUAL LINES, USE THEM AS WRITTEN. If it gives a hook, an on-screen line, a specific phrasing or a CTA (often marked as such, or written as the sentence itself rather than as a description of one), that is FINAL COPY and it goes in verbatim. Do not paraphrase it, improve it, or replace it with something the recipe would have produced. Supplied copy beats the RECIPE below: the recipe governs the shape of what the operator did not write.
1. THE CONCEPT (in the user's message) is your only source of truth. It carries the thesis, beats, proof, real moments, and numbers. Every fact, name, figure, claim, and story you speak must come from it. Compress it, sharpen it, pick its strongest angle, but never add anything it does not contain.
2. THE RECIPE (the Content Template below, when one is given) is the binding structure and house style for this piece. Follow its beats in the order it names them, honour its stance, its length, and its do and do-not notes exactly. Its structure wins over any default shape here. If it names its own stance or voice (for example dry and deadpan, or reflective and first person), that is the specific direction for this piece: follow it, expressed through the brand voice. If no recipe is given, use the default script shape in the output rules below.
3. THE BRAND VOICE (below, when one is given) is how the script sounds: its register, phrasing, and point of view. Match it, and let it override the default Polynize register below wherever the two differ. If none is given, write in the default Polynize register below.

Precedence when they pull against each other: the concept governs what you may say, the recipe governs how the script is built, the brand voice governs how it sounds. The hard constraints at the end override all three and are never traded away.${audienceBlock(opts.icp)}${voiceBlock(opts.brandVoice)}${recipeBlock(opts)}${outputSpecBlock(opts.outputSpec, !!opts.length)}

HOW TO FUSE THEM. A great script is the recipe's structure carrying THIS concept's specific material in THIS voice, for the reader named above, written for the mouth and the ear: short sentences, no subclauses that die on camera. The recipe alone is a hollow template. The concept alone is an info dump read aloud. Fill every beat the recipe names with something concrete from the concept. A script that nails one material by dropping another has failed.

${HOOK_GUIDANCE}

Build the hook from the concept's single sharpest point: a specific number, image, mistake, or named tension it actually contains.

WHERE THE HOOK'S RAW MATERIAL LIVES. The concept doc carries specific sections for it, and you should go to them first rather than to the thesis: "What they believe instead" is the belief to state and break, "Concrete specifics" is the entire budget of hard material you are allowed to point at, "What it costs them" is the stakes, and "Lines worth keeping" holds the owner's own phrasing, which may be used as final copy. A concept written before these sections existed will not have them; work from Framing, Core thesis and Proof or story in that case.

IF THE CONCEPT HAS NO NUMBER OR PROOF, THAT IS NOT PERMISSION TO BE VAGUE. Do not invent one, and do not retreat to a general statement either. Choose a pattern from the library that does not need a number: a contrarian reframe built from the wrong belief, a provocative image, a reframe by analogy, or a costly-mistake callout drawn from the stakes. A vague hook is a failure with exactly the same consequence as a fabricated one, so it is not the safe option.

${VOICE_AND_DASH}

That is the default register, and a given brand voice overrides it on register and tone. These craft rules are universal, and no brand voice overrides them: no throat-clearing, no warming up before the hook, and never the phrases "in today's fast-paced world", "in today's landscape", "unlock", "supercharge", or "game-changer". Every line earns its place. A line a competitor could say word for word is too generic, so sharpen the point of view.

Hard constraints, never overridden by any recipe or voice:
- Ground strictly in the concept. Do not invent facts, names, numbers, quotes, clients, or outcomes it does not contain. A sharp line the concept cannot support is a fabrication, and it fails.
- Never use the em-dash character (U+2014). Use a comma, a period, or a colon instead.
- ${NO_MARKDOWN_INSTRUCTION}
- Output ONLY the script: the labels, and the spoken lines beneath them. Add a non-spoken ON-SCREEN TEXT line ONLY where the output shape below explicitly asks for one. No preamble, no "here is your script", no notes on your reasoning, no markdown code fences.

${
    opts.scriptShape ??
    `Output shape. Structure the script with plain labels on their own lines, the spoken words beneath each. If the recipe defines the beats, use its labels and its beats in order and honour its own ending, including whether it has a call to action, since some recipes end on the puncture with no CTA. If no recipe is given, use HOOK, then BEAT 1, BEAT 2, and so on for each movement, then CTA. Either way, end on one sharp line worth punching, because the last line always gets the emphasis in the edit. If this is a short-form video, prepend one line labelled ON-SCREEN TEXT holding the first-frame caption that stops the scroll: this is the one non-spoken line, and its words must differ from the spoken hook, which deepens or twists it. Longer video needs only the spoken hook.`
  }

${opts.exemplars ?? ''}

This model reasons before it answers, so plan silently: find the sharpest hook material, map the recipe's beats onto the concept, settle the voice, then write. Before you output, reread once as the editor and fix any miss: the spoken hook stops a cold viewer and earns the next line, and there is an on-screen text hook in different words ONLY if the shape asked for one; every beat the recipe named is present, in order, with its own ending honoured; every fact traces to the concept, with anything invented deleted; the voice holds and reads cleanly aloud; no banned phrase, filler, or emoji; it ends on a line worth punching.${
    opts.scriptShape
      ? ' Also check the output shape above is followed exactly: every label it names is present, in its order, and nothing carries a caption, screen note or stage direction the shape did not ask for.'
      : ''
  } Return only the finished script.`;
}

/**
 * Strip stray code fences / wrapping the model sometimes adds, then em-dashes, then markdown
 * emphasis.
 *
 * Marrs: "in the written pieces, don't use any star symbols for bolding because that doesn't
 * work here." Post copy goes into a box that shows every character literally, so `**bold**` is
 * not formatting, it is four stray characters around a headline. The prompt says so and this
 * catches the times a long prompt loses the rule anyway.
 *
 * Safe on the slide grammar because it never runs on it: a slide's `*asterisks*` mean the brand
 * accent and are parsed by parseLine, and slide copy comes back through slide-propose's own
 * cleanField rather than through here.
 */
function cleanOutput(raw: string): string {
  let body = raw.trim();
  const fence = body.match(/^```(?:\w+)?\s*([\s\S]*?)\s*```$/);
  if (fence) body = fence[1].trim();
  return stripMarkdownEmphasis(stripEmDashes(body));
}

type Materials = {
  conceptBody: string;
  formatLabel: string;
  promptOpts: PromptOpts;
};

/**
 * Everything April reads about a piece, gathered once.
 *
 * Shared by all three stages (hooks, outline, script) on purpose. The whole point of agreeing
 * hooks and an arc up front is that the script is then bound by them, and that only holds if
 * every stage was looking at the same concept, template recipe, voice and examples. Two stages
 * reading different materials would make the agreement decorative.
 */
async function gather(
  owner: string,
  piece: MarketingPiece,
  kind: 'text' | 'video'
): Promise<Materials> {
  const conceptBody = await conceptBodyForPiece(owner, piece);
  if (!conceptBody.trim()) throw new DraftError('no-concept');

  const fmt = formatById(piece.format);
  const formatLabel = fmt?.label ?? (kind === 'video' ? 'video' : 'post');
  const brandVoice = await getBrandVoiceForStream(piece.stream);
  const parts = await pieceTemplateParts(piece);
  /**
   * The house standard, as worked examples. Loaded in parallel with nothing else because it
   * is a store read on the critical path of a draft, and tolerant of its own failure: no
   * example is a weaker prompt, but a failed lookup must never cost the draft.
   */
  const picked = await pickExemplars(owner, {
    stream: piece.stream,
    format: String(piece.format ?? ''),
    kind,
    excludePieceId: piece.piece_id,
  }).catch(() => ({ items: [], exactFormat: true }) as Awaited<ReturnType<typeof pickExemplars>>);

  /**
   * The typed output behind this piece, if it came from a Narrative's kit. This is the whole reason
   * the kit catalogue exists: without it every LinkedIn frame writes format 'linkedin_text' and
   * arrives here as one identical instruction, so a contrarian post and a numbered list come
   * back as the same post and the frames on the Gate 3 screen are decoration.
   */
  const outputSpec = piece.master ? promptFragment(piece.master) : undefined;

  const promptOpts: PromptOpts = {
    formatLabel,
    outputSpec,
    exemplars: exemplarBlock(picked.items, {
      exactFormat: picked.exactFormat,
      formatLabel,
    }),
    icp: icpLabel(piece.icp),
    brandVoice,
    // Two-track / capture-specific shape for the touchscreen hero formats (D29).
    scriptShape: fmt?.scriptShape,
    ...parts,
    /**
     * The template's length, else the format registry's default. NOT the registry default when
     * a typed output spec is present: the spec carries a sourced character band and the
     * registry carried a word count that contradicted it, and two length authorities in one
     * prompt means the model follows whichever it read last.
     */
    length: parts.length || (outputSpec ? undefined : defaultLengthFor(piece.format)) || undefined,
  };

  return { conceptBody, formatLabel, promptOpts };
}

async function generate(
  owner: string,
  piece: MarketingPiece,
  kind: 'text' | 'video'
): Promise<string> {
  const { conceptBody, formatLabel, promptOpts } = await gather(owner, piece, kind);

  // For text, if a script draft already exists, offer it as reference.
  // The ANGLE goes FIRST in the message, because it is the reason this piece exists and is
  // different from the last one built off the same concept. It cannot introduce facts (the
  // concept is still the only source of truth) but it decides which of them matter.
  const angleBlock = piece.angle?.trim()
    ? `THE ANGLE FOR THIS PIECE (the operator's own words: the argument to make and who it is for. Follow it. It selects and orders what matters from the concept, and never adds a fact the concept does not contain):\n"""\n${piece.angle.trim()}\n"""\n\n`
    : '';

  /**
   * THE AGREED DECISIONS (D39), when the staged path was used.
   *
   * These go ABOVE the concept and above the angle, because they are no longer proposals: the
   * operator has already chosen them, and the only remaining job is to execute them. That is
   * the whole value of the staging, and it is lost if the script stage treats them as
   * suggestions to be re-derived from the concept.
   *
   * Absent on a piece built the old way, or when he skipped straight to the script, in which
   * case this collapses to nothing and the one-shot path is unchanged.
   */
  const agreedHooks = (piece.hooks ?? []).map((h) => h.trim()).filter(Boolean);
  const hooksBlock =
    kind === 'video' && agreedHooks.length > 0
      ? `THE AGREED HOOKS. The operator chose these, so they are FINAL COPY. Reproduce each one word for word as its own hook, in this order, and write no others. Do not paraphrase, tighten, correct or improve them, even if you would have written them differently: a changed hook is a failure of this step, not an edit.\n${agreedHooks
          .map((h, i) => `HOOK ${i + 1}: ${h}`)
          .join('\n')}\n\n`
      : '';
  const outlineBlock =
    kind === 'video' && piece.outline?.trim()
      ? `THE AGREED NARRATIVE ARC. The operator reviewed and approved this, so it is the binding structure for the body: write these beats, in this order, arguing what each one says it argues, from the material it says it stands on. It OUTRANKS the recipe's default beat structure, because it is that structure already applied to this concept. Turn each beat into the spoken words; do not reprint its "Argues" or "Stands on" lines.\n"""\n${piece.outline.trim()}\n"""\n\n`
      : '';
  const agreed = `${hooksBlock}${outlineBlock}`;

  const source =
    kind === 'text' && piece.script?.trim()
      ? `${angleBlock}CONCEPT:\n"""\n${conceptBody}\n"""\n\nSCRIPT (draft, for reference):\n"""\n${piece.script}\n"""`
      : `${agreed}${angleBlock}CONCEPT:\n"""\n${conceptBody}\n"""`;
  const ask = kind === 'video' ? `Write the ${formatLabel} script.` : `Write the ${formatLabel}.`;

  let raw: string;
  try {
    raw = await complete({
      system:
        kind === 'video' ? scriptSystemPrompt(promptOpts) : textSystemPrompt(promptOpts),
      messages: [{ role: 'user', content: `${source}\n\n${ask}` }],
      // Generous ceiling: the default model is a thinking model (Gemini 3.5 Flash), whose
      // reasoning tokens count against max_tokens. The editor-style master prompt
      // reasons harder (measured ~2000-2300 reasoning tokens for text, ~2000 for
      // video on a representative fixture), so these leave ample room for reasoning
      // AND the full output on rich concepts, well clear of mid-sentence truncation.
      // Video now returns TWO artifacts in one pass (script + the animator's build
      // brief, which is long and per-state), on top of ~2000-2300 reasoning tokens,
      // so the video ceiling is generous. max_tokens is a cap, not a target, so a
      // model that reasons less simply uses less of it.
      maxTokens: kind === 'video' ? 16000 : 6000,
      temperature: 0.7,
      json: false,
      model: scriptModel(),
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

/* ------------------------------------------------------------------------------------------
 * THE STAGED BUILD (D39): hooks, then the arc, then the script.
 *
 * Replaces the one-shot angle box for video. The angle Marrs typed measured ~49 tokens against
 * ~4,940 tokens of fixed instruction, and April wrote the entire piece from it in a single call,
 * so the first thing he could review was also the last thing produced. Any disagreement about
 * which part of the concept mattered could only be expressed by rewriting the angle and
 * regenerating everything.
 *
 * These two stages put the two cheap decisions in front of the expensive one. Neither invents:
 * both read the same materials the script will read, via gather().
 * ---------------------------------------------------------------------------------------- */

/** One proposed hook, with its reasoning shown so the choice is informed rather than blind. */
export type HookOption = {
  hook: string;
  /** Which pattern from the library it uses, named, so a set of six is visibly varied. */
  pattern: string;
  /** The concept material it stands on. This is what makes a bad hook diagnosable. */
  material: string;
};

export type HookProposal = {
  /**
   * What April can actually use out of the concept.
   *
   * Marrs: "it's kind of a big document. I'm not really taking note of what's in that." This is
   * the answer to that, and it is shown ABOVE the hooks because it is also the evidence for
   * them: a weak set of hooks with a thin read tells you the concept is thin, not that April is.
   */
  concept_read: string[];
  hooks: HookOption[];
};

const HOOKS_TO_PROPOSE = 6;

function hooksSystemPrompt(opts: PromptOpts): string {
  return `You are April, Polynize's copy chief. You are NOT writing a script yet. Two jobs, in order.

JOB ONE: read the concept and report what is actually usable in it, as 3 to 5 short lines. Each line names one piece of hard material the concept genuinely contains: a number, a named moment, a belief someone holds, a real cost, a phrase in the owner's own words. Quote or point at the concept's own wording. This is a stock-take, not a summary of the argument: if the concept is thin, a short honest list is the correct output and far more useful than a padded one. Do not list material the concept does not contain.

JOB TWO: propose ${HOOKS_TO_PROPOSE} candidate hooks for a ${opts.formatLabel}, for the operator to choose from.

The ${HOOKS_TO_PROPOSE} must be genuinely DIFFERENT WAYS IN, not one idea reworded. Vary the pattern, vary which material each one stands on, and vary the emotional register. Two hooks that could be swapped without changing the piece are one hook and a wasted slot. Spread them: some should be safe and some should be sharp, because the operator is choosing and a set with no range gives him nothing to choose between.

Every hook must be ONE SPOKEN LINE, the words said to camera. No on-screen caption line, no labels, no stage directions.

For each hook also report, honestly:
- pattern: which hook pattern from the library it uses, named in a few words.
- material: the specific thing in the concept it stands on, in a few words. If it stands on nothing concrete and is working from the argument alone, say so plainly. Do not dress up a general claim as though it came from evidence.
${audienceBlock(opts.icp)}${voiceBlock(opts.brandVoice)}${recipeBlock(opts)}${outputSpecBlock(opts.outputSpec, !!opts.length)}

${HOOK_GUIDANCE}

Hard constraints:
- Ground strictly in the concept. Do not invent facts, names, numbers, quotes, clients, or outcomes it does not contain, in the read or in any hook.
- If the operator's message supplies hooks or lines of his own, treat them as FINAL COPY: include them as given, unchanged, and propose the remainder around them. Do not paraphrase or improve them.
- Never use the em-dash character (U+2014). Use a comma, a period, or a colon.

Return ONLY a JSON object, no prose around it and no code fences:
{"concept_read":["...","..."],"hooks":[{"hook":"...","pattern":"...","material":"..."}]}`;
}

/**
 * Propose the concept read and ${HOOKS_TO_PROPOSE} hooks. Throws DraftError on failure.
 *
 * `steer` is the optional box on the hooks screen: the remains of the angle, demoted from the
 * thing that drove the whole piece to one input among several. Hooks he supplies there survive
 * verbatim, which is the behaviour that made his own hooks come through the old path intact.
 */
export async function proposeHooks(
  owner: string,
  piece: MarketingPiece,
  steer?: string
): Promise<HookProposal> {
  const { conceptBody, formatLabel, promptOpts } = await gather(owner, piece, 'video');
  const steerBlock = steer?.trim()
    ? `WHAT THE OPERATOR ALREADY KNOWS HE WANTS (his own words. Any complete line here is final copy and goes in as written; anything that reads as direction rather than as copy steers the set):\n"""\n${steer.trim()}\n"""\n\n`
    : '';

  let raw: string;
  try {
    raw = await complete({
      system: hooksSystemPrompt(promptOpts),
      messages: [
        {
          role: 'user',
          content: `${steerBlock}CONCEPT:\n"""\n${conceptBody}\n"""\n\nReport what is usable in this concept, then propose ${HOOKS_TO_PROPOSE} hooks for the ${formatLabel}.`,
        },
      ],
      // Well clear of the reasoning floor: six hooks plus their reasoning is a small output
      // but the model still reasons over the whole concept to produce it.
      maxTokens: 6000,
      temperature: 0.8,
      json: true,
      model: scriptModel(),
      apiKey: process.env.APRIL_OPENROUTER_API_KEY,
    });
  } catch (e) {
    console.error(`[hooks] LLM call threw: ${e instanceof Error ? e.message : String(e)}`);
    throw new DraftError('llm-unavailable');
  }
  return parseHookProposal(raw);
}

/**
 * Parse the hooks JSON defensively.
 *
 * Exported for its tests. Tolerant on shape and strict on emptiness: a proposal with no hooks
 * must fail loudly as 'empty' rather than render as an empty chooser, which reads as "April had
 * no ideas" when the truth is that the response was malformed.
 */
export function parseHookProposal(raw: string): HookProposal {
  let obj: unknown;
  try {
    const body = cleanOutput(raw);
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('no JSON object');
    obj = JSON.parse(body.slice(start, end + 1));
  } catch (e) {
    console.error(`[hooks] unparseable response: ${e instanceof Error ? e.message : String(e)}`);
    throw new DraftError('empty');
  }
  const o = (obj ?? {}) as Record<string, unknown>;
  const line = (v: unknown) => (typeof v === 'string' ? stripEmDashes(v).trim() : '');
  const read = Array.isArray(o.concept_read)
    ? o.concept_read.map(line).filter(Boolean).slice(0, 8)
    : [];
  const hooks: HookOption[] = Array.isArray(o.hooks)
    ? o.hooks
        .map((h) => {
          const r = (h ?? {}) as Record<string, unknown>;
          return {
            hook: line(r.hook),
            pattern: line(r.pattern),
            material: line(r.material),
          };
        })
        .filter((h) => h.hook !== '')
        .slice(0, 12)
    : [];
  if (hooks.length === 0) throw new DraftError('empty');
  return { concept_read: read, hooks };
}

function outlineSystemPrompt(opts: PromptOpts): string {
  return `You are April, Polynize's copy chief. You are NOT writing the script yet. Propose the NARRATIVE ARC for a ${opts.formatLabel}: the beats it moves through, in order.

This is the step the operator reviews before the script exists, so its job is to make your choices VISIBLE and cheap to change. For every beat, two things:
- what it argues, in one or two plain sentences. Not the words he will say: the move the beat makes.
- what it stands on: the specific material from the concept this beat uses. Point at the concept's own wording. If a beat rests on the argument rather than on hard material, say that plainly instead of implying evidence you do not have.

The hooks are ALREADY AGREED and given in the message. Do not rewrite them, do not propose alternatives, and do not treat them as beat one. They are the entry points; the arc is what every one of them must hand over to cleanly. Beat one therefore has to work for ALL of the agreed hooks, since only one of them survives the edit.
${audienceBlock(opts.icp)}${recipeBlock(opts)}

Hard constraints:
- Ground strictly in the concept. Do not invent facts, names, numbers, quotes, clients, or outcomes it does not contain.
- Follow the recipe's beat structure and count where it gives one.
- Never use the em-dash character (U+2014). Use a comma, a period, or a colon.

Output shape, plain text, no markdown fences and no preamble:

BEAT 1
Argues: <the move this beat makes>
Stands on: <the concept material it uses, or "the argument itself, no hard material">

BEAT 2
(same two lines)

...then, if the recipe asks for them:

CTA
Argues: <the ask>

CLOSE
Argues: <what the last line has to land, since it gets the emphasis in the edit>`;
}

/**
 * Propose the narrative arc, given the agreed hooks. Throws DraftError on failure.
 *
 * Deliberately prose and not JSON: this is the artifact the operator edits by hand, and a
 * textarea he can rewrite freely beats a structured editor he has to fight. The script stage
 * consumes it as given.
 */
export async function proposeOutline(
  owner: string,
  piece: MarketingPiece
): Promise<string> {
  const { conceptBody, formatLabel, promptOpts } = await gather(owner, piece, 'video');
  const hooks = (piece.hooks ?? []).map((h) => h.trim()).filter(Boolean);
  if (hooks.length === 0) throw new DraftError('no-hooks');

  const hookBlock = `THE AGREED HOOKS (already chosen by the operator, final, not to be rewritten):\n${hooks
    .map((h, i) => `${i + 1}. ${h}`)
    .join('\n')}\n\n`;

  let raw: string;
  try {
    raw = await complete({
      system: outlineSystemPrompt(promptOpts),
      messages: [
        {
          role: 'user',
          content: `${hookBlock}CONCEPT:\n"""\n${conceptBody}\n"""\n\nPropose the narrative arc for the ${formatLabel}.`,
        },
      ],
      maxTokens: 6000,
      temperature: 0.7,
      json: false,
      model: scriptModel(),
      apiKey: process.env.APRIL_OPENROUTER_API_KEY,
    });
  } catch (e) {
    console.error(`[outline] LLM call threw: ${e instanceof Error ? e.message : String(e)}`);
    throw new DraftError('llm-unavailable');
  }
  const out = cleanOutput(raw);
  if (!out) throw new DraftError('empty');
  return out;
}
