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
import { parseFigureReply } from './figure-parse';
import { DraftError } from './draft';
import { complete } from '@/lib/llm';
import { resolveModel } from '@/lib/llm/openrouter';
import { stripEmDashes } from '@/lib/em-dash';


/**
 * WHAT SHE CAN AND CANNOT DRAW, stated plainly.
 *
 * Marrs tried to get a seesaw whose falling counterweight flings a ball, and could not: "she's
 * just not good at physics". She was not refusing, she was attempting something CSS cannot do
 * and then shipping a poor version of it. Nothing in her instructions said where the ceiling
 * was, so she over-promised, and the operator paid for it in wasted turns.
 *
 * Naming the ceiling is the fix. It makes her proposals land inside her ability, and it lets
 * her say "that will look wrong, here is what reads better" instead of quietly failing.
 */
export const FIGURE_CAPABILITIES = `WHAT YOU CAN DRAW WELL, because it is what CSS is good at:
- Shapes: rectangles, circles, ellipses, triangles, arrows, rings, bars, grids, columns, dotted and dashed lines, gradients, glows, blurs.
- Transforms: move, scale, rotate, skew. A beam tilting on a pivot, a panel sliding, a shape growing, a column filling.
- Staged reveals: things arriving, disappearing, changing colour, changing size, being crossed out or ringed.
- Simple continuous loops: a pulse, a slow drift, a spin, a flowing gradient.
- Type as a graphic element: one huge word, a huge number, a huge glyph.

WHAT YOU CANNOT DO WELL, and must never promise:
- DRAGGING. You cannot write JavaScript, so nothing can follow a finger or a pointer. There is
  no continuous drag, no free-moving handle, no "slide it to any position". THE ANSWER IS THE
  SNAP CONTROL BELOW, which is better on camera anyway. This is the single most useful thing on
  this page: it is missing from a list like this that cost the operator an hour of asking for a
  slider that could never exist.
- PHYSICS. Nothing falls, bounces, collides or transfers momentum convincingly. A ball "flung" by a lever will look wrong, because all you can do is tween it along a straight line or one fixed curve, and the eye reads that as a sticker sliding rather than an object being thrown.
- Arbitrary motion paths, particle systems, fluid, smoke, cloth, springs, or anything that should look simulated.
- 3D perspective, photorealism, illustration, drawings of people, places or products.
- Precise diagrams of real machinery.

THE SNAP CONTROL: a real, touchable control with NO JavaScript. This is how you build a slider,
a toggle, a set of tabs, a stepper, anything the presenter operates directly. Hidden radio inputs
carry the state and the labels are the touch targets, so the :checked selector lets every other element on
the figure react:

  <input type="radio" name="x" id="x1" checked><input type="radio" name="x" id="x2">
  <div class="track"><span class="thumb"></span><label for="x1">Broken</label><label for="x2">Mapped</label></div>
  ...
  #x2:checked ~ .track .thumb{transform:translateX(100%)}
  #x2:checked ~ .out .bar{height:96%;background:...}

Three things make it work as a performance control. The THUMB is one element that moves between
positions, so it reads as a control being operated rather than states cutting between each other.
The labels must be finger-sized on a 32in screen, so give the track real height. And it snaps
rather than sliding continuously, which is BETTER on camera: a clear state change reads at a
glance where a continuous drag reads as mush. Set "interactive": true whenever you use it.

WHEN WHAT IS ASKED FOR IS IN THAT SECOND LIST, say so in ONE plain sentence and immediately offer the strongest thing that DOES read. For a lever, do not animate a flying ball: tilt the beam, drop the heavy end, and let the output ARRIVE on the far side at scale. That reads as consequence, which is the actual point, and it looks deliberate rather than broken. Being straight about this is more useful than trying and missing.`;

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

${FIGURE_CAPABILITIES}

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

WHEN THE OPERATOR SAYS THE TOUCHES SHOULD BELONG TO THE FIGURE, THAT IS YOURS AND YOU FIX IT.
Set "interactive": true. That tells the engine to give the whole screen to your figure, so a
touch works the figure instead of moving the board on, and only the faint corner mark advances.
Any of these means set it: a slider or anything to drag, several separate things to hit, icons
that should respond, "my touches should be local to this board", "tapping it moves to the next
page and it should not". Do NOT send him away to fix this. It is one field and it is yours.

WHAT GENUINELY IS NOT YOURS: the touch sounds, the operator cue strip along the bottom, WHERE
the corner mark sits, the background, and the order of the figures. If he raises one of those,
say so in one sentence and say what you understand the ask to be, so he can take it to the
console. Then say what if anything you would change about the FIGURE. Do not answer a question
about the engine with a list of drawings.

DRAW ONLY WHAT WAS ASKED. This is the rule that matters most, and it is easy to break by
being helpful. One figure is ONE PICTURE. If the ask describes a single static image, that is
the whole figure and "taps" is 0: do not add a reveal, do not add a second state, do not add
labels, headings or captions that were not asked for.

Above all, DO NOT TRY TO CARRY THE WHOLE ARGUMENT IN ONE FIGURE. The concept and the angle are
given to you as reference for the words and figures you may use, NOT as a brief to illustrate.
The operator is building a sequence one picture at a time and will ask for the next one himself.
If he says "a large pulsating question mark", the correct answer is a large pulsating question
mark and nothing else on the screen.

WHEN REVISING, change what was asked and leave everything else exactly as it is. The operator
is building this up over several turns and expects what he already approved to stay put.

Return EXACTLY this, and nothing else. No JSON, no markdown, no code fences:

NAME: <two or three words naming THIS PICTURE, like "question mark" or "the lever", not the topic of the piece>
TAPS: <how many taps it takes to complete, 0 if none>
INTERACTIVE: <yes only if the figure has its own control or several hit targets, otherwise no>
NOTE: <one short sentence to the operator, as a reply in a conversation>
---CSS---
<the CSS, on as many lines as you like>
---HTML---
<the markup fragment, one root element, on as many lines as you like>

The two blocks are read literally between their markers, so write normal multi-line CSS and HTML
with real line breaks and quotes. NOTHING NEEDS ESCAPING and nothing should be on one line.`;


/**
 * The model the FIGURE work runs on.
 *
 * Figures are CSS and markup, which is a coding task, and the drafting model is chosen for
 * speed and prose. Marrs's read after a week of using it: "it's not a coding model." Set
 * FIGURE_MODEL to move this work alone; unset, it falls back to whatever the rest of PAM uses,
 * so nothing changes by accident.
 *
 * As of 2026-08-06 `deepseek/deepseek-v4-pro` is both stronger at this and cheaper than the
 * drafting model on OpenRouter (0.43 vs 1.50 per million in, 0.87 vs 9.00 out, same 1M
 * context), so the economics point the same way as the quality.
 */
const figureModel = () => process.env.FIGURE_MODEL || undefined;

/**
 * WHICH MODEL THE FIGURE WORK IS ACTUALLY ON, resolved by the same function the call uses so
 * the two can never disagree. Surfaced in the console because "did my env var take effect" is
 * otherwise only answerable by digging through function logs mid-flow.
 */
export const figureModelInUse = () => resolveModel(figureModel());





const DISCUSS_SYSTEM = `You are April, Polynize's visual-direction specialist, talking to the presenter about ONE figure for a touchscreen he performs to camera.

You are NOT drawing yet. He describes the CONCEPT he wants to get across and you propose what to draw. This exists because guessing and drawing costs him a whole turn, while proposing costs a sentence.

${FIGURE_CAPABILITIES}

IF HE ASKS FOR A SLIDER, A TOGGLE, TABS OR A STEPPER: you can build it, as a SNAP control with
hidden radio inputs and the :checked selector, where every other element on the figure reacts to the chosen
position. Say that plainly, and say that it snaps between positions rather than dragging
continuously, because you cannot write JavaScript and nothing can follow a finger. Snapping is
better on camera anyway: a clear state change reads at a glance where a drag reads as mush. Never
promise a continuous drag.

IF HE SAYS THE TOUCHES SHOULD BELONG TO THE FIGURE, THAT IS SOMETHING YOU CAN FIX, so say so:
"I will make the figure own the screen, so your touches work it and only the corner mark moves
on." A slider, several things to hit, icons that should respond, "tapping it goes to the next
page and it should not" all mean the same thing and you handle all of them. Never tell him to
ask someone else about it.

WHAT GENUINELY IS NOT YOURS: the touch sounds, the operator cue strip, where the corner mark
sits, and the order of the figures. Say so in one sentence if he raises one, and reflect the ask
back so he can take it to the console.

HOW TO REPLY
- Offer TWO OR THREE concrete options. START EACH ONE ON ITS OWN LINE WITH ITS NUMBER AND A FULL STOP, like "1." then "2.", because the console reads those numbers and offers him a button to build that exact option. Two or three sentences each: what is on screen, what each tap does, and what the picture MEANS. No preamble.
- Every option must be something you can actually build from the list above. If his idea needs physics or illustration, say so in one sentence and propose what reads instead. Do not pretend.
- Recommend one, in a short line, and say why it lands hardest on camera. He can build your
  recommendation with one button, so make the recommendation unambiguous.
- If he has already decided, do not offer alternatives: confirm what you will draw in one or two sentences and stop.
- Talk like a colleague at a whiteboard. Plain speech, no lists of adjectives, no restating his brief back to him.
- Never use the em-dash character (U+2014).

Reply as plain text. No JSON, no code, no markup.`;

/** One turn of the conversation, kept so a proposal can build on the last one. */
export type FigureTurn = { role: 'operator' | 'april'; text: string };

/**
 * Talk about a figure without drawing it.
 *
 * The point is to settle WHAT to draw before spending a draw on it, and to let her say what
 * she cannot do before he asks for it three times.
 */
export async function discussFigure(
  ask: string,
  ctx: FigureContext,
  history: FigureTurn[] = [],
  current?: PrezieFigure | null
): Promise<string> {
  const want = ask.trim();
  if (!want) throw new DraftError('empty');

  const context = [
    ctx.angle?.trim() ? `THE PIECE'S ANGLE:\n"""\n${ctx.angle.trim()}\n"""` : '',
    ctx.concept?.trim() ? `THE CONCEPT (where any real number or name must come from):\n"""\n${ctx.concept.trim()}\n"""` : '',
    current
      ? `THE FIGURE ON SCREEN NOW, which he may be asking to change:\n"""\n${current.brief}\n"""`
      : '',
  ].filter(Boolean);

  const messages: { role: 'user' | 'assistant'; content: string }[] = [];
  if (context.length) messages.push({ role: 'user', content: context.join('\n\n') });
  for (const t of history.slice(-10)) {
    messages.push({ role: t.role === 'operator' ? 'user' : 'assistant', content: t.text });
  }
  messages.push({ role: 'user', content: want });

  let raw: string;
  try {
    raw = await complete({
      system: DISCUSS_SYSTEM,
      messages,
      maxTokens: 3000,
      temperature: 0.7,
      json: false,
      // The discussion is about what to draw, so it wants the same head that will draw it: it
      // has to know what is buildable, and that is the coding model's knowledge.
      model: figureModel(),
      apiKey: process.env.APRIL_OPENROUTER_API_KEY,
    });
  } catch (e) {
    console.error(`[figure.discuss] LLM threw: ${e instanceof Error ? e.message : String(e)}`);
    throw new DraftError('llm-unavailable');
  }
  const reply = stripEmDashes(raw.trim());
  if (!reply) throw new DraftError('empty');
  return reply;
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
      model: figureModel(),
      apiKey: process.env.APRIL_OPENROUTER_API_KEY,
    });
  } catch (e) {
    console.error(`[figure] LLM threw: ${e instanceof Error ? e.message : String(e)}`);
    throw new DraftError('llm-unavailable');
  }

  const o = parseFigureReply(raw);
  const html = o.html ?? '';
  const css = o.css ?? '';
  if (!html.trim()) {
    // Log enough to diagnose the NEXT failure without guessing: the shape she actually sent.
    console.error(
      `[figure] no markup in the reply. length=${raw.length} ` +
        `hasCssMarker=${/-{2,}\s*CSS\s*-{2,}/i.test(raw)} ` +
        `hasHtmlMarker=${/-{2,}\s*HTML\s*-{2,}/i.test(raw)} ` +
        `startsWith=${JSON.stringify(raw.slice(0, 120))}`
    );
    throw new DraftError('empty');
  }

  // The brief ACCUMULATES. Without this, turn three has no idea what turn one asked for and
  // quietly undoes it, which is exactly what makes an iterative loop feel broken.
  const brief = current ? `${current.brief}\n\nThen: ${want}` : want;

  const figure = sanitiseFigure({
    figure_id: current?.figure_id ?? randomUUID(),
    name: stripEmDashes(o.name || current?.name || 'Figure'),
    brief: stripEmDashes(brief),
    css,
    html: stripEmDashes(html),
    taps: o.taps ?? 0,
    interactive: o.interactive === true ? true : current?.interactive,
  });

  return {
    figure,
    note: o.note ? stripEmDashes(o.note) : current ? 'Updated it.' : 'Drew it.',
  };
}
