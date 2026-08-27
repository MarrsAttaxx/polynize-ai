/**
 * THE SLIDE COMPOSITOR. Three templates, one canvas, exactly 1080 x 1350 every time.
 *
 * Same machinery as text-overlay.tsx and the same reason for it: an image model cannot render
 * an exact font, an exact hex, an exact margin or a selectively highlighted phrase, so every
 * word on a slide is composited in code with next/og (Satori). What is new here is that the
 * LAYOUT is a named template rather than a position on a photograph, which is what lets two of
 * the three templates need no generated image at all.
 *
 * WHY THAT MATTERS RATHER THAN BEING A PREFERENCE: the only live image model is Soul, photoreal
 * people. It cannot make a diagram, a chart, a mark or legible type (higgsfield-models.ts, and
 * FLUX is commented out because its endpoint 404s). A carousel about an idea therefore cannot
 * be ten pictures of the idea. It can be ten pieces of typography on the brand field, which is
 * what `plate` is, with photographs where a photograph is actually the right answer.
 *
 * WHAT SATORI GIVES US, and the whole design lives inside it: flexbox, absolute positioning,
 * borders, border radius, linear gradients, text shadow. No grid, no filters, no transforms, no
 * shadow recipe. So depth here is layered gradients and hairlines, and the Tactile five-layer
 * box-shadow is deliberately not attempted.
 *
 * Server only (it fetches fonts and writes to the bucket).
 */

import { ImageResponse } from 'next/og';
import imageSizeFrom from 'image-size';
import { hostGeneratedImage } from './image-host';
import { parseLine, type Seg } from './text-overlay';
import {
  SLIDE_W,
  SLIDE_H,
  type SlidePosition,
  type SlideRole,
  type SlideTemplate,
} from './slide-plan';

/* ------------------------------------------------------------------ brand constants */

/**
 * From design_handoff/designs/shared/tokens.css. Load bearing: coral is human, amber is
 * hybrid, mint is agent, and none of them is remapped here. The accent arrives as a validated
 * brand hex and is used for rules, seams, the swipe cue and the highlighted phrase, so the one
 * colour decision in a set is made once by the operator.
 */
const INK = '#0a0a0f';
const SURFACE = '#13131a';
const SURFACE_2 = '#1a1a23';
const CREAM = '#f4ece4';
const DEFAULT_ACCENT = '#69fccb';

/**
 * The footer type size, and it is 26 for a reason that is not taste. These same PNGs are bound
 * into the LinkedIn document, where the practitioner floor for readable type is 24 pt. At 1080
 * wide a page point is a pixel, so nothing on a slide is allowed under 26.
 */
const FOOTER_SIZE = 26;
const FOOTER_TRACK = 3;
const SUB_FLOOR = 30;

/** Space Grotesk, the brand face, in the two weights every template uses. */
const FONT_700 =
  'https://cdn.jsdelivr.net/fontsource/fonts/space-grotesk@latest/latin-700-normal.ttf';
const FONT_500 =
  'https://cdn.jsdelivr.net/fontsource/fonts/space-grotesk@latest/latin-500-normal.ttf';

type Fonts = { bold: ArrayBuffer; medium: ArrayBuffer };
let fontCache: Fonts | null = null;

/**
 * Both weights, fetched once per warm invocation.
 *
 * A FAILED MEDIUM DEGRADES, IT DOES NOT THROW. If the 500 file cannot be fetched the bold data
 * is registered at weight 500 as well: a supporting line in the wrong weight is a slide, a
 * font error is a red screen halfway through a ten slide run.
 */
async function fonts(): Promise<Fonts> {
  if (fontCache) return fontCache;
  const bold = await fetch(FONT_700).then((r) => {
    if (!r.ok) throw new Error(`font fetch failed: ${r.status}`);
    return r.arrayBuffer();
  });
  let medium = bold;
  try {
    const res = await fetch(FONT_500);
    if (res.ok) medium = await res.arrayBuffer();
    else console.warn(`[slide-render] medium weight unavailable (${res.status}), using bold`);
  } catch (e) {
    console.warn('[slide-render] medium weight fetch threw, using bold:', e);
  }
  fontCache = { bold, medium };
  return fontCache;
}

/* ------------------------------------------------------------------ small helpers */

/** rgba() from a brand hex, for washes and hairlines. Satori parses rgba() fine. */
function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const int = parseInt(n, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));

/**
 * Normalise the words before they are typeset.
 *
 * A REAL LINE BREAK IS STILL HONOURED, but nothing asks for one any more: the template owns
 * the typesetting and the fitter does the wrapping, which is exactly why the instruction that
 * used to ask April for a raw newline inside a JSON string is gone (it was the first cause of
 * the parse failure). A break he types by hand still works, and any other control character is
 * turned into a space rather than drawn as a box.
 */
function normalise(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
     
    .replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0);
}

/**
 * THE FITTER, and it is the difference between a template and a lucky headline.
 *
 * Satori has no auto fit and no text measurement we can reach, so the size is chosen by
 * estimating the advance width of Space Grotesk (about 0.54 em at weight 700 over mixed case
 * copy) and stepping down until the block fits both the column and the box. It is an estimate,
 * so it carries a safety factor and it always errs small: a headline one line longer than
 * predicted is a tight slide, a headline that overflows is a ruined one.
 */
const ADVANCE_700 = 0.54;
const ADVANCE_500 = 0.51;
const SAFETY = 0.94;

function estLines(lines: string[], size: number, maxW: number, advance: number): number {
  const perLine = Math.max(1, Math.floor((maxW * SAFETY) / (size * advance)));
  return lines.reduce((sum, l) => sum + Math.max(1, Math.ceil(l.length / perLine)), 0);
}

function longestWord(lines: string[]): number {
  return lines.reduce(
    (m, l) => l.split(' ').reduce((mm, w) => Math.max(mm, w.length), m),
    1
  );
}

function fit(opts: {
  lines: string[];
  maxW: number;
  maxH: number;
  min: number;
  max: number;
  lineHeight: number;
  weight: 500 | 700;
}): { size: number; lines: number } {
  const advance = opts.weight === 700 ? ADVANCE_700 : ADVANCE_500;
  const word = longestWord(opts.lines);
  for (let size = opts.max; size > opts.min; size -= 2) {
    const perLine = Math.max(1, Math.floor((opts.maxW * SAFETY) / (size * advance)));
    // A single word wider than the column would overflow whatever the block height says.
    if (perLine < word) continue;
    const n = estLines(opts.lines, size, opts.maxW, advance);
    if (n * size * opts.lineHeight <= opts.maxH) return { size, lines: n };
  }
  return { size: opts.min, lines: estLines(opts.lines, opts.min, opts.maxW, advance) };
}

/* ------------------------------------------------------------------ text blocks */

/**
 * One line of copy as per-word spans, so a highlight can be a phrase and the line can wrap.
 *
 * Per word rather than per segment because Satori wraps on element boundaries: a whole
 * segment in one span is a segment that cannot break. Same technique as text-overlay.tsx,
 * which is where it was proven.
 */
function words(
  segs: Seg[],
  key: string,
  style: { size: number; weight: 500 | 700; base: string; accent: string; lineHeight: number; shadow?: boolean }
) {
  const gap = Math.round(style.size * 0.26);
  return (
    <div
      key={key}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        width: '100%',
        fontFamily: 'Space Grotesk',
        fontWeight: style.weight,
        fontSize: style.size,
        lineHeight: style.lineHeight,
        letterSpacing: style.weight === 700 ? -Math.round(style.size * 0.015) : 0,
        ...(style.shadow ? { textShadow: '0 2px 18px rgba(10,10,15,0.75)' } : {}),
      }}
    >
      {segs.flatMap((seg, si) =>
        seg.text
          .split(' ')
          .filter((w) => w.length)
          .map((w, wi) => (
            <span
              key={`${key}-${si}-${wi}`}
              style={{ color: seg.highlight ? style.accent : style.base, marginRight: gap }}
            >
              {w}
            </span>
          ))
      )}
    </div>
  );
}

/** The mono-caps furniture line. One helper, so all three templates carry identical footers. */
function label(text: string, colour: string) {
  return (
    <div
      style={{
        display: 'flex',
        fontFamily: 'Space Grotesk',
        fontWeight: 500,
        fontSize: FOOTER_SIZE,
        letterSpacing: FOOTER_TRACK,
        color: colour,
      }}
    >
      {text.toUpperCase()}
    </div>
  );
}

/**
 * THE SHARED FURNITURE, and it is what makes a set a set.
 *
 * Bottom left is the standing label, which becomes the wordmark on the close slide because
 * that is the slide a reader leaves on. Bottom right is the swipe cue on the cover and the
 * index everywhere else, so the reader always knows there is more and how much.
 *
 * Latin subset only: no arrow glyphs, no emoji, no typographic quotes outside Latin, because
 * anything outside the subset renders as an empty box. Hence "SWIPE >" in ASCII.
 */
function footer(opts: {
  kicker: string;
  n: number;
  total: number;
  role: SlideRole;
  accent: string;
  pad: number;
}) {
  const left = opts.role === 'close' && opts.total > 1 ? 'polynize.ai' : opts.kicker || 'polynize.ai';
  const right =
    opts.total <= 1 ? 'polynize.ai' : opts.role === 'cover' ? 'swipe >' : `${pad2(opts.n)} / ${pad2(opts.total)}`;
  const rightColour = opts.role === 'cover' ? opts.accent : rgba(CREAM, 0.45);
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 62,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: opts.pad,
        paddingRight: opts.pad,
      }}
    >
      {label(left, rgba(CREAM, 0.45))}
      {label(right, rightColour)}
    </div>
  );
}

/** The hairline above the footer. A border, not a shadow, because Satori draws borders. */
function hairline(pad: number) {
  return (
    <div
      style={{
        position: 'absolute',
        left: pad,
        right: pad,
        bottom: 132,
        height: 1,
        display: 'flex',
        background: rgba(CREAM, 0.12),
      }}
    />
  );
}

/* ------------------------------------------------------------------ the templates */

/**
 * Everything one composited slide needs. Exported with `slideElement` so a render can be
 * exercised without a network, a bucket or a piece: `scripts/slide-proof.tsx` writes all three
 * templates to PNG, which is the only way to find out that a CSS property Satori does not
 * support has quietly stopped drawing something.
 */
export type Frame = {
  headline: string;
  sub?: string;
  kicker: string;
  accent: string;
  n: number;
  total: number;
  role: SlideRole;
  position: SlidePosition;
  bgDataUri?: string;
};

const PLATE_PAD = 96;
const SPLIT_PAD = 72;
const FULL_PAD = 88;

/**
 * TEMPLATE 1: STATEMENT PLATE. No image, and that is the point.
 *
 * A warm ink field with one soft accent wash in the top corner, a ghost index numeral behind
 * everything, a short accent rule, then the claim at the largest type of the three templates
 * because nothing else is competing for the frame. It generates nothing, so it cannot be
 * refused by the model, cannot time out, and costs nothing per slide.
 */
function plate(f: Frame) {
  const lines = normalise(f.headline);
  const subLines = f.sub ? normalise(f.sub) : [];
  const subReserve = subLines.length ? 200 : 0;
  const maxW = SLIDE_W - PLATE_PAD * 2;
  const h = fit({
    lines,
    maxW,
    maxH: 900 - subReserve,
    min: 58,
    max: 136,
    lineHeight: 1.04,
    weight: 700,
  });
  const s = subLines.length
    ? fit({ lines: subLines, maxW: Math.min(maxW, 820), maxH: 170, min: SUB_FLOOR, max: 46, lineHeight: 1.35, weight: 500 })
    : null;

  return (
    <div
      style={{
        width: SLIDE_W,
        height: SLIDE_H,
        display: 'flex',
        position: 'relative',
        background: `linear-gradient(165deg, ${SURFACE_2} 0%, ${SURFACE} 42%, ${INK} 100%)`,
      }}
    >
      {/* The corner wash. A rounded div with a linear gradient, because Satori has no
          reliable radial gradient and a circle with a linear fill reads the same at this size. */}
      <div
        style={{
          position: 'absolute',
          top: -240,
          right: -260,
          width: 860,
          height: 860,
          borderRadius: 860,
          display: 'flex',
          background: `linear-gradient(205deg, ${rgba(f.accent, 0.18)} 0%, ${rgba(f.accent, 0)} 64%)`,
        }}
      />
      {/* The ghost index. A graphic device that costs no words and no generation. */}
      {f.total > 1 ? (
        <div
          style={{
            position: 'absolute',
            top: 44,
            right: PLATE_PAD - 12,
            display: 'flex',
            fontFamily: 'Space Grotesk',
            fontWeight: 700,
            fontSize: 250,
            lineHeight: 1,
            letterSpacing: -8,
            color: rgba(CREAM, 0.055),
          }}
        >
          {pad2(f.n)}
        </div>
      ) : null}

      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: SLIDE_W,
          height: SLIDE_H,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          paddingLeft: PLATE_PAD,
          paddingRight: PLATE_PAD,
          paddingTop: 150,
          paddingBottom: 210,
        }}
      >
        <div
          style={{
            display: 'flex',
            width: 132,
            height: 8,
            marginBottom: 44,
            borderRadius: 4,
            background: f.accent,
          }}
        />
        {lines.map((l, i) =>
          words(parseLine(l), `p${i}`, {
            size: h.size,
            weight: 700,
            base: CREAM,
            accent: f.accent,
            lineHeight: 1.04,
          })
        )}
        {s ? (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 40, maxWidth: 820 }}>
            {subLines.map((l, i) =>
              words(parseLine(l), `ps${i}`, {
                size: s.size,
                weight: 500,
                base: rgba(CREAM, 0.66),
                accent: rgba(f.accent, 0.85),
                lineHeight: 1.35,
              })
            )}
          </div>
        ) : null}
      </div>

      {hairline(PLATE_PAD)}
      {footer({ ...f, pad: PLATE_PAD })}
    </div>
  );
}

/**
 * TEMPLATE 2: SPLIT CARD. A photo in a window at the top, the words underneath.
 *
 * "Minimal text and a small image", literally. The type never sits on the photograph, which
 * means the photograph does not have to leave a quiet area for it, which means the prompt is a
 * subject line instead of a scene brief. An accent seam under the window is the brand device
 * that ties the two halves together.
 *
 * A split slide with no photo falls through to the plate composition on purpose: that is the
 * alternation the output spec asks for (text led, then visual led) and half the generations.
 */
function split(f: Frame) {
  if (!f.bgDataUri) return plate(f);

  const winW = SLIDE_W - SPLIT_PAD * 2;
  const winH = 600;
  const winBottom = SPLIT_PAD + winH;
  const lines = normalise(f.headline);
  const subLines = f.sub ? normalise(f.sub) : [];
  const subReserve = subLines.length ? 170 : 0;
  const h = fit({
    lines,
    maxW: winW,
    maxH: 430 - subReserve,
    min: 46,
    max: 94,
    lineHeight: 1.06,
    weight: 700,
  });
  const s = subLines.length
    ? fit({ lines: subLines, maxW: winW, maxH: 150, min: SUB_FLOOR, max: 42, lineHeight: 1.34, weight: 500 })
    : null;

  return (
    <div
      style={{
        width: SLIDE_W,
        height: SLIDE_H,
        display: 'flex',
        position: 'relative',
        background: `linear-gradient(180deg, ${SURFACE} 0%, ${INK} 74%)`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: SPLIT_PAD,
          left: SPLIT_PAD,
          width: winW,
          height: winH,
          display: 'flex',
          overflow: 'hidden',
          borderRadius: 18,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={f.bgDataUri}
          width={winW}
          height={winH}
          style={{ width: winW, height: winH, objectFit: 'cover', borderRadius: 18 }}
        />
      </div>
      {/* The seam. The one place the accent touches the photograph, sitting just clear of the
          window so the rounded corners are not notched by a square rule. */}
      <div
        style={{
          position: 'absolute',
          top: winBottom + 10,
          left: SPLIT_PAD,
          width: winW,
          height: 5,
          borderRadius: 3,
          display: 'flex',
          background: f.accent,
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: winBottom + 76,
          left: SPLIT_PAD,
          width: winW,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}
      >
        {lines.map((l, i) =>
          words(parseLine(l), `s${i}`, {
            size: h.size,
            weight: 700,
            base: CREAM,
            accent: f.accent,
            lineHeight: 1.06,
          })
        )}
        {s ? (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 30 }}>
            {subLines.map((l, i) =>
              words(parseLine(l), `ss${i}`, {
                size: s.size,
                weight: 500,
                base: rgba(CREAM, 0.62),
                accent: rgba(f.accent, 0.85),
                lineHeight: 1.34,
              })
            )}
          </div>
        ) : null}
      </div>

      {hairline(SPLIT_PAD)}
      {footer({ ...f, pad: SPLIT_PAD })}
    </div>
  );
}

/**
 * TEMPLATE 3: FULL FRAME. One generated image edge to edge, the words over a scrim.
 *
 * THE SCRIM IS NOT DECORATION. The old overlay leaned on a text shadow plus an instruction
 * asking the model to leave a quiet area, and a model is not a layout engine: one bright
 * return and the headline is gone. A hard gradient in front of the photograph makes legibility
 * a property of the code. The cost is honest: every full frame slide is darkened, so an airy
 * photograph comes back moody.
 *
 * This is the only template that honours the slide's `position`, because it is the only one
 * where the words can go anywhere. The scrim follows them.
 */
function full(f: Frame) {
  const top = f.position === 'top' || f.position === 'upper';
  const lines = normalise(f.headline);
  const maxW = SLIDE_W - FULL_PAD * 2;
  const h = fit({ lines, maxW, maxH: 620, min: 52, max: 118, lineHeight: 1.05, weight: 700 });
  const justify = top ? 'flex-start' : f.position === 'centre' ? 'center' : 'flex-end';

  return (
    <div style={{ width: SLIDE_W, height: SLIDE_H, display: 'flex', position: 'relative', background: INK }}>
      {f.bgDataUri ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={f.bgDataUri}
          width={SLIDE_W}
          height={SLIDE_H}
          style={{ position: 'absolute', top: 0, left: 0, width: SLIDE_W, height: SLIDE_H, objectFit: 'cover' }}
        />
      ) : null}
      {/* Two scrims, always both drawn: the heavy one under the words, a light one at the
          opposite edge so the furniture stays readable whatever the photograph does. */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: SLIDE_W,
          height: top ? 940 : 420,
          display: 'flex',
          background: top
            ? `linear-gradient(180deg, ${rgba(INK, 0.94)} 0%, ${rgba(INK, 0.7)} 52%, ${rgba(INK, 0)} 100%)`
            : `linear-gradient(180deg, ${rgba(INK, 0.7)} 0%, ${rgba(INK, 0)} 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: SLIDE_W,
          height: top ? 460 : 980,
          display: 'flex',
          background: top
            ? `linear-gradient(0deg, ${rgba(INK, 0.8)} 0%, ${rgba(INK, 0)} 100%)`
            : `linear-gradient(0deg, ${rgba(INK, 0.96)} 0%, ${rgba(INK, 0.82)} 46%, ${rgba(INK, 0)} 100%)`,
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: SLIDE_W,
          height: SLIDE_H,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: justify,
          alignItems: 'flex-start',
          paddingLeft: FULL_PAD,
          paddingRight: FULL_PAD,
          paddingTop: 120,
          paddingBottom: 200,
        }}
      >
        <div
          style={{ display: 'flex', width: 104, height: 6, marginBottom: 36, borderRadius: 3, background: f.accent }}
        />
        {lines.map((l, i) =>
          words(parseLine(l), `f${i}`, {
            size: h.size,
            weight: 700,
            base: CREAM,
            accent: f.accent,
            lineHeight: 1.05,
            shadow: true,
          })
        )}
      </div>

      {footer({ ...f, pad: FULL_PAD })}
    </div>
  );
}

/** The composition for one template. Pure: no fetch, no font, no store. */
export function slideElement(template: SlideTemplate, f: Frame) {
  return template === 'plate' ? plate(f) : template === 'split' ? split(f) : full(f);
}

/** The two font weights, exported so a proof script can register them. */
export { fonts as slideFonts };

/* ------------------------------------------------------------------ the entry point */

export type SlideRenderOpts = {
  template: SlideTemplate;
  headline: string;
  sub?: string;
  kicker?: string;
  /** A validated brand hex. Falls back to mint rather than trusting an arbitrary string. */
  accent?: string;
  n: number;
  /** How many slides in the whole set, for the index. 1 means a single card, no index. */
  total: number;
  role?: SlideRole;
  /** Honoured by `full` only: the other two templates ARE the typesetting. */
  position?: SlidePosition;
  /** The generated background. Absent for `plate`, and for a `split` slide with no prompt. */
  bgUrl?: string;
};

export type SlideRenderResult = { url?: string; error?: string };

/**
 * Compose one slide and store it. Always exactly SLIDE_W x SLIDE_H, whatever came back from
 * the model, because Instagram crops every slide of a carousel to the FIRST slide's
 * dimensions: a set rendered at two sizes is a set with nine wrong crops.
 */
export async function renderAndHostSlide(
  opts: SlideRenderOpts,
  host: { stream: string; requestOrigin?: string }
): Promise<SlideRenderResult> {
  const needsImage = opts.template !== 'plate' && !!opts.bgUrl;

  let bgDataUri: string | undefined;
  if (needsImage && opts.bgUrl) {
    try {
      const res = await fetch(opts.bgUrl);
      if (!res.ok) return { error: `could not fetch the slide image (${res.status})` };
      const buf = Buffer.from(await res.arrayBuffer());
      const dim = imageSizeFrom(buf);
      const mime = dim.type === 'jpg' ? 'image/jpeg' : `image/${dim.type ?? 'png'}`;
      bgDataUri = `data:${mime};base64,${buf.toString('base64')}`;
    } catch (e) {
      console.error('[slide-render] source fetch failed:', e);
      return { error: 'Network error reading the slide image.' };
    }
  }

  const frame: Frame = {
    headline: opts.headline,
    sub: opts.template === 'full' ? undefined : opts.sub,
    kicker: (opts.kicker ?? '').trim(),
    accent: opts.accent ?? DEFAULT_ACCENT,
    n: opts.n,
    total: Math.max(1, opts.total),
    role: opts.role ?? (opts.n === 1 ? 'cover' : 'body'),
    position: opts.position ?? 'lower',
    bgDataUri,
  };

  let png: ArrayBuffer;
  try {
    const { bold, medium } = await fonts();
    const el = slideElement(opts.template, frame);
    const response = new ImageResponse(el, {
      width: SLIDE_W,
      height: SLIDE_H,
      fonts: [
        { name: 'Space Grotesk', data: bold, weight: 700, style: 'normal' },
        { name: 'Space Grotesk', data: medium, weight: 500, style: 'normal' },
      ],
    });
    png = await response.arrayBuffer();
  } catch (e) {
    console.error('[slide-render] render failed:', e);
    return { error: 'Could not compose the slide. Try again.' };
  }

  return hostGeneratedImage(Buffer.from(png), 'image/png', host);
}
