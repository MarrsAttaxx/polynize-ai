/**
 * GATE 2: the article. An idea becomes the long form everything else is cut from.
 *
 * Marrs: "it needs to start with a long-form piece of content, which is not super long.
 * The idea is it's just capturing all the beats. It's giving a narrative of the piece,
 * and it's telling a story." The article publishes as-is on LinkedIn later and every
 * other piece in the kit is cut from it, so this is the one draft that has to carry the
 * whole story on its own.
 *
 * The old interview step is dead (Gates decision 1): an idea goes straight to a drafted
 * article, then the operator refines it in chat with April. So this file is exactly two
 * calls: the one-shot draft, and the one-instruction revision the chat loop makes.
 *
 * Server-side only; billed to April's key. Same call shape as lib/marketing/draft.ts.
 */

import type { NarrativeLane } from './narrative-store';
import { streamKind, type StreamKind } from './streams';
import { getBrandVoiceForStream } from './brand-voice-store';
import { complete } from '@/lib/llm';
import { stripEmDashes } from '@/lib/em-dash';
import { stripMarkdownEmphasis, NO_MARKDOWN_INSTRUCTION } from '@/lib/plain-copy';

/**
 * Same per-task model override as draft.ts (SCRIPT_MODEL). The article is pure writing,
 * the job whose output is judged as writing more than anything else in PAM, so it rides
 * the same knob the script and text drafts already use rather than growing its own. An
 * env var rather than a constant so the same idea can be run through two models back to
 * back without a deploy between them. Falls through to OPENROUTER_MODEL when unset.
 */
const scriptModel = () => process.env.SCRIPT_MODEL || undefined;

/**
 * The lane register, the part of the voice that is structural rather than stylistic.
 * Lane ids equal stream ids by design, so the same id also fetches the stream's
 * brand-voice doc: this block is the frame, the doc refines it, and when no doc exists
 * this block is the whole instruction.
 */
const LANE_VOICE: Partial<Record<NarrativeLane, string>> = {
  marrs:
    "This is the MARRS lane: first person, opinionated, personality forward. The operator's own perspective on AI and the industry, in his own voice. Take a position and hold it start to end; hedging reads as though someone else wrote it.",
  polynize:
    'This is the POLYNIZE lane: educational, concrete, show-the-work. It is about capability mapping and organisational design. Teach by walking through the actual thing, step by visible step, rather than asserting conclusions about it.',
};

/**
 * A lane with no hand-written register above falls back to its KIND (D45), because writing a
 * paragraph per teammate would be inventing four people's voices for them. A person's real
 * voice belongs in their own brand-voice doc, which this block only frames; a fabricated
 * register here would fight that doc rather than support it.
 *
 * Partial<Record> rather than a full one on purpose: adding a teammate to STREAMS must not be
 * a compile error in a prompt file, and a missing entry is a correct fallback rather than a gap.
 */
const KIND_VOICE: Record<StreamKind, string> = {
  person:
    'This is a PERSONAL lane: first person, one named human writing in their own voice. A position taken and held, with their own experience behind it. If their brand-voice doc below says something more specific, that wins.',
  company:
    'This is a BRAND lane: educational, concrete, show-the-work, written for the company rather than by a person. Teach by walking through the actual thing rather than asserting conclusions about it, and never claim first-person experience the brand cannot have.',
};

function laneVoice(lane: NarrativeLane): string {
  return laneVoice(lane) ?? KIND_VOICE[streamKind(lane)];
}

/**
 * HOW TO USE THE VOICE DOC, not just "here is a voice doc". Same reasoning as draft.ts:
 * the docs are freeform Markdown, sample lines are the strong signal and adjectives the
 * weak one, because a writer can imitate a line and can only approximate an adjective.
 */
function voiceBlock(brandVoice?: string): string {
  return brandVoice
    ? `\n\nTHE BRAND VOICE for this lane. Match its register, phrasing and point of view, and let it refine the lane register above wherever it is more specific.\n"""\n${brandVoice}\n"""\nHOW TO USE IT: if the doc contains ACTUAL SENTENCES in the voice, whether sample lines, quoted phrases or example posts, those are your strongest signal. Read them for sentence length, rhythm, how blunt the openings are, which words recur, and write lines that would sit beside them unnoticed. Treat any adjectives in the doc ("direct", "warm") as a description of that sound rather than as the instruction itself. Never copy a sample line's subject matter: it demonstrates sound, not content.`
    : '';
}

function articleSystemPrompt(lane: NarrativeLane, brandVoice?: string): string {
  return `You are April, Polynize's copy chief and voice specialist. Write ONE article, 300 to 450 words, from the idea in the user's message.

WHAT THE ARTICLE IS. It is the long form every other piece is cut from, and it publishes as written, so it must stand alone. It is a story TOLD, not a document written: one argument carried start to end (the through-line), moving through clear beats a reader can feel turning, landing on a final line worth remembering. Write it the way you would say it to one person who is interested and short of time. Vary the sentence length, because three of the same length in a row is the sound of a machine, and prefer the natural phrase over the technically precise one wherever the two differ. It is not a listicle, it is not a summary of the idea, and it is not a collection of observations: it is the idea told as a story.

SHAPE. PLAIN TEXT. The first line is the title, on its own line, with nothing around it: no asterisks, no hashes, no quotes. Then a blank line, then the article. 300 to 450 words: the range is a discipline, not a target to pad to. If the argument is done at 320 words, stop.

${laneVoice(lane)}${voiceBlock(brandVoice)}

GROUNDING, the hard rule: the idea is your ONLY source of facts. Do not invent numbers, clients, named outcomes, or statistics. If the idea implies proof it does not supply, write around the gap with conviction rather than fabricating it: argue from the mechanism, the stakes, or the pattern instead of a number you do not have. A specific-sounding invented fact is the worst failure this piece can produce, worse than a vaguer line, because it publishes under the operator's name.

Hard constraints:
- Never use the em-dash character (U+2014). Use a comma, a period, or a colon.
- No hashtags. No emoji.
- ${NO_MARKDOWN_INSTRUCTION}
- Output ONLY the article: no preamble, no "here is your article", no notes on your reasoning, no code fences.

This model reasons before it answers, so plan silently: find the through-line, order the beats, settle the voice, then write. Before you output, reread once as the editor: one argument start to end, every fact traces to the idea with anything invented deleted, the voice holds, and it lands on a final line worth remembering. Return only the article.`;
}

function reviseSystemPrompt(lane: NarrativeLane, brandVoice?: string): string {
  return `You are April, Polynize's copy chief, working as an editor. The user's message carries the current article and ONE instruction. Apply that instruction to the article and return the complete revised article.

Change NOTHING the instruction does not require. Every line the instruction leaves alone stays word for word: this is a targeted edit, not a rewrite, and an unasked-for improvement is a failure here, because the operator has already read and part-approved what is on the page.

Keep the article's discipline while you edit: 300 to 450 words, plain text, first line the bare title, one argument start to end, a final line worth remembering.

${laneVoice(lane)}${voiceBlock(brandVoice)}

GROUNDING still binds: the instruction can rearrange facts or cut them, it can NEVER add new ones. Do not invent numbers, clients, named outcomes, or statistics, even if the instruction seems to want more proof; write around the gap with conviction instead. The idea behind this article was the only source of facts, and an edit does not widen it.

Hard constraints:
- Never use the em-dash character (U+2014). Use a comma, a period, or a colon.
- No hashtags. No emoji.
- ${NO_MARKDOWN_INSTRUCTION}
- Output ONLY the complete revised article: no preamble, no notes on what changed, no code fences.`;
}

/**
 * Strip stray code fences the model sometimes wraps the article in, then em-dashes, then
 * markdown emphasis. Same defensive shape as draft.ts's cleanOutput. Exported for its tests: it
 * is the only pure piece of this file, so it is the piece the tests can actually hold.
 *
 * THE ARTICLE USED TO BE MARKDOWN, on purpose: "the first line is a bold title (**like this**)".
 * Nothing ever rendered it. It sits in a textarea, it is fed to April as source material, and it
 * publishes as written, so the asterisks were only ever four characters wrapped around a
 * headline on their way to a post. Marrs: "don't use any star symbols for bolding because that
 * doesn't work here."
 */
export function cleanArticle(raw: string): string {
  let body = raw.trim();
  const fence = body.match(/^```(?:\w+)?\s*([\s\S]*?)\s*```$/);
  if (fence) body = fence[1].trim();
  return stripMarkdownEmphasis(stripEmDashes(body));
}

/**
 * Draft the article from an idea, one shot. The idea is handed over verbatim because it
 * is the entire fact budget: nothing else conditions what the article may claim.
 * Throws a plain Error('empty') on blank output so the route can map it.
 */
export async function draftArticle(lane: NarrativeLane, idea: string): Promise<string> {
  // Lane ids equal stream ids by design, so the lane fetches its stream's voice doc.
  const brandVoice = await getBrandVoiceForStream(lane);

  const raw = await complete({
    system: articleSystemPrompt(lane, brandVoice),
    messages: [
      {
        role: 'user',
        content: `THE IDEA:\n"""\n${idea}\n"""\n\nWrite the article.`,
      },
    ],
    // Generous ceiling: the default model is a thinking model whose reasoning tokens
    // count against max_tokens (roughly 800 to 950 are mandatory even on small asks,
    // and an editor-style prompt reasons around 2000 to 2300). 6000 leaves ample room
    // for the reasoning AND a 450-word article, well clear of mid-sentence truncation.
    // max_tokens is a cap, not a target, so a model that reasons less uses less of it.
    maxTokens: 6000,
    temperature: 0.7,
    json: false,
    model: scriptModel(),
    apiKey: process.env.APRIL_OPENROUTER_API_KEY,
  });

  const out = cleanArticle(raw);
  if (!out) throw new Error('empty');
  return out;
}

/**
 * Apply ONE instruction to the article and return the complete revised article. This is
 * the call the April chat loop makes, once per operator message, so the instruction is
 * singular on purpose: batching edits would make it impossible to see which one moved
 * what. Throws a plain Error('empty') on blank output so the route can map it.
 */
export async function reviseArticle(
  lane: NarrativeLane,
  article: string,
  instruction: string
): Promise<string> {
  const brandVoice = await getBrandVoiceForStream(lane);

  const raw = await complete({
    system: reviseSystemPrompt(lane, brandVoice),
    messages: [
      {
        role: 'user',
        content: `THE ARTICLE AS IT STANDS:\n"""\n${article}\n"""\n\nTHE INSTRUCTION (apply this one change):\n"""\n${instruction}\n"""\n\nReturn the complete revised article.`,
      },
    ],
    // Same ceiling and reasoning-floor logic as the draft call above.
    maxTokens: 6000,
    // Cooler than the draft on purpose: the editor's whole job is to change nothing
    // the instruction did not ask for, and heat here is drift in the untouched lines.
    temperature: 0.4,
    json: false,
    model: scriptModel(),
    apiKey: process.env.APRIL_OPENROUTER_API_KEY,
  });

  const out = cleanArticle(raw);
  if (!out) throw new Error('empty');
  return out;
}
