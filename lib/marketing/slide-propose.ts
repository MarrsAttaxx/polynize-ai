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
  LEGACY_TEMPLATE,
  brandHexOr,
  cleanField,
  oneOf,
  slideCountFor,
  type Slide,
  type SlidePlan,
  type SlideRole,
  type SlideTemplate,
} from './slide-plan';
import { templateSpec } from './slide-templates';

/* ------------------------------------------------------------------ April writes it */

/**
 * WHAT SHE WRITES DEPENDS ON THE TEMPLATE, and that is the whole efficiency.
 *
 * The template is chosen before she is asked anything, and it owns the typesetting: the type
 * size, the wrapping, the position, the colours and the furniture are all decided in code
 * (slide-render.tsx). So the prompt no longer asks for any of it, and on a `plate` set it does
 * not ask for an image brief or a visual world either, because nothing is generated.
 *
 * Three things came out of the brief and each one was a live failure mode:
 *
 * 1. "Use a line break where the line should break" is GONE. It asked for a raw newline inside
 *    a JSON string value, which is invalid JSON, and every headline was another chance to kill
 *    the whole response. The fitter wraps now, so there is nothing to ask for.
 * 2. The image rules only appear when there is an image. On a plate set the entire block goes,
 *    along with the world line.
 * 3. The example object at the end names exactly the keys wanted for THIS template, because in
 *    JSON mode the example is the strongest shape signal the model gets.
 */
const FIELDS = (t: SlideTemplate, count: number): string => {
  const spec = templateSpec(t);
  const lines: string[] = [];
  lines.push(
    `1. headline: the words that go ON the slide. Under ${spec.limits.headlineWords} words, hard limit. Do NOT break the lines and do not use any line breaks: the layout sets the type and wraps it for you. Wrap ONE phrase in *asterisks* to highlight it in the brand colour; highlight the phrase that carries the meaning, never a whole line.`
  );
  if (spec.limits.subWords > 0) {
    lines.push(
      `2. sub: ONE supporting line under the headline, under ${spec.limits.subWords} words, plain, no highlight. It earns its place by adding the thing the headline had to leave out. Leave it out entirely when the headline is complete on its own.`
    );
  }
  lines.push(
    `${spec.limits.subWords > 0 ? '3' : '2'}. note: one plain line on what this slide is doing and what concept material it stands on. If it stands on the argument rather than on hard material, say so. This is read by the operator, not printed on the slide.`
  );
  if (t === 'split') {
    lines.push(
      `${spec.limits.subWords > 0 ? '4' : '3'}. prompt: the PHOTOGRAPH for the small window at the top of the card, and ONLY on the slides that genuinely want one. Under 20 words: one subject, the light, the framing. AT MOST ${Math.ceil(
        count / 2
      )} of the ${count} slides carry a photograph. On every other slide leave prompt as an empty string, and that slide is set as type alone, which is the alternation this format wants. Two absolutes: never ask for text, words, letters, numbers, signage or logos in the image, and never describe an interface, a chart, a diagram or a slide layout. The only image model available makes photographs of people and cannot draw anything.`
    );
  }
  if (t === 'full') {
    lines.push(
      `${spec.limits.subWords > 0 ? '4' : '3'}. prompt: the BACKGROUND image behind those words. Describe a photographic or textural scene: subject, composition, light, mood, under ${spec.limits.promptChars} characters. THREE RULES, all absolute. Never ask for text, words, letters, numbers, signage, logos or captions in the image; the words are composited afterwards in code and a model that also writes them ruins the slide. Leave the area where the text sits visually quiet: uncluttered, low contrast, no face and no busy detail there. Never describe a user interface, a chart, a diagram or a slide layout; this is a photograph behind type, not a rendered slide.`
    );
  }
  return lines.join('\n\n');
};

const EXAMPLE = (t: SlideTemplate): string => {
  if (t === 'plate') {
    return '{"caption":"...","slides":[{"role":"cover","headline":"...","sub":"...","note":"..."}]}';
  }
  if (t === 'split') {
    return '{"world":"...","caption":"...","slides":[{"role":"cover","headline":"...","sub":"...","note":"...","prompt":"..."}]}';
  }
  return '{"world":"...","caption":"...","slides":[{"role":"cover","headline":"...","note":"...","prompt":"..."}]}';
};

const LOOK = (t: SlideTemplate): string => {
  if (t === 'plate') {
    return 'THE LOOK IS ALREADY DECIDED: a statement plate. Every slide is type on the brand field, no photograph anywhere, set large. So the words are the whole slide and a vague line has nothing to hide behind.';
  }
  if (t === 'split') {
    return 'THE LOOK IS ALREADY DECIDED: a split card. A photograph sits in a window across the top of the slide and the words sit underneath it on the brand field. The words are never on top of the photograph, so the photograph does not have to make room for them.';
  }
  return 'THE LOOK IS ALREADY DECIDED: full frame. One photograph fills the slide and the words sit over it behind a dark scrim, so the words have to be short and the picture has to carry mood rather than detail.';
};

const SYSTEM = (opts: {
  count: number;
  template: SlideTemplate;
  outputSpec?: string;
  brandVoice?: string;
  icp?: string;
}) => `You are April, Polynize's copy chief, planning an image set: ${opts.count} slide${
  opts.count === 1 ? '' : 's'
} at ${SLIDE_W} x ${SLIDE_H}.

${LOOK(opts.template)}

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

FOR EACH SLIDE:

${FIELDS(opts.template, opts.count)}

ALSO WRITE, once for the whole set:
${
  opts.template === 'plate'
    ? ''
    : `
world: one line, under 30 words, describing the single visual world every photograph lives in: the palette, the light, the material, the distance. Each prompt is generated with this line appended, so it is what makes the set look like one set. Be specific and be consistent with it in every prompt.
`
}
caption: the post caption. 100 to 200 words, the hook inside the first 125 characters, and it must agree with slide 1 rather than repeat it word for word. No hashtags.
${opts.icp ? `\nWho it is for: ${opts.icp}.\n` : ''}${
  opts.brandVoice ? `\nBRAND VOICE:\n"""\n${opts.brandVoice}\n"""\n` : ''
}${opts.outputSpec ? `\nTHE OUTPUT SPEC:\n${opts.outputSpec}\n` : ''}
Hard constraints:
- Ground strictly in the source. Do not invent a fact, name, number, quote, client or outcome it does not contain.
- Never use the em-dash character (U+2014). Use a comma, a period, or a colon.
- Every value is a single line of plain text. Never press a line break inside a value.

Return ONLY a JSON object, no prose around it and no code fences:
${EXAMPLE(opts.template)}`;

/**
 * The house defaults for where the words sit, and they are now a FALLBACK rather than the
 * design: `plate` and `split` place the words themselves, and only `full` reads `position`.
 * Kept because the fields are on the type, the stored plans have them, and the media library's
 * own overlay still speaks this language.
 *
 * The cover shouts from the centre, body slides sit low so the image reads above them, and the
 * close sits centre again because it is the line the reader leaves with.
 */
function placementFor(
  role: SlideRole,
  count: number,
  accent: string
): Pick<Slide, 'position' | 'size' | 'baseColor' | 'highlightColor'> {
  const colours = { baseColor: '#f4ece4', highlightColor: accent };
  if (role === 'cover' || role === 'close' || count === 1) {
    return { position: 'centre', size: 'large', ...colours };
  }
  return { position: 'lower', size: 'medium', ...colours };
}

/** What the operator chose before April was asked anything. */
export type SlideBrief = {
  template: SlideTemplate;
  /** A brand hex. One per set, so the colour grammar cannot drift slide to slide. */
  accent?: string;
  /** The standing label in the corner of every slide, e.g. "Emergent AI". */
  kicker?: string;
  /** His own words about what he wants on these slides. */
  steer?: string;
};

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
  brief: SlideBrief
): Promise<SlidePlan> {
  const source = await conceptBodyForPiece(owner, piece);
  if (!source.trim()) throw new DraftError('no-concept');

  const steer = brief.steer;
  const count = slideCountFor(piece);
  const brandVoice = await getBrandVoiceForStream(piece.stream).catch(() => undefined);
  const outputSpec = piece.master ? promptFragment(piece.master) : undefined;

  const resolvedModel = process.env.SCRIPT_MODEL || undefined;

  const steerBlock = steer?.trim()
    ? `WHAT THE OPERATOR ALREADY KNOWS HE WANTS (his own words. A complete line here is final copy and goes on a slide as written; anything that reads as direction steers the set):\n"""\n${steer.trim()}\n"""\n\n`
    : '';

  let raw: string;
  try {
    raw = await complete({
      system: SYSTEM({ count, template: brief.template, outputSpec, brandVoice, icp: icpLabel(piece.icp) }),
      messages: [
        {
          role: 'user',
          content: `${steerBlock}SOURCE:\n"""\n${source}\n"""\n\nPlan the ${count} slide${
            count === 1 ? '' : 's'
          } and the caption.`,
        },
      ],
      /**
       * A CAP, NOT A TARGET, and sized for the worst template rather than the average one.
       *
       * The production model is a thinking model whose reasoning tokens count against
       * max_tokens (roughly 2000 to 2300 on a prompt this shape). A `full` set is ten
       * headlines, ten notes and ten scene briefs on top of that, which is the payload that
       * ran out of room at 10000. A `plate` set has no prompts and no world line and will not
       * come close to this, and a run that reasons less simply spends less, so the ceiling
       * matches the house's other big JSON generators (podcast-clips.ts) rather than hedging.
       */
      maxTokens: 24000,
      temperature: 0.8,
      json: true,
      model: resolvedModel,
      apiKey: process.env.APRIL_OPENROUTER_API_KEY,
    });
  } catch (e) {
    console.error(`[slides] LLM call threw: ${e instanceof Error ? e.message : String(e)}`);
    throw new DraftError('llm-unavailable');
  }

  return parseProposal(raw, count, {
    template: brief.template,
    accent: brief.accent,
    kicker: brief.kicker,
    model: resolvedModel,
  });
}

/**
 * Parse April's proposal into a plan. Exported for its tests. Tolerant on shape, strict on
 * emptiness: a proposal with no usable slide fails as 'empty' rather than rendering as an
 * empty run, which reads as "April had no ideas" when the truth is a malformed response.
 */
/**
 * THE FIRST BALANCED JSON OBJECT in a string, by brace matching.
 *
 * `indexOf('{')` to `lastIndexOf('}')` was the old span and it is wrong in two live ways. A
 * thinking model that leaks any reasoning prose containing a brace moves the start; anything
 * after the object (a closing remark, a second object) moves the end. Both produce a slice that
 * is not JSON, which read to the operator as "the slides came back empty".
 *
 * Quote and escape aware, so a brace inside a string literal (which an image prompt can easily
 * contain) does not unbalance the count.
 */
function firstJsonObject(body: string): string | null {
  const start = body.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < body.length; i++) {
    const c = body[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (c === '\\') {
      esc = true;
      continue;
    }
    if (c === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return body.slice(start, i + 1);
    }
  }
  // Unbalanced: the response was cut off mid object. Everything from the start is what we have.
  return null;
}

/**
 * SALVAGE. When the whole object will not parse, pull out the individual slide objects that ARE
 * complete and use those.
 *
 * A truncated response loses the tail, not the head, so eight good slides are usually sitting in
 * it. Eight slides he can finish beats a red error he can only retry, and the screen already
 * handles a short plan: it says "8 of 10" and lets him add the rest.
 */
function salvageSlides(body: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < body.length; i++) {
    if (body[i] !== '{') continue;
    const chunk = firstJsonObject(body.slice(i));
    /**
     * An unbalanced object here is not the end of the road, it is the NORMAL case: a truncated
     * response always leaves the OUTER object unbalanced, so breaking on the first one meant
     * salvage bailed instantly on exactly the failure it exists for. Move to the next brace,
     * which is the first complete slide inside it.
     */
    if (!chunk) continue;
    let matched = false;
    try {
      const o = JSON.parse(chunk) as Record<string, unknown>;
      // A slide is anything carrying words or a picture brief. A wrapper object has neither.
      if (
        typeof o.headline === 'string' ||
        typeof o.prompt === 'string' ||
        typeof o.text === 'string' ||
        typeof o.image === 'string'
      ) {
        out.push(o);
        matched = true;
      }
    } catch {
      /* not a complete object */
    }
    /**
     * ONLY SKIP PAST A MATCH. Skipping past everything was a bug of mine: a wrapper object
     * parses fine and is not a slide, and jumping over it jumped over every slide INSIDE it, so
     * a response with any prose in front of the object salvaged nothing at all. Advancing by one
     * lets the scan descend. Quadratic in principle, irrelevant in practice on a 2 KB response.
     */
    if (matched) i += chunk.length - 1;
  }
  return out;
}

/**
 * An array of slide-shaped objects, wherever it is in the response.
 *
 * `o.slides` was the only place we looked. In JSON mode a model will sometimes wrap its answer
 * (`{"plan":{"slides":[...]}}`, `{"result":...}`), and the old code read that as zero slides and
 * threw, with NO log line, so the one failure mode that gave us nothing to go on was also a
 * likely one. One level of nesting is searched, which covers every wrapper seen in practice.
 */
function findSlides(o: Record<string, unknown>): unknown[] {
  const looksRight = (v: unknown): v is unknown[] =>
    Array.isArray(v) &&
    v.length > 0 &&
    v.every((x) => !!x && typeof x === 'object' && !Array.isArray(x));
  if (looksRight(o.slides)) return o.slides;
  for (const v of Object.values(o)) {
    if (looksRight(v)) return v;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const inner = (v as Record<string, unknown>).slides;
      if (looksRight(inner)) return inner;
    }
  }
  return [];
}

/**
 * Parse April's proposal into a plan. Exported for its tests.
 *
 * TOLERANT ON SHAPE, STRICT ON EMPTINESS, and LOUD on the way out. Every failure now logs the
 * model, the length and both ends of the response, because the two shapes that used to fail
 * (a wrapped object, and a body whose brace span was wrong) logged nothing at all and left
 * "the slides came back empty or malformed" as the only evidence.
 */
export function parseProposal(
  raw: string,
  count: number,
  brief?: { template?: SlideTemplate; accent?: string; kicker?: string; model?: string }
): SlidePlan {
  const template = brief?.template ?? LEGACY_TEMPLATE;
  const accent = brandHexOr(brief?.accent, '#69fccb');
  const model = brief?.model;
  const body = (() => {
    const t = raw.trim();
    const fence = t.match(/^```(?:\w+)?\s*([\s\S]*?)\s*```$/);
    return fence ? fence[1].trim() : t;
  })();
  const where = `model=${model ?? 'default'} len=${body.length}`;

  let rawSlides: unknown[] = [];
  let world = '';
  let caption = '';

  /**
   * Try each balanced object in turn, not just the first. Reasoning prose containing a brace
   * (`the set {should} open on a claim`) makes the FIRST balanced object a fragment that is not
   * JSON, and stopping there was the difference between a working response and a red error.
   */
  let from = 0;
  for (let attempt = 0; attempt < 4 && rawSlides.length === 0; attempt++) {
    const at = body.indexOf('{', from);
    if (at === -1) break;
    const span = firstJsonObject(body.slice(at));
    if (!span) break;
    from = at + 1;
    try {
      const o = (JSON.parse(span) ?? {}) as Record<string, unknown>;
      const found = findSlides(o);
      if (found.length > 0) {
        rawSlides = found;
        world = cleanField(o.world, 600);
        caption = cleanField(o.caption, 2200);
      }
    } catch {
      /* a fragment, not the object. Try the next brace. */
    }
  }

  if (rawSlides.length === 0) {
    rawSlides = salvageSlides(body);
    if (rawSlides.length > 0) {
      console.warn(`[slides] salvaged ${rawSlides.length} slide(s) from a malformed response (${where})`);
    }
  }

  if (rawSlides.length === 0) {
    console.error(
      `[slides] nothing usable in the response (${where}). head=${JSON.stringify(
        body.slice(0, 240)
      )} tail=${JSON.stringify(body.slice(-160))}`
    );
    throw new DraftError('empty');
  }

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
        // `text` and `words` are what a model reaches for when it forgets the key name.
        headline: cleanField(r.headline ?? r.text ?? r.words, 400),
        // A template with no room for a supporting line drops it rather than storing a field
        // nothing will ever draw.
        sub:
          templateSpec(template).limits.subWords > 0
            ? cleanField(r.sub ?? r.subhead ?? r.support, 240) || undefined
            : undefined,
        note: cleanField(r.note, 400),
        /**
         * EMPTY IS LEGAL ON A PLATE, and on a split slide it is the instruction "no photograph
         * here". A plate prompt is thrown away rather than stored, so a model that writes one
         * anyway cannot cause a generation nobody asked for.
         */
        prompt:
          template === 'plate' ? '' : cleanField(r.prompt ?? r.image ?? r.background, 1200),
        ...placementFor(role, count, accent),
      } satisfies Slide;
    })
    /**
     * A HEADLINE IS NOW THE ONLY THING THAT MAKES A SLIDE REAL. It used to be "words or a
     * picture brief", which was right when every slide was a photograph. On a plate set there
     * are no prompts at all, so keeping that test would have kept prompt-only junk and thrown
     * nothing away.
     */
    .filter((s) => s.headline !== '');

  if (slides.length === 0) {
    console.error(`[slides] every slide came back blank (${where})`);
    throw new DraftError('empty');
  }
  return {
    version: 1,
    template,
    accent,
    kicker: cleanField(brief?.kicker, 40),
    world: template === 'plate' ? '' : world,
    caption,
    slides,
  };
}
