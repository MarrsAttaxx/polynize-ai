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
import { parseSlides } from './slides';
import { complete } from '@/lib/llm';
import { stripEmDashes } from '@/lib/em-dash';

const SYSTEM = `You are April, Polynize's visual-direction specialist. You are building the touchscreen DECK the presenter performs to camera: a sequence of states on a 32in touchscreen that they advance with their hands while they talk.

The audience must read an INTELLIGENT INTERFACE being operated, not a person clicking through slides. That comes from two things:
1. FEWER, STRONGER SLIDES. A deck is FOUR to SIX states. SIX IS A HARD MAXIMUM, never more, whatever the length of the script. A deck is NOT one state per beat: it is the handful of moments worth showing. Read the whole script, find the four to six turning points the argument actually pivots on, and give those a state. Everything else is spoken over whatever is already on screen. A state holds while the presenter talks; it does not need to change for every sentence.
2. A GESTURE LANGUAGE with consistent meaning, where each gesture triggers its own figure animation between beats:
   tap = a plain cut, the quiet advance. double-tap = lock on, a reticle snaps shut, for committing to a conclusion.
   swipe-left = advance, a Lissajous curve sweeps the frame. swipe-right = go back.
   swipe-up / swipe-down = the plate resonates and a cymatic (Chladni) pattern reorganises, for a change of state or a structural shift.
   pinch = concentric rings pull in, for zooming into a detail.
   Choose each state's exit gesture for MEANING, and vary it: swipe-up or swipe-down when the argument changes structure, pinch when narrowing to a detail, double-tap to land a conclusion, tap when the moment should pass quietly. Do not use swipe-left for everything.

The look is retro-futuristic and heads-up-display: a blueprint substrate, hard-edged type, corner brackets locking onto things, telemetry readouts, decisive motion. The engine already provides all of that. You choose content, sequence and choreography only.

${DECK_VOCABULARY}

Rules:
- Build the deck FROM THE SCRIPT and keep its order, but SELECT: four to six states total, each carrying one pivotal moment of the argument. Skipping beats is correct and expected. Label each state with the beat label it belongs to so the deck and the script stay in lockstep.
- DEFAULT SHAPE, unless the direction says otherwise. Open on the CONCEPT and its three pillars as a purely visual state, no headline text. Then one state per pillar: that pillar moves to centre and is named, with the others dimmed. Close on the single line worth remembering. That is five states and it is usually the right answer.
- Persistent readouts (a risk level, a score, a count) go in a corner element so they read as instrument telemetry rather than content: <div class="corner tl">RISK: HIGH</div>. Use "tl" top-left, "tr" top-right.
- Where the operator has given direction, that direction WINS. Build what they asked for.
- One idea per state. Type is huge. Never a bullet list, never small text, never a paragraph.
- Any number or phrase on screen is lifted VERBATIM from the concept. Never convert or derive one, and never show a figure the concept does not state.
- Recurring elements keep their colour and material across states so the deck reads as one system: coral is the problem, amber the tension, gold the proof, mint the resolution.
- Never use the em-dash character (U+2014).

Return ONLY a JSON object, no markdown and no code fences:
{"note":"<one short sentence to the operator saying what you built or changed, in plain speech, as a reply in a conversation>","title":"<short deck title>","states":[{"label":"<beat label from the script>","cue":"<four words or fewer, uppercase, the operator's gesture reminder>","exit":"<tap|double-tap|swipe-left|swipe-right|swipe-up|swipe-down>","html":"<the state's html, using only the vocabulary classes>"}]}`;

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
export const MAX_STATES = 6;

export async function generateDeck(
  owner: string,
  piece: MarketingPiece,
  direction: string
): Promise<Deck & { note: string }> {
  const script = (piece.script ?? '').trim();
  if (!script) throw new DraftError('no-concept');

  const fmt = formatById(piece.format);
  const brandVoice = await getBrandVoiceForStream(piece.stream);
  const conceptBody = await conceptBodyForPiece(owner, piece);

  // The operator's SLIDE CARDS are the authority when they exist: they are what was
  // reviewed and approved on the Screen Prompt stage, so the deck realises them rather
  // than re-deciding the plan. Older pieces fall back to the prose brief.
  const slides = parseSlides(piece.slides);
  const slideLines = slides
    .map(
      (sl, i) =>
        `SLIDE ${i + 1}\n  ON SCREEN: ${sl.visual}\n  WORDS: ${sl.text || '(none, purely visual)'}`
    )
    .join('\n');
  const slidePlan = slides.length
    ? `THE APPROVED SLIDES (build EXACTLY these, one state each, in order; do not add, drop or reorder any):\n"""\n${slideLines}\n"""`
    : piece.treatment?.trim()
      ? `THE AGREED SCREEN PROMPT (the plan for the screen; follow it):\n"""\n${piece.treatment}\n"""`
      : '';

  const parts = [
    conceptBody.trim()
      ? `CONCEPT (the source of every fact and figure):\n"""\n${conceptBody}\n"""`
      : '',
    `LOCKED SCRIPT (select four to six pivotal moments from this, in order):\n"""\n${script}\n"""`,
    brandVoice
      ? `BRAND VOICE (the tone the words on screen carry):\n"""\n${brandVoice}\n"""`
      : '',
    slidePlan,
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
  const obj = parsed as { note?: unknown; title?: unknown; states?: unknown };
  const states = Array.isArray(obj.states) ? obj.states.filter(isState) : [];
  if (states.length === 0) throw new DraftError('empty');

  // Enforce the cap in code too: a prompt rule alone let a long script produce 26
  // states, which is the failure this exists to prevent.
  const capped = states.slice(0, MAX_STATES);
  return {
    note:
      typeof obj.note === 'string' && obj.note
        ? stripEmDashes(obj.note)
        : `Built ${capped.length} states from the script.`,
    title: typeof obj.title === 'string' && obj.title ? stripEmDashes(obj.title) : piece.title,
    states: capped.map((s) => ({
      label: stripEmDashes(s.label),
      cue: s.cue ? stripEmDashes(s.cue) : undefined,
      exit: s.exit,
      html: stripEmDashes(s.html),
    })),
  };
}
