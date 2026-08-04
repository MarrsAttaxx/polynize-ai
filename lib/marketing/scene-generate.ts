/**
 * SCENE generation (D31): April composes the touchscreen scene's DATA from the concept,
 * the NARRATIVE and the operator's direction. A script is optional and often absent,
 * because the board is built first and the words are written from it.
 *
 * The important difference from the deck generation this replaces: she returns data, not
 * markup. She chooses the concept line, the objects, their colour roles, their facts and
 * the close. She cannot choose layout, size, spacing or behaviour, because the engine
 * owns all of it. A generated scene is therefore on-brand and correctly laid out by
 * construction: the only thing that can be wrong is the words.
 *
 * Server-side only; billed to April's key.
 */

import type { MarketingPiece } from './piece-store';
import type { Scene, SceneColour, SceneFact, SceneNode } from './scene';
import { SCENE_VOCABULARY } from './scene';
import { getBrandVoiceForStream } from './brand-voice-store';
import { conceptBodyForPiece, DraftError } from './draft';
import { complete } from '@/lib/llm';
import { stripEmDashes } from '@/lib/em-dash';

export const MAX_NODES = 4;
export const MAX_FACTS = 4;

const SYSTEM = `You are April, Polynize's visual-direction specialist. You are building the SCENE the presenter operates on a 32in touchscreen while they talk to camera.

${SCENE_VOCABULARY}

How to build it:
- THE NARRATIVE IS THE BRIEF when one is given. It is the governing image the whole board
  is built from (for example "AI is a force multiplier, so mapping the work has to come
  first, or it multiplies the mess"). Every object and every fact should be something that
  image can carry. A board that does not express the narrative is wrong even if every fact
  on it is true.
- The CONCEPT is the spine of the argument, the thing the whole piece is about. It is the headline over the board.
- The NODES are the two to four things the argument is actually made of: the classes, the options, the stages, the parts. They are whatever the narrative and the concept keep coming back to. If there is no such set, find the smallest set of things being compared.
- A node's FACTS are the specific, concrete points the script makes about that node. Prefer numbers and hard values. This is where the proof lives.
- The CLOSE is the line worth remembering, and you break it across lines yourself so the punch lands first.
- A SCRIPT may or may not exist yet. When it does, follow it. When it does not, build from
  the concept and the narrative alone: the board comes FIRST and the words are written from
  it, so the absence of a script is normal rather than missing information.

Hard rules:
- Every number and every phrase on screen is lifted VERBATIM from the concept or the script. Never convert one, never derive one, and never show a figure the source does not state. If the source says "a full day", the screen says A FULL DAY, not "24 hours".
- A fact LABEL is at most three words. A fact VALUE is at most two. They are read at a glance from across a room.
- NEVER write a sentence onto the screen. Whatever explains a node is what the presenter SAYS, and it stays in the script.
- Colour by MEANING and keep it: coral the problem, amber the tension, gold the proof, mint the resolution.
- Order-independent. The presenter opens the nodes in whatever order the moment takes, so no node may read as following another and no fact may read as "and then".
- Never use the em-dash character (U+2014).

Return ONLY a JSON object, no markdown and no code fences:
{"note":"<one short sentence to the operator saying what you built or changed, in plain speech, as a reply in a conversation>","title":"<short title for the scene>","concept":"<the board headline, a few words>","nodes":[{"label":"<two or three words>","colour":"<coral|amber|gold|mint>","facts":[{"label":"<at most three words>","value":"<at most two words>"}]}],"close":"<the closing line, with a newline where it should break>"}`;

function parseLoose(raw: string): unknown {
  const t = raw.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const c = fence ? fence[1] : t;
  const a = c.indexOf('{');
  const b = c.lastIndexOf('}');
  if (a === -1 || b === -1) throw new Error('no JSON object');
  return JSON.parse(c.slice(a, b + 1));
}

const COLOURS: readonly SceneColour[] = ['coral', 'amber', 'gold', 'mint'];

/**
 * Coerce whatever came back into a valid Scene. The caps are enforced HERE and not only
 * in the prompt: a prompt rule is a preference, a slice is a guarantee, which is the
 * lesson from the deck that came back 26 states long.
 */
function coerce(obj: unknown, fallbackTitle: string): Scene & { note: string } {
  const o = (obj ?? {}) as Record<string, unknown>;
  const rawNodes = Array.isArray(o.nodes) ? o.nodes : [];

  const nodes: SceneNode[] = rawNodes
    .slice(0, MAX_NODES)
    .map((n, i): SceneNode | null => {
      const r = (n ?? {}) as Record<string, unknown>;
      const label = typeof r.label === 'string' ? stripEmDashes(r.label).trim() : '';
      if (!label) return null;
      const rawFacts = Array.isArray(r.facts) ? r.facts : [];
      const facts: SceneFact[] = rawFacts
        .slice(0, MAX_FACTS)
        .map((f): SceneFact | null => {
          const g = (f ?? {}) as Record<string, unknown>;
          const fl = typeof g.label === 'string' ? stripEmDashes(g.label).trim() : '';
          const fv = typeof g.value === 'string' ? stripEmDashes(g.value).trim() : '';
          return fl && fv ? { label: fl, value: fv } : null;
        })
        .filter((f): f is SceneFact => f !== null);
      // An unrecognised colour falls back by position rather than to one default, so a
      // set never comes out monochrome (the failure the deck engine had).
      const colour = COLOURS.includes(r.colour as SceneColour)
        ? (r.colour as SceneColour)
        : COLOURS[i % COLOURS.length];
      return { label, colour, facts };
    })
    .filter((n): n is SceneNode => n !== null);

  if (nodes.length === 0) throw new DraftError('empty');

  const concept =
    typeof o.concept === 'string' && o.concept.trim()
      ? stripEmDashes(o.concept).trim()
      : fallbackTitle;

  return {
    note:
      typeof o.note === 'string' && o.note
        ? stripEmDashes(o.note)
        : `Built a scene with ${nodes.length} objects.`,
    title:
      typeof o.title === 'string' && o.title ? stripEmDashes(o.title).trim() : fallbackTitle,
    concept,
    nodes,
    close: typeof o.close === 'string' && o.close.trim() ? stripEmDashes(o.close).trim() : undefined,
  };
}

/**
 * Build a scene for a piece. `narrative` is the governing image and is the strongest
 * input after the concept's facts. `direction` is the operator's creative brief and wins
 * over the model's own ideas. `current` is the scene as it stands, so a follow-up refines
 * rather than restarts. Throws DraftError only when there is no concept, narrative OR
 * script, i.e. nothing for the board to be about.
 */
export async function generateScene(
  owner: string,
  piece: MarketingPiece,
  direction: string,
  current?: Scene | null,
  narrative?: string
): Promise<Scene & { note: string }> {
  const script = (piece.script ?? '').trim();
  const brandVoice = await getBrandVoiceForStream(piece.stream);
  const conceptBody = await conceptBodyForPiece(owner, piece);

  // The prezie no longer waits for a script. Marrs's finding is that the board is what
  // pulls the words out of him, so it comes FIRST and the script is written from it. What
  // it genuinely cannot be built from is nothing at all: it needs a concept, a narrative
  // or a script to have something to be about.
  if (!script && !conceptBody.trim() && !(narrative ?? '').trim()) {
    throw new DraftError('no-concept');
  }

  const parts = [
    (narrative ?? '').trim()
      ? `THE NARRATIVE (the governing image; the board must express it):\n"""\n${narrative!.trim()}\n"""`
      : '',
    conceptBody.trim()
      ? `CONCEPT (the source of every fact and figure):\n"""\n${conceptBody}\n"""`
      : '',
    script
      ? `THE SCRIPT (what the presenter says; keep the board consistent with it):\n"""\n${script}\n"""`
      : 'There is NO SCRIPT yet. Build the board from the concept and the narrative; the words get written from it afterwards.',
    brandVoice ? `BRAND VOICE (the tone the words on screen carry):\n"""\n${brandVoice}\n"""` : '',
    current
      ? `THE SCENE AS IT STANDS (refine this, do not start over):\n"""\n${JSON.stringify(current)}\n"""`
      : '',
    direction.trim()
      ? `THE OPERATOR'S DIRECTION (their creative intent; follow it):\n"""\n${direction.trim()}\n"""`
      : '',
    'Build the scene.',
  ].filter(Boolean);

  let raw: string;
  try {
    raw = await complete({
      system: SYSTEM,
      messages: [{ role: 'user', content: parts.join('\n\n') }],
      maxTokens: 8000,
      temperature: 0.6,
      json: false,
      apiKey: process.env.APRIL_OPENROUTER_API_KEY,
    });
  } catch (e) {
    console.error(`[scene] LLM threw: ${e instanceof Error ? e.message : String(e)}`);
    throw new DraftError('llm-unavailable');
  }

  let parsed: unknown;
  try {
    parsed = parseLoose(raw);
  } catch {
    throw new DraftError('empty');
  }
  return coerce(parsed, piece.title);
}
