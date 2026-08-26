/**
 * THE SLIDE PLAN: what an image piece actually is.
 *
 * A carousel is TEN self-contained slides and a quote card is ONE. Both are the same
 * artifact with a different count, so they are the same plan and the same screen.
 *
 * GENERATED, NOT EXTRACTED (docs/pam-console/output-spec.md sections 2 and 5, and the
 * ig_car caveat in kit.ts). April writes the slide narrative FIRST, then a per-slide
 * background prompt. A prezie frame is the wrong source: its slides lean on a voiceover
 * a carousel does not have.
 *
 * Persisted as JSON in `piece.slides`, a field that has been declared on MarketingPiece
 * since the deck work and has had no reader and no writer until now. Storing the plan
 * rather than only the finished ids is what makes slide 3 re-editable on day two: the
 * words, the prompt and the background survive, so a redo is one tap and not a retype.
 *
 * THE ORDER GUARANTEE. `piece.media` is derived from this plan, never accumulated from
 * clicks. Gate 5 copies piece.media onto every calendar entry it creates
 * (narrative/[id]/wave/route.ts), publish.ts resolves those ids to urls in array order,
 * and metricool-client.ts posts that array verbatim. So slide order is post order only
 * if the array is built from the slide numbers, which is what mediaFromPlan does.
 *
 * CLIENT-SAFE, AND THAT IS ENFORCED BY WHAT IS NOT IN HERE. This module is imported by
 * ImageScreen, which is a 'use client' component, so it may not reach a store, the LLM
 * client, or anything that imports them. It held proposeSlidePlan once and the chain
 * slide-plan -> draft -> narrative-store -> node:crypto put `node:crypto` in the browser
 * bundle and 500'd the piece page. tsc cannot see that, only the bundler can, so the split
 * is the guardrail: the writing half lives in slide-propose.ts, which is server only.
 */

import { stripEmDashes } from '@/lib/em-dash';
import { BRAND_HEXES } from './brand-colors';

/* ------------------------------------------------------------------ the shape */

/**
 * ONE SIZE FOR EVERY SLIDE, and it is not negotiable.
 *
 * Instagram crops every slide of a carousel to the FIRST slide's dimensions, so a set
 * generated at two sizes is a set with nine wrong crops. 1080 x 1350 is also the only
 * size safe under both of Instagram's contradicting ratio docs (IG_SWIPE and IG_CARD in
 * kit.ts), and it is what the LinkedIn document wants too if that is ever unblocked.
 */
export const SLIDE_W = 1080;
export const SLIDE_H = 1350;

/** The Instagram content publishing API caps a carousel at 10 items, and Metricool is an API client. */
export const MAX_SLIDES = 10;

/**
 * The generation size asked of Soul. SOUL_SIZES (higgsfield-models.ts) offers no 4:5 at
 * all, so the nearest taller-than-wide option is generated and the overlay step crops it
 * to the exact frame. Doing the crop in the overlay is free: it already composites onto a
 * canvas of a chosen size.
 */
export const SLIDE_SOURCE_SIZE = '1536x2048';

export type SlideRole = 'cover' | 'body' | 'close';
export type SlidePosition = 'top' | 'upper' | 'centre' | 'lower' | 'bottom';
export type SlideSize = 'small' | 'medium' | 'large';

/**
 * THE TEMPLATE IS A PROPERTY OF THE SET, not of a slide.
 *
 * He picks one, writes a line about what he wants, and ten slides come back looking like one
 * deck. Three, because three is a choice and five is a decision:
 *
 *   plate  no image at all. The claim set big on the brand field. Nothing is generated.
 *   split  a photo in a window at the top, the words underneath on the field. Half the
 *          slides carry a photo; the rest render as plate, which is the alternation the
 *          output spec asks for and half the generations.
 *   full   one generated image edge to edge, the words over a scrim.
 *
 * WHY THE SPLIT IS TWO OF THREE WITHOUT A PICTURE: the only live image model is Soul, which
 * makes photoreal people and cannot make a diagram, a chart, a mark or legible type
 * (higgsfield-models.ts, FLUX is commented out because its endpoint 404s). A template that
 * needs no generation cannot be refused, cannot time out, and costs nothing, which is why
 * `plate` is the default rather than the fallback.
 */
export type SlideTemplate = 'plate' | 'split' | 'full';
export const TEMPLATES: SlideTemplate[] = ['plate', 'split', 'full'];

/** Legacy plans have no template and were composed full bleed, so that is what they stay. */
export const LEGACY_TEMPLATE: SlideTemplate = 'full';

export type Slide = {
  /** 1-based position, and the only thing that decides post order. Stable for the piece's life. */
  n: number;
  role: SlideRole;
  /** The words composited onto the slide. Wrap a phrase in *asterisks* to highlight it. */
  headline: string;
  /**
   * The supporting line under the headline. Optional by design: `plate` and `split` have room
   * for it, `full` does not and ignores it. Under 18 words, no highlight.
   */
  sub?: string;
  /** April's one line on why this slide exists. Read only, and the thing that makes a bad slide diagnosable. */
  note: string;
  /**
   * The BACKGROUND prompt. No words in it: the words are composited deterministically.
   *
   * EMPTY IS A REAL ANSWER NOW. A `plate` slide never has one, and a `split` slide with an
   * empty prompt is a deliberate type-only slide in a photo set. Empty means "render this one
   * without a picture", never "this slide is unfinished".
   */
  prompt: string;
  position: SlidePosition;
  size: SlideSize;
  baseColor: string;
  highlightColor: string;
  /** The generated background, before the words. Kept so changing the words costs no generation. */
  bg_url?: string;
  /** The finished slide, background plus words, at exactly SLIDE_W x SLIDE_H. */
  url?: string;
  /** Set once the finished slide has been registered in the stream library. */
  media_id?: string;
  approved?: boolean;
};

export type SlidePlan = {
  version: 1;
  /**
   * THE TEMPLATE, chosen once, before April writes anything. It decides the typesetting, the
   * furniture, how many words each slide can carry, and whether there is an image prompt to
   * write at all, which is why it is picked first and not adjusted per slide.
   */
  template: SlideTemplate;
  /**
   * The one accent, from the brand palette, for the whole set. Rules, seams, the highlighted
   * phrase and the swipe cue all use it.
   *
   * PLAN LEVEL ON PURPOSE. Coral is human, amber is hybrid and mint is agent, so an accent
   * rotated per slide for visual variety would quietly remap the brand's only colour
   * grammar. One accent per set means the colour still means what it means.
   */
  accent: string;
  /**
   * The standing label in the bottom left of every slide, in mono caps: the piece or the
   * series it belongs to ("EMERGENT AI"). Written once, not per slide, because repeating it
   * ten times is ten chances to drift and ten sets of tokens.
   */
  kicker: string;
  /**
   * ONE VISUAL WORLD for the whole set, in one line. Appended to every slide's prompt so
   * separately generated images read as one deck rather than as stock photos. Empty on a
   * `plate` set, because nothing is generated and there is no world to hold.
   */
  world: string;
  /** The post caption. Written with the slides so the hook and slide one agree. */
  caption: string;
  slides: Slide[];
};

/* ------------------------------------------------------------------ pure helpers */

export const POSITIONS: SlidePosition[] = ['top', 'upper', 'centre', 'lower', 'bottom'];
export const SIZES: SlideSize[] = ['small', 'medium', 'large'];
export const ROLES: SlideRole[] = ['cover', 'body', 'close'];

/** How many slides this piece wants. One master decides it, and nothing on screen asks. */
export function slideCountFor(piece: { master?: string; format?: string }): number {
  if (piece.master === 'images') return 1;
  if (piece.master === 'carousel') return MAX_SLIDES;
  return piece.format === 'single_image' ? 1 : MAX_SLIDES;
}

export function cleanField(v: unknown, max: number): string {
  return typeof v === 'string' ? stripEmDashes(v).trim().slice(0, max) : '';
}

export function oneOf<T extends string>(v: unknown, allowed: T[], fallback: T): T {
  return typeof v === 'string' && (allowed as string[]).includes(v) ? (v as T) : fallback;
}

/**
 * A brand hex or the house accent. Validated here as well as at the route, because a stored
 * plan is untrusted jsonb and the accent reaches a rendered PNG.
 */
export function brandHexOr(v: unknown, fallback: string): string {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return BRAND_HEXES.has(s) ? s : fallback;
}

/**
 * Does this slide want a generated background? The one place that question is answered.
 *
 * `plate` never does. `full` always does. `split` does when April wrote a prompt for it, and a
 * split slide with no prompt is a type-only slide by design, not a broken one.
 */
export function slideWantsImage(template: SlideTemplate, slide: Pick<Slide, 'prompt'>): boolean {
  if (template === 'plate') return false;
  if (template === 'full') return true;
  return slide.prompt.trim().length > 0;
}

/** The Soul size generated for this template, cropped to the frame by the compositor. */
export function sourceSizeFor(template: SlideTemplate): string {
  // The split window is landscape, so a landscape generation crops least into it.
  return template === 'split' ? '2048x1152' : SLIDE_SOURCE_SIZE;
}

/**
 * Parse the stored plan defensively. `piece.slides` is untrusted jsonb text, so a
 * malformed plan reads as "no plan yet" and the screen offers to write one, rather than
 * throwing on a render the operator cannot recover from.
 */
export function parseSlidePlan(raw: string | undefined | null): SlidePlan | null {
  if (!raw || typeof raw !== 'string') return null;
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const o = obj as Record<string, unknown>;
  if (!Array.isArray(o.slides)) return null;

  const slides: Slide[] = o.slides
    .map((raws, i) => {
      const r = (raws ?? {}) as Record<string, unknown>;
      const n = typeof r.n === 'number' && Number.isFinite(r.n) ? Math.floor(r.n) : i + 1;
      const url = cleanField(r.url, 2000);
      const mediaId = cleanField(r.media_id, 200);
      return {
        n,
        role: oneOf(r.role, ROLES, i === 0 ? 'cover' : 'body'),
        headline: cleanField(r.headline, 400),
        sub: cleanField(r.sub, 240) || undefined,
        note: cleanField(r.note, 400),
        prompt: cleanField(r.prompt, 1200),
        position: oneOf(r.position, POSITIONS, 'centre'),
        size: oneOf(r.size, SIZES, 'medium'),
        baseColor: cleanField(r.baseColor, 20) || '#ffffff',
        highlightColor: cleanField(r.highlightColor, 20) || '#69fccb',
        bg_url: cleanField(r.bg_url, 2000) || undefined,
        url: url || undefined,
        media_id: mediaId || undefined,
        // Approved only counts when there is something approved: a plan edited by hand
        // must never claim a slide is done with no file behind it.
        approved: Boolean(r.approved) && Boolean(url) && Boolean(mediaId),
      } satisfies Slide;
    })
    .filter((s) => s.n >= 1 && s.n <= MAX_SLIDES)
    .sort((a, b) => a.n - b.n)
    .slice(0, MAX_SLIDES);

  if (slides.length === 0) return null;
  return {
    version: 1,
    template: oneOf(o.template, TEMPLATES, LEGACY_TEMPLATE),
    accent: brandHexOr(o.accent, '#69fccb'),
    kicker: cleanField(o.kicker, 40),
    world: cleanField(o.world, 600),
    caption: cleanField(o.caption, 2200),
    slides,
  };
}

export function serialiseSlidePlan(plan: SlidePlan): string {
  return JSON.stringify(plan);
}

/**
 * THE DEFINITION OF DONE, in one function.
 *
 * The ids the post ships with, in slide order. Only approved slides count, so a
 * half-finished run ships what was actually blessed and nothing else.
 */
export function mediaFromPlan(plan: SlidePlan | null): string[] {
  if (!plan) return [];
  return [...plan.slides]
    .sort((a, b) => a.n - b.n)
    .filter((s) => s.approved && s.media_id)
    .map((s) => s.media_id as string)
    .slice(0, MAX_SLIDES);
}

/** The next slide still needing a decision, starting after `from`, wrapping once. */
export function nextUnapproved(plan: SlidePlan, from: number): number | null {
  const after = plan.slides.find((s) => s.n > from && !s.approved);
  if (after) return after.n;
  const any = plan.slides.find((s) => !s.approved);
  return any ? any.n : null;
}

/** Where the run is up to: the first slide without a decision, or the last slide when done. */
export function runPosition(plan: SlidePlan): number {
  const first = plan.slides.find((s) => !s.approved);
  return first ? first.n : (plan.slides[plan.slides.length - 1]?.n ?? 1);
}

export function approvedCount(plan: SlidePlan | null): number {
  return plan ? plan.slides.filter((s) => s.approved).length : 0;
}
