/**
 * Propose SLIDES from the script (D29, revised 2026-07-21).
 *
 * Deliberately the simplest generation in the system. April returns only what a human
 * needs to judge: for each slide, what is on screen and what it says. No classes, no
 * colour roles, no gesture choreography, no build brief. All of that is the engine's
 * job and is applied later when the deck is built, which is what keeps the operator's
 * panel readable.
 *
 * Server-side only; billed to April's key.
 */

import type { MarketingPiece } from './piece-store';
import type { Slide } from './slides';
import { getBrandVoiceForStream } from './brand-voice-store';
import { conceptBodyForPiece, DraftError } from './draft';
import { complete } from '@/lib/llm';
import { stripEmDashes } from '@/lib/em-dash';

export const MAX_SLIDES = 6;

const SYSTEM = `You are April, planning the touchscreen slides a presenter performs to camera while they talk.

FEWER, STRONGER SLIDES. Four to six, and SIX IS A HARD MAXIMUM whatever the length of the script. This is NOT one slide per beat: it is the handful of moments worth showing. A slide holds on screen while the presenter keeps talking, so most of the script needs no slide of its own. Read the whole script, find the few turning points the argument pivots on, and give those a slide.

For each slide say only two things:
- VISUAL: what is on screen, in plain words, one picture. Big and simple: three standing pillars, one pillar moved to centre with the others dimmed, a single number, one phrase. Never a bullet list, never a paragraph, never small detail.
- TEXT: the exact words shown on screen, verbatim. Keep it to a few words. Leave it EMPTY when the slide is purely visual, which is often the strongest choice for the opener.

Rules:
- Any word or number on screen is lifted VERBATIM from the concept or script. Never invent a figure.
- Track the script's order.
- Do not describe animation, colour, layout classes, gestures or transitions. Those are handled elsewhere. Only the picture and the words.
- Never use the em-dash character (U+2014).

Return ONLY a JSON object, no markdown and no code fences:
{"note":"<one short sentence to the operator, as a reply in a conversation, saying what you planned or changed>","slides":[{"visual":"<what is on screen>","text":"<the words on screen, or empty>"}]}`;

function parseLoose(raw: string): unknown {
  const t = raw.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const c = fence ? fence[1] : t;
  const a = c.indexOf('{');
  const b = c.lastIndexOf('}');
  if (a === -1 || b === -1) throw new Error('no JSON object');
  return JSON.parse(c.slice(a, b + 1));
}

export async function generateSlides(
  owner: string,
  piece: MarketingPiece,
  direction: string,
  current: Slide[] = []
): Promise<{ slides: Slide[]; note: string }> {
  const script = (piece.script ?? '').trim();
  if (!script) throw new DraftError('no-concept');

  const brandVoice = await getBrandVoiceForStream(piece.stream);
  const conceptBody = await conceptBodyForPiece(owner, piece);

  const parts = [
    conceptBody.trim() ? `CONCEPT (the source of every fact):\n"""\n${conceptBody}\n"""` : '',
    `SCRIPT (pick the few moments worth a slide):\n"""\n${script}\n"""`,
    brandVoice ? `BRAND VOICE (the tone of any words on screen):\n"""\n${brandVoice}\n"""` : '',
    current.length
      ? `THE CURRENT SLIDES (revise these, keeping anything the operator has not asked to change):\n"""\n${current
          .map((s, i) => `${i + 1}. VISUAL: ${s.visual}\n   TEXT: ${s.text}`)
          .join('\n')}\n"""`
      : '',
    direction.trim()
      ? `THE OPERATOR'S DIRECTION (their intent; follow it):\n"""\n${direction.trim()}\n"""`
      : 'The operator gave no direction, so plan it yourself from the script.',
    'Plan the slides.',
  ].filter(Boolean);

  let raw: string;
  try {
    raw = await complete({
      system: SYSTEM,
      messages: [{ role: 'user', content: parts.join('\n\n') }],
      maxTokens: 6000,
      temperature: 0.7,
      json: false,
      apiKey: process.env.APRIL_OPENROUTER_API_KEY,
    });
  } catch (e) {
    console.error(`[slides] LLM threw: ${e instanceof Error ? e.message : String(e)}`);
    throw new DraftError('llm-unavailable');
  }

  let parsed: unknown;
  try {
    parsed = parseLoose(raw);
  } catch {
    throw new DraftError('empty');
  }
  const obj = parsed as { note?: unknown; slides?: unknown };
  const list = Array.isArray(obj.slides) ? obj.slides : [];
  const slides: Slide[] = list
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
    .map((s) => ({
      visual: stripEmDashes(typeof s.visual === 'string' ? s.visual : ''),
      text: stripEmDashes(typeof s.text === 'string' ? s.text : ''),
    }))
    .filter((s) => s.visual || s.text)
    // Cap in code as well as in the prompt: a prompt rule alone once produced 26.
    .slice(0, MAX_SLIDES);
  if (!slides.length) throw new DraftError('empty');

  return {
    slides,
    note:
      typeof obj.note === 'string' && obj.note
        ? stripEmDashes(obj.note)
        : `Planned ${slides.length} slides.`,
  };
}
