/**
 * Revise ONE state of a built deck (D30).
 *
 * Building the deck is all-or-nothing: April re-decides every state, so a small fix to
 * slide 2 ("stop showing the other pillars' names") also re-rolls the four states that
 * were already right. That made minor edits feel impossible, which is exactly what
 * Marrs hit on the first real deck.
 *
 * So a revision is SURGICAL. April is given one state's html and one instruction, and
 * returns that state alone. Every other state is written back byte for byte, so the
 * deck only changes where the operator asked it to.
 *
 * Server-side only; billed to April's key.
 */

import type { Deck, DeckState } from './deck';
import { DECK_VOCABULARY } from './deck';
import { DraftError } from './draft';
import { complete } from '@/lib/llm';
import { stripEmDashes } from '@/lib/em-dash';

const SYSTEM = `You are April, Polynize's visual-direction specialist. You are making ONE SMALL CHANGE to ONE state of a touchscreen deck that is already built and approved.

This is a REVISION, not a redesign. The operator likes this state; something specific about it is wrong. Change that and nothing else. Keep the same composition, the same elements, the same colours and the same wording unless the instruction asks you to change them. If the instruction is about one element, the rest of the state comes back identical.

${DECK_VOCABULARY}

Rules:
- Do exactly what was asked, and no more. Resist improving anything you were not asked about.
- Any number or phrase on screen is lifted VERBATIM from the deck as it stands, or from the instruction. Never invent, convert or derive a figure.
- The state must stay inside the screen: one idea, huge type, no bullet list, no paragraph.
- Never use the em-dash character (U+2014).

Return ONLY a JSON object, no markdown and no code fences:
{"note":"<one short sentence to the operator saying what you changed, in plain speech, as a reply in a conversation>","cue":"<four words or fewer, uppercase, the operator's gesture reminder; keep the existing one unless the change makes it wrong>","html":"<the revised state's html, using only the vocabulary classes>"}`;

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
 * Revise `deck.states[index]` per `instruction`. Returns the whole deck with only that
 * state replaced, plus April's note. Throws DraftError on an unusable response.
 */
export async function reviseDeckState(
  deck: Deck,
  index: number,
  instruction: string
): Promise<{ deck: Deck; note: string }> {
  const state = deck.states[index];
  if (!state) throw new DraftError('empty');

  // The neighbours are context only: a state has to keep reading as part of a sequence
  // (the same pillars in the same order), so April sees them but is not asked for them.
  const neighbours = deck.states
    .map((st, i) =>
      i === index ? null : `STATE ${i + 1} (${st.label}): ${st.html}`
    )
    .filter(Boolean)
    .join('\n\n');

  const parts = [
    `THE DECK: "${deck.title}", ${deck.states.length} states.`,
    `THE STATE TO CHANGE is state ${index + 1} of ${deck.states.length}, labelled "${state.label}".\nIts html as it stands:\n"""\n${state.html}\n"""\nIts current operator cue: ${state.cue || '(none)'}`,
    neighbours
      ? `THE OTHER STATES, for consistency only. Do NOT return these, and do not restyle this state to be unlike them:\n"""\n${neighbours}\n"""`
      : '',
    `THE CHANGE THE OPERATOR WANTS:\n"""\n${instruction.trim()}\n"""`,
    'Return the revised state.',
  ].filter(Boolean);

  let raw: string;
  try {
    raw = await complete({
      system: SYSTEM,
      messages: [{ role: 'user', content: parts.join('\n\n') }],
      maxTokens: 8000,
      temperature: 0.4,
      json: false,
      apiKey: process.env.APRIL_OPENROUTER_API_KEY,
    });
  } catch (e) {
    console.error(`[deck.revise] LLM threw: ${e instanceof Error ? e.message : String(e)}`);
    throw new DraftError('llm-unavailable');
  }

  let parsed: unknown;
  try {
    parsed = parseLoose(raw);
  } catch {
    throw new DraftError('empty');
  }
  const obj = parsed as { note?: unknown; cue?: unknown; html?: unknown };
  if (typeof obj.html !== 'string' || !obj.html.trim()) throw new DraftError('empty');

  const revised: DeckState = {
    label: state.label,
    exit: state.exit,
    cue: typeof obj.cue === 'string' && obj.cue.trim() ? stripEmDashes(obj.cue) : state.cue,
    html: stripEmDashes(obj.html),
  };

  return {
    // Every other state is carried across untouched. That is the point of this path.
    deck: { ...deck, states: deck.states.map((st, i) => (i === index ? revised : st)) },
    note:
      typeof obj.note === 'string' && obj.note
        ? stripEmDashes(obj.note)
        : `Updated state ${index + 1}.`,
  };
}
