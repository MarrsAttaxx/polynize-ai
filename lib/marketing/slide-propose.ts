/**
 * APRIL WRITES THE SLIDE PLAN. Server only.
 *
 * Split out of slide-plan.ts because that module is imported by ImageScreen, a client
 * component: the chain slide-plan -> draft -> narrative-store -> node:crypto put
 * `node:crypto` into the browser bundle and the piece page 500'd with an
 * UnhandledSchemeError. tsc compiles it happily, so the only real guardrail is that the
 * writing half lives here and nothing client-side imports this file.
 */

import type { MarketingPiece } from './piece-store';
import { conceptBodyForPiece, DraftError } from './draft';
import { getBrandVoiceForStream } from './brand-voice-store';
import { promptFragment } from './kit';
import { icpLabel } from './output-plan';
import { complete } from '@/lib/llm';
import {
  SLIDE_W,
  SLIDE_H,
  ROLES,
  cleanField,
  oneOf,
  slideCountFor,
  type Slide,
  type SlidePlan,
  type SlideRole,
} from './slide-plan';

/* ------------------------------------------------------------------ April writes it */

const SYSTEM = (opts: {
  count: number;
  outputSpec?: string;
  brandVoice?: string;
  icp?: string;
}) => `You are April, Polynize's copy chief, planning an image set: ${opts.count} slide${
  opts.count === 1 ? '' : 's'
} at ${SLIDE_W} x ${SLIDE_H}.

EVERY SLIDE MUST LAND ON ITS OWN. There is no voiceover and no narrator. A reader who sees only slide six must get something whole from it. A slide that needs the one before it to make sense does not work, and a slide that delivers neither a concrete value nor real curiosity gets cut.

${
  opts.count === 1
    ? 'ONE CARD. Reduce the argument to a single readable claim. It is the sharpest line in the piece, not a summary of it.'
    : `THE SHAPE. Slide 1 is the COVER: one specific claim or number that stops the scroll in two seconds, never a generic title. Slides 2 to ${
        opts.count - 1
      } are the BODY: one idea each, alternating a text-led slide with a visual-led one. Slide ${
        opts.count
      } is the CLOSE: the takeaway in one sentence plus one ask, and a question there is what drives the comments.`
}

FOR EACH SLIDE, three things.

1. headline: the words that go ON the slide. Under 14 words, hard limit. Use a line break where the line should break, because the break is the typesetting. Wrap ONE phrase in *asterisks* to highlight it in the brand colour; highlight the phrase that carries the meaning, never a whole line.

2. note: one plain line on what this slide is doing and what concept material it stands on. If it stands on the argument rather than on hard material, say so. This is read by the operator, not printed on the slide.

3. prompt: the BACKGROUND image behind those words. Describe a photographic or textural scene: subject, composition, light, mood. THREE RULES, all absolute. Never ask for text, words, letters, numbers, signage, logos or captions in the image; the words are composited afterwards in code and a model that also writes them ruins the slide. Leave the area where the text sits visually quiet: uncluttered, low contrast, no face and no busy detail there. Never describe a user interface, a chart, a diagram or a slide layout; this is a photograph behind type, not a rendered slide.

ALSO WRITE, once for the whole set:

world: one line, under 30 words, describing the single visual world all ${
  opts.count
} slide${
  opts.count === 1 ? '' : 's'
} live in: the palette, the light, the material, the distance. Every slide prompt is generated with this line appended, so it is what makes the set look like one set. Be specific and be consistent with it in every prompt.

caption: the post caption. 100 to 200 words, the hook inside the first 125 characters, and it must agree with slide 1 rather than repeat it word for word. No hashtags.
${opts.icp ? `\nWho it is for: ${opts.icp}.\n` : ''}${
  opts.brandVoice ? `\nBRAND VOICE:\n"""\n${opts.brandVoice}\n"""\n` : ''
}${opts.outputSpec ? `\nTHE OUTPUT SPEC:\n${opts.outputSpec}\n` : ''}
Hard constraints:
- Ground strictly in the source. Do not invent a fact, name, number, quote, client or outcome it does not contain.
- Never use the em-dash character (U+2014). Use a comma, a period, or a colon.

Return ONLY a JSON object, no prose around it and no code fences:
{"world":"...","caption":"...","slides":[{"role":"cover","headline":"...","note":"...","prompt":"..."}]}`;

/**
 * The house defaults for where the words sit. Chosen here so the screen never asks.
 *
 * The cover shouts from the centre, body slides sit low so the image reads above them,
 * and the close sits centre again because it is the line the reader leaves with.
 */
function placementFor(role: SlideRole, count: number): Pick<Slide, 'position' | 'size' | 'baseColor' | 'highlightColor'> {
  if (role === 'cover') {
    return { position: 'centre', size: 'large', baseColor: '#ffffff', highlightColor: '#69fccb' };
  }
  if (role === 'close' || count === 1) {
    return { position: 'centre', size: 'large', baseColor: '#ffffff', highlightColor: '#69fccb' };
  }
  return { position: 'lower', size: 'medium', baseColor: '#ffffff', highlightColor: '#69fccb' };
}

/**
 * Write the whole slide narrative in one call. Throws DraftError, matching the hooks and
 * draft routes, so the screen shows one honest message per failure.
 *
 * Nothing is persisted here. The client applies the plan through the existing /state
 * autosave, so there stays exactly one validated write path onto a piece.
 */
export async function proposeSlidePlan(
  owner: string,
  piece: MarketingPiece,
  steer?: string
): Promise<SlidePlan> {
  const source = await conceptBodyForPiece(owner, piece);
  if (!source.trim()) throw new DraftError('no-concept');

  const count = slideCountFor(piece);
  const brandVoice = await getBrandVoiceForStream(piece.stream).catch(() => undefined);
  const outputSpec = piece.master ? promptFragment(piece.master) : undefined;

  const steerBlock = steer?.trim()
    ? `WHAT THE OPERATOR ALREADY KNOWS HE WANTS (his own words. A complete line here is final copy and goes on a slide as written; anything that reads as direction steers the set):\n"""\n${steer.trim()}\n"""\n\n`
    : '';

  let raw: string;
  try {
    raw = await complete({
      system: SYSTEM({ count, outputSpec, brandVoice, icp: icpLabel(piece.icp) }),
      messages: [
        {
          role: 'user',
          content: `${steerBlock}SOURCE:\n"""\n${source}\n"""\n\nPlan the ${count} slide${
            count === 1 ? '' : 's'
          } and the caption.`,
        },
      ],
      /**
       * Well clear of the reasoning floor. The production model is a thinking model whose
       * reasoning tokens count against max_tokens (roughly 2000 to 2300 on a prompt this
       * shape), and ten slides carrying a headline, a note and a full image prompt is a
       * long output on top of that.
       */
      maxTokens: 10000,
      temperature: 0.8,
      json: true,
      model: process.env.SCRIPT_MODEL || undefined,
      apiKey: process.env.APRIL_OPENROUTER_API_KEY,
    });
  } catch (e) {
    console.error(`[slides] LLM call threw: ${e instanceof Error ? e.message : String(e)}`);
    throw new DraftError('llm-unavailable');
  }

  return parseProposal(raw, count);
}

/**
 * Parse April's proposal into a plan. Exported for its tests. Tolerant on shape, strict on
 * emptiness: a proposal with no usable slide fails as 'empty' rather than rendering as an
 * empty run, which reads as "April had no ideas" when the truth is a malformed response.
 */
export function parseProposal(raw: string, count: number): SlidePlan {
  let obj: unknown;
  try {
    let body = raw.trim();
    const fence = body.match(/^```(?:\w+)?\s*([\s\S]*?)\s*```$/);
    if (fence) body = fence[1].trim();
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('no JSON object');
    obj = JSON.parse(body.slice(start, end + 1));
  } catch (e) {
    console.error(`[slides] unparseable response: ${e instanceof Error ? e.message : String(e)}`);
    throw new DraftError('empty');
  }

  const o = (obj ?? {}) as Record<string, unknown>;
  const rawSlides = Array.isArray(o.slides) ? o.slides : [];
  const slides: Slide[] = rawSlides
    .slice(0, count)
    .map((rs, i) => {
      const r = (rs ?? {}) as Record<string, unknown>;
      const role: SlideRole =
        count === 1
          ? 'cover'
          : i === 0
            ? 'cover'
            : i === count - 1
              ? 'close'
              : oneOf(r.role, ROLES, 'body');
      return {
        n: i + 1,
        role,
        headline: cleanField(r.headline, 400),
        note: cleanField(r.note, 400),
        prompt: cleanField(r.prompt, 1200),
        ...placementFor(role, count),
      } satisfies Slide;
    })
    .filter((s) => s.headline !== '' || s.prompt !== '');

  if (slides.length === 0) throw new DraftError('empty');
  return {
    version: 1,
    world: cleanField(o.world, 600),
    caption: cleanField(o.caption, 2200),
    slides,
  };
}
