/**
 * ONE-SHOT PREZIE: the whole board from the script, in a single call.
 *
 * Marrs spent a week getting one board out of the figure-by-figure loop, then had Claude produce a
 * complete five-figure prezie from the script in one pass. His verdict: "not too bad, but obviously
 * still needs some additions." So the loop is not the problem with the loop; the problem is that it
 * starts from nothing. This gives April the same one-shot, so the conversation starts from a whole
 * board that already exists rather than an empty list.
 *
 * WHAT THIS IS NOT. It does not replace the per-figure loop, it feeds it. The one-shot produces the
 * spine and the iteration loop fixes what missed, which is the right division: the expensive thing was
 * never the revision, it was getting to a first draft worth revising.
 *
 * TWO THINGS THE STANDALONE FILE CANNOT HAVE, and this does:
 *   - the TOUCH SOUNDS, which are Marrs's own samples and belong to the engine rather than the figure.
 *     The Claude one-shot is missing them and always will be.
 *   - the operator cue strip, the near-invisible corner mark, the substrate and the swipe-back, all of
 *     which the engine already owns and which every figure therefore gets for free.
 * So April is told NOT to build any of that, where the standalone prompt has to ask for all of it.
 *
 * Server-side only; billed to April's key.
 */

import { randomUUID } from 'node:crypto';
import { FIGURE_CAPABILITIES } from './figure-generate';
import { FIGURE_STEP_CONTRACT, sanitiseFigure, type PrezieFigure } from './figure';
import { parseFigureBlocks } from './figure-parse';
import { DraftError } from './draft';
import { complete, completeStream, type StreamDelta } from '@/lib/llm';
import { resolveModel } from '@/lib/llm/openrouter';
import { stripEmDashes } from '@/lib/em-dash';

/** Same override as the per-figure work: this is the same job at a larger size. */
const oneshotModel = () => process.env.FIGURE_MODEL || undefined;
export const oneshotModelInUse = () => resolveModel(oneshotModel());

/** How many figures a one-shot may return. Beyond this it is a deck, not a prezie. */
export const MAX_ONESHOT_FIGURES = 8;

const SYSTEM = `You are April, Polynize's visual-direction specialist. You are building a WHOLE PREZIE in one pass: the complete sequence of pictures a presenter operates on a 32 inch touchscreen while being filmed.

You are given a script. Build one figure per BEAT, plus the CTA. SKIP THE HOOK: that is the presenter talking to camera before the screen is used.

${FIGURE_CAPABILITIES}

${FIGURE_STEP_CONTRACT}

WHAT THE ENGINE ALREADY OWNS, SO DO NOT BUILD ANY OF IT. This is the difference between what you are
doing and building a standalone page, and getting it wrong is the most likely way to waste this pass:
- The dark substrate and its grid. Your figure sits ON it, with a transparent background.
- The TOUCH SOUNDS. Real samples, played by the engine on every tap. Do not add audio.
- The operator cue strip along the bottom, the near-invisible corner mark, the tap counting, the
  swipe-back and the keyboard control. All handled.
- Moving between figures. You never build a "next" control and you never build the transition between
  one figure and the next. You build the pictures.

THE SEQUENCE IS THE PIECE. This is what makes a prezie rather than a set of slides:
- Each figure is ONE picture making ONE argument, and it must be the argument its beat is making.
- WHERE TWO CONSECUTIVE BEATS ARE ABOUT THE SAME OBJECT, DRAW IT IN THE SAME PLACE AT THE SAME SIZE in
  both figures, so it reads as continuing rather than being replaced. If beat 2 builds a matrix and beat
  3 talks about one of its columns, beat 3 opens on that same matrix, same coordinates, and lights the
  column. That continuity is worth more than any individual figure being clever.
- The last figure should leave on screen the thing the close wants to be unforgettable.

DRAW ONLY WHAT THE BEAT NEEDS. No headings that were not asked for, no captions, no legends, no
explanatory text. Text on a figure is a LABEL of a word or three; the presenter says everything else. If
a beat is one static image, that is the whole figure and it takes zero taps. Empty space is not a problem
to solve.

Return EACH FIGURE in this exact format, separated by a line containing only ===FIGURE===. No JSON, no
markdown, no code fences, and nothing before the first figure or after the last:

===FIGURE===
NAME: <two or three words naming THIS PICTURE, like "the multiplier" or "three columns">
BEAT: <which beat of the script this is, e.g. BEAT 1 or CTA>
TAPS: <how many taps it takes to complete, 0 if none>
INTERACTIVE: <yes only if the figure has its own control or several hit targets, otherwise no>
NOTE: <one short sentence to the operator: what the picture is and what it MEANS>
---CSS---
<the CSS, on as many lines as you like>
---HTML---
<the markup, one root element, on as many lines as you like>

The two blocks are read literally between their markers, so write normal multi-line CSS and HTML with
real line breaks and quotes. NOTHING NEEDS ESCAPING. Never use the em-dash character.`;

export type OneShotFigure = PrezieFigure & { beat?: string; note?: string };

/**
 * Split a multi-figure reply and reuse the single-figure parser on each part.
 *
 * The per-figure block format is already tested against the shapes models actually produce (drifted
 * markers, stray casing, prose before the first block), so the only new thing here is the split. The
 * separator is matched loosely for the same reason: models pad it, bold it and change the dash count.
 */
export function parsePrezieReply(raw: string): OneShotFigure[] {
  const text = String(raw ?? '').replace(/\r\n/g, '\n');
  const parts = text
    .split(/^\s*[*_`]*={2,}\s*FIGURE\s*={2,}[*_`]*\s*$/im)
    .map((p) => p.trim())
    .filter(Boolean);

  const out: OneShotFigure[] = [];
  for (const part of parts) {
    const parsed = parseFigureBlocks(part);
    // A part with no markup is preamble or sign-off, not a figure. Dropping it silently is right:
    // models like to introduce their work and that is not an error.
    if (!parsed.html?.trim()) continue;
    const beat = part.match(/^BEAT:[ \t]*(.*)$/im)?.[1]?.trim();
    const figure = sanitiseFigure({
      figure_id: randomUUID(),
      name: stripEmDashes(parsed.name || `Figure ${out.length + 1}`),
      // The brief is what a later revision builds on, so it carries the beat and her own note.
      brief: stripEmDashes(
        [beat ? `From ${beat}.` : '', parsed.note ?? ''].filter(Boolean).join(' ') ||
          'Built in a one-shot from the script.'
      ),
      css: parsed.css ?? '',
      html: parsed.html,
      taps: parsed.taps ?? 0,
      interactive: parsed.interactive,
    });
    out.push({ ...figure, beat, note: parsed.note ? stripEmDashes(parsed.note) : undefined });
    if (out.length >= MAX_ONESHOT_FIGURES) break;
  }
  return out;
}

/**
 * Build a whole prezie from a script.
 *
 * Streamed, because this is by far the longest call in the console: five figures of markup and CSS on a
 * reasoning model. Without progress it is indistinguishable from a hang, and this is exactly the wait
 * that made him think the tool was broken.
 */
export async function generatePrezieFromScript(
  script: string,
  ctx: { concept?: string; angle?: string; direction?: string },
  onProgress?: (d: StreamDelta) => void
): Promise<{ figures: OneShotFigure[]; model: string }> {
  const body = script.trim();
  if (body.length < 120) throw new DraftError('no-concept');

  const parts = [
    ctx.angle?.trim() ? `THE PIECE'S ANGLE (what the whole piece argues):\n"""\n${ctx.angle.trim()}\n"""` : '',
    ctx.concept?.trim()
      ? `THE CONCEPT, as reference for any real name or number you put on screen. NOT a brief to illustrate:\n"""\n${ctx.concept.trim()}\n"""`
      : '',
    ctx.direction?.trim() ? `THE OPERATOR'S DIRECTION FOR THIS BOARD:\n"""\n${ctx.direction.trim()}\n"""` : '',
    `THE SCRIPT. One figure per BEAT, plus the CTA. Skip the hooks:\n"""\n${body}\n"""`,
  ].filter(Boolean);

  const call = {
    system: SYSTEM,
    messages: [{ role: 'user' as const, content: parts.join('\n\n') }],
    // Five or six figures of markup plus CSS plus a reasoning model's overhead. A ceiling sized for one
    // figure truncates the last two, which reads as her having found fewer beats than the script has.
    maxTokens: 40000,
    temperature: 0.6,
    json: false,
    model: oneshotModel(),
    apiKey: process.env.APRIL_OPENROUTER_API_KEY,
  };

  let raw: string;
  try {
    raw = onProgress ? await completeStream(call, onProgress) : await complete(call);
  } catch (e) {
    console.error(`[prezie-oneshot] LLM threw: ${e instanceof Error ? e.message : String(e)}`);
    throw new DraftError('llm-unavailable');
  }

  const figures = parsePrezieReply(raw);
  if (figures.length === 0) {
    console.error(
      `[prezie-oneshot] nothing usable. length=${raw.length} ` +
        `separators=${(raw.match(/={2,}\s*FIGURE/gi) ?? []).length} ` +
        `startsWith=${JSON.stringify(raw.slice(0, 200))}`
    );
    throw new DraftError('empty');
  }
  return { figures, model: oneshotModelInUse() };
}
