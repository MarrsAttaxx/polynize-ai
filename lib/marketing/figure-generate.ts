/**
 * FIGURE generation and iteration (D33). April draws one picture, then changes it on request.
 *
 * This is the loop Marrs asked for: "we start from one point and we keep on building. When I
 * say okay this is good, now when I tap this, this happens, and she builds that." So the unit
 * of work is ONE figure and the primary operation is a REVISION, not a fresh build. A brief
 * accumulates across turns, which is what stops the third request from undoing the first.
 *
 * She writes markup and CSS, which the deck model proved dangerous. What makes it safe here:
 * the engine owns the frame and the tokens, `lib/marketing/figure.ts` sanitises and scopes
 * whatever comes back, and the operator sees every turn in a live preview before it matters.
 *
 * Server-side only; billed to April's key.
 */

import { randomUUID } from 'node:crypto';
import { sanitiseFigure, FIGURE_STEP_CONTRACT, type PrezieFigure } from './figure';
import { DraftError } from './draft';
import { complete } from '@/lib/llm';
import { stripEmDashes } from '@/lib/em-dash';

const SYSTEM = `You are April, Polynize's visual-direction specialist. You draw ONE FIGURE for a touchscreen the presenter operates on camera, as a fragment of HTML plus its own CSS.

A figure is a PICTURE THAT MAKES AN ARGUMENT, not a slide. It is a diagram, a mechanism, a shape that means something: a lever that flings a small weight because a big one dropped, a funnel, a building that absorbs something, a matrix filling in. It is filmed on a 32in screen and read from across a room.

THE MATERIALS. Use ONLY these, because they are the brand and nothing else is:
  --ink #0a0a0f (the background, already set)   --cream #f4ece4 (structure, neutral marks)
  --coral #ff7a6b the problem      --amber #f0b86b the tension
  --gold  #f0e1b6 the proof        --mint  #69fccb the resolution
  --mono for small technical labels; everything else is the page font (Space Grotesk 700).
Colour carries MEANING here: the thing going wrong is coral, the thing that fixes it is mint.

SIZE EVERYTHING IN vh AND vw, never px. The figure fills a frame of unknown pixel size and
must be legible on half a phone screen. Nothing smaller than 3vh of text, ever. Nothing may
be positioned outside the frame; keep every element within 0 to 100 percent of it.

${FIGURE_STEP_CONTRACT}

HARD RULES
- No <script>, no event attributes, no external images, fonts or urls. A figure loads nothing.
- No position:fixed. Position within the figure only.
- Do not style html, body or :root, and do not use ids: give every class a short prefix of
  your own so two figures on one screen cannot collide.
- Animate with CSS only (transition, animation, transform). Movement should be decisive: no
  slow crossfades, no gentle dissolves.
- Text on a figure is a LABEL, not a sentence: a word or three. The presenter says the rest.
- Never use the em-dash character (U+2014).

WHEN REVISING, change what was asked and leave everything else exactly as it is. The operator
is building this up over several turns and expects what he already approved to stay put.

Return ONLY a JSON object, no markdown and no code fences:
{"note":"<one short sentence to the operator, as a reply in a conversation>","name":"<two or three words naming this figure>","taps":<how many taps it takes to complete, 0 if none>,"css":"<the CSS>","html":"<the markup fragment, one root element>"}`;

function parseLoose(raw: string): unknown {
  const t = raw.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const c = fence ? fence[1] : t;
  const a = c.indexOf('{');
  const b = c.lastIndexOf('}');
  if (a === -1 || b === -1) throw new Error('no JSON object');
  return JSON.parse(c.slice(a, b + 1));
}

export type FigureContext = {
  /** The concept's body, so a figure can carry a real figure rather than a placeholder. */
  concept?: string;
  /** The piece's angle: which argument this whole piece is making. */
  angle?: string;
};

/**
 * Draw a figure, or revise one.
 *
 * `ask` is what the operator just said. `current` is the figure as it stands, and when it is
 * present this is a revision: the brief accumulates so earlier decisions survive later ones.
 */
export async function generateFigure(
  ask: string,
  ctx: FigureContext,
  current?: PrezieFigure | null
): Promise<{ figure: PrezieFigure; note: string }> {
  const want = ask.trim();
  if (!want) throw new DraftError('empty');

  const parts = [
    ctx.angle?.trim()
      ? `THE PIECE'S ANGLE (what the whole piece argues):\n"""\n${ctx.angle.trim()}\n"""`
      : '',
    ctx.concept?.trim()
      ? `THE CONCEPT (the source of any real figure or name you put on screen):\n"""\n${ctx.concept.trim()}\n"""`
      : '',
    current
      ? `THE FIGURE AS IT STANDS. Change only what is asked below.\n\nWhat it was asked to be so far:\n"""\n${current.brief}\n"""\n\nIts CSS:\n"""\n${current.css}\n"""\n\nIts HTML:\n"""\n${current.html}\n"""`
      : '',
    `${current ? 'THE CHANGE THE OPERATOR WANTS' : 'WHAT THE OPERATOR WANTS DRAWN'}:\n"""\n${want}\n"""`,
  ].filter(Boolean);

  let raw: string;
  try {
    raw = await complete({
      system: SYSTEM,
      messages: [{ role: 'user', content: parts.join('\n\n') }],
      // Markup plus CSS plus a thinking model's reasoning overhead: generous, or the figure
      // arrives truncated and unusable, which is the one failure that wastes a whole turn.
      maxTokens: 12000,
      temperature: 0.6,
      json: false,
      apiKey: process.env.APRIL_OPENROUTER_API_KEY,
    });
  } catch (e) {
    console.error(`[figure] LLM threw: ${e instanceof Error ? e.message : String(e)}`);
    throw new DraftError('llm-unavailable');
  }

  let parsed: unknown;
  try {
    parsed = parseLoose(raw);
  } catch {
    throw new DraftError('empty');
  }
  const o = parsed as Record<string, unknown>;
  const html = typeof o.html === 'string' ? o.html : '';
  const css = typeof o.css === 'string' ? o.css : '';
  if (!html.trim()) throw new DraftError('empty');

  // The brief ACCUMULATES. Without this, turn three has no idea what turn one asked for and
  // quietly undoes it, which is exactly what makes an iterative loop feel broken.
  const brief = current ? `${current.brief}\n\nThen: ${want}` : want;

  const figure = sanitiseFigure({
    figure_id: current?.figure_id ?? randomUUID(),
    name: stripEmDashes(typeof o.name === 'string' && o.name ? o.name : current?.name || 'Figure'),
    brief: stripEmDashes(brief),
    css,
    html: stripEmDashes(html),
    taps: typeof o.taps === 'number' ? o.taps : Number(o.taps ?? 0),
  });

  return {
    figure,
    note:
      typeof o.note === 'string' && o.note
        ? stripEmDashes(o.note)
        : current
          ? 'Updated it.'
          : 'Drew it.',
  };
}
