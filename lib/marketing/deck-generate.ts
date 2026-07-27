/**
 * DECK generation (D29): April composes the deck's STATES from the locked script plus
 * the operator's direction, using the house vocabulary in deck.ts.
 *
 * This replaces the external animator handoff. Because the engine owns the look and
 * the vocabulary is small and fixed, a generated deck is on-brand by construction and
 * the model only decides content, sequencing and gesture choreography.
 *
 * Server-side only; billed to April's key.
 */

import type { MarketingPiece } from './piece-store';
import type { Deck, DeckState } from './deck';
import { DECK_VOCABULARY } from './deck';
import { getBrandVoiceForStream } from './brand-voice-store';
import { formatById } from './output-plan';
import { conceptBodyForPiece, DraftError } from './draft';
import { complete } from '@/lib/llm';
import { stripEmDashes } from '@/lib/em-dash';

const SYSTEM = `You are April, Polynize's visual-direction specialist. You are building the touchscreen DECK the presenter performs to camera: a sequence of states on a 32in touchscreen that they advance with their hands while they talk.

The audience must read an INTELLIGENT INTERFACE being operated, not a person clicking through slides. That comes from two things:
1. REVEALS. Every touch causes a specific, motivated reveal. Build each state as a short sequence of data-step reveals rather than one finished picture, so the hand always has a reason to move.
2. A GESTURE LANGUAGE with consistent meaning:
   tap = reveal the next thing. double-tap = lock on, drill in. swipe-left = advance.
   swipe-right = go back. swipe-up = elevate, raise detail. swipe-down = collapse.
   Choose each state's exit gesture so the movement matches the meaning of the cut: swipe-left to move on, swipe-up when the piece is rising to its point, double-tap to commit to a conclusion.

The look is retro-futuristic and heads-up-display: a blueprint substrate, hard-edged type, corner brackets locking onto things, telemetry readouts, decisive motion. The engine already provides all of that. You choose content, sequence and choreography only.

${DECK_VOCABULARY}

Rules:
- Build the deck FROM THE SCRIPT, beat by beat, in order: one state per beat label, and the state carries what that spoken line is talking about. Never invent, skip or reorder beats.
- Where the operator has given direction, that direction WINS. Build what they asked for.
- One idea per state. Type is huge. Never a bullet list, never small text, never a paragraph.
- Any number or phrase on screen is lifted VERBATIM from the concept. Never convert or derive one, and never show a figure the concept does not state.
- Recurring elements keep their colour and material across states so the deck reads as one system: coral is the problem, amber the tension, gold the proof, mint the resolution.
- Never use the em-dash character (U+2014).

Return ONLY a JSON object, no markdown and no code fences:
{"title":"<short deck title>","states":[{"label":"<beat label from the script>","cue":"<four words or fewer, uppercase, the operator's gesture reminder>","exit":"<tap|double-tap|swipe-left|swipe-right|swipe-up|swipe-down>","html":"<the state's html, using only the vocabulary classes>"}]}`;

function isState(x: unknown): x is DeckState {
  if (!x || typeof x !== 'object') return false;
  const s = x as { label?: unknown; html?: unknown };
  return typeof s.label === 'string' && typeof s.html === 'string';
}

function parseLoose(raw: string): unknown {
  const t = raw.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const c = fence ? fence[1] : t;
  const a = c.indexOf('{');
  const b = c.lastIndexOf('}');
  if (a === -1 || b === -1) throw new Error('no JSON object');
  return JSON.parse(c.slice(a, b + 1));
}

/**
 * Build a deck for a piece. `direction` is the operator's creative brief; it wins over
 * the model's own ideas. Throws DraftError when there is no script to build from.
 */
export async function generateDeck(
  owner: string,
  piece: MarketingPiece,
  direction: string
): Promise<Deck> {
  const script = (piece.script ?? '').trim();
  if (!script) throw new DraftError('no-concept');

  const fmt = formatById(piece.format);
  const brandVoice = await getBrandVoiceForStream(piece.stream);
  const conceptBody = await conceptBodyForPiece(owner, piece);

  const parts = [
    conceptBody.trim()
      ? `CONCEPT (the source of every fact and figure):\n"""\n${conceptBody}\n"""`
      : '',
    `LOCKED SCRIPT (one state per beat, in order):\n"""\n${script}\n"""`,
    brandVoice
      ? `BRAND VOICE (the tone the words on screen carry):\n"""\n${brandVoice}\n"""`
      : '',
    piece.treatment?.trim()
      ? `THE AGREED SCREEN PROMPT (the plan for the screen; follow it):\n"""\n${piece.treatment}\n"""`
      : '',
    direction.trim()
      ? `THE OPERATOR'S DIRECTION (their creative intent; follow it):\n"""\n${direction.trim()}\n"""`
      : '',
    `Build the deck for this ${fmt?.label ?? 'video'}.`,
  ].filter(Boolean);

  let raw: string;
  try {
    raw = await complete({
      system: SYSTEM,
      messages: [{ role: 'user', content: parts.join('\n\n') }],
      maxTokens: 16000,
      temperature: 0.7,
      json: false,
      apiKey: process.env.APRIL_OPENROUTER_API_KEY,
    });
  } catch (e) {
    console.error(`[deck] LLM threw: ${e instanceof Error ? e.message : String(e)}`);
    throw new DraftError('llm-unavailable');
  }

  let parsed: unknown;
  try {
    parsed = parseLoose(raw);
  } catch {
    throw new DraftError('empty');
  }
  const obj = parsed as { title?: unknown; states?: unknown };
  const states = Array.isArray(obj.states) ? obj.states.filter(isState) : [];
  if (states.length === 0) throw new DraftError('empty');

  return {
    title: typeof obj.title === 'string' && obj.title ? stripEmDashes(obj.title) : piece.title,
    states: states.map((s) => ({
      label: stripEmDashes(s.label),
      cue: s.cue ? stripEmDashes(s.cue) : undefined,
      exit: s.exit,
      html: stripEmDashes(s.html),
    })),
  };
}
