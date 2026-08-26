/**
 * POST /console/marketing/piece/[id]/slides/render
 *
 * ONE TAP MAKES ONE SLIDE. Compose the words and the furniture at exactly 1080 x 1350 in the
 * template the set was planned in, generating a background first only if that template needs
 * one, and hand back both urls.
 *
 * THE TEMPLATE DECIDES WHETHER ANYTHING IS GENERATED AT ALL, and that is the point of this
 * route now. A `plate` slide never calls Higgsfield: no poll, no cost, no NSFW refusal, no
 * 240 second wait. A `split` slide calls it only when April wrote a subject for it, so half a
 * ten slide set is instant. A `full` slide always calls it, which is the honest price of the
 * one template that leans on generation.
 *
 * REUSE, not reimplementation. Generation is lib/marketing/higgsfield.generateImages, the same
 * call the media library's generate route makes. The composition is
 * lib/marketing/slide-render.renderAndHostSlide, which is text-overlay.tsx's machinery with a
 * template instead of a text position. Chained server side in one request because the operator
 * is waiting and the intermediate image is of no interest to him: he asked for a slide.
 *
 * The result is NOT registered in the library. Registration is what approval means, and that
 * goes through the library's own ./add route from the screen, so a rejected slide leaves no
 * litter behind. Team-scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { getPiece } from '@/lib/marketing/piece-store';
import { isStreamId } from '@/lib/marketing/streams';
import { isHiggsfieldConfigured, generateImages } from '@/lib/marketing/higgsfield';
import { imageModelById } from '@/lib/marketing/higgsfield-models';
import { renderAndHostSlide } from '@/lib/marketing/slide-render';
import { BRAND_HEXES } from '@/lib/marketing/brand-colors';
import { sourceSizeFor, slideWantsImage } from '@/lib/marketing/slide-plan';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/** A Higgsfield generation polls for up to 240s, and the composition follows it. */
export const maxDuration = 300;

const brandHex = z.string().refine((v) => BRAND_HEXES.has(v), 'not a brand colour');

const BodySchema = z.object({
  n: z.number().int().min(1).max(10),
  /** How many slides in the set, so the index on the slide is right without reading the plan. */
  total: z.number().int().min(1).max(10).default(1),
  headline: z.string().trim().min(1).max(400),
  sub: z.string().trim().max(240).optional(),
  /** Plan level, all three of them: the template, its accent, and the standing label. */
  /** Defaults to the legacy full bleed composition so an older client keeps rendering. */
  template: z.enum(['plate', 'split', 'full']).default('full'),
  accent: brandHex.optional(),
  kicker: z.string().trim().max(40).optional(),
  role: z.enum(['cover', 'body', 'close']).optional(),
  /** Honoured by `full` only. The other two templates ARE the typesetting. */
  position: z.enum(['top', 'upper', 'centre', 'lower', 'bottom']).optional(),
  prompt: z.string().trim().max(1200).optional(),
  world: z.string().trim().max(600).optional(),
  /**
   * KEEP THIS BACKGROUND. Sent when only the words changed, so retyping a headline costs a
   * composition and not a generation. It is also what makes "try it as a plate instead"
   * instant: switching template re-renders, it does not re-generate.
   */
  bgUrl: z.string().url().max(2000).optional(),
  /**
   * The first approved slide's background, used as an image reference so slide seven lives in
   * the same world as slide one. Soul takes image_reference natively.
   */
  referenceUrl: z.string().url().max(2000).optional(),
  /**
   * Accepted and ignored. The old body carried the type size and the two colours per slide;
   * the template owns both now. Left in the schema so an older client keeps working rather
   * than 400ing mid run.
   */
  size: z.enum(['small', 'medium', 'large']).optional(),
  baseColor: brandHex.optional(),
  highlightColor: brandHex.optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  // The stream comes from the stored piece, never from the client: it keys the bucket the
  // rendered slide is stored under.
  let piece;
  try {
    piece = await getPiece(user.email, id);
  } catch (err) {
    console.error('[slides.render] piece read failed:', err);
    return NextResponse.json({ error: 'could not read the piece' }, { status: 502 });
  }
  if (!piece) return NextResponse.json({ error: 'piece not found' }, { status: 404 });
  if (!isStreamId(piece.stream)) {
    return NextResponse.json({ error: 'unknown stream' }, { status: 400 });
  }

  const prompt = body.prompt?.trim() ?? '';
  const wantsImage = slideWantsImage(body.template, { prompt });
  let bgUrl = wantsImage ? (body.bgUrl ?? '') : '';

  if (wantsImage && !bgUrl) {
    if (!isHiggsfieldConfigured()) {
      return NextResponse.json(
        {
          error:
            'Image generation is not connected yet. Add the Higgsfield keys in Vercel, or write this set as a statement plate, which needs no images.',
        },
        { status: 400 }
      );
    }
    const model = imageModelById('soul');
    if (!model) {
      return NextResponse.json({ error: 'no image model is configured' }, { status: 400 });
    }

    /**
     * THE PROMPT THE MODEL ACTUALLY SEES, and it differs by template because the job differs.
     *
     * `full` puts type over the photograph, so it still needs the quiet-area rule and it still
     * needs the shared world line to keep ten generations looking like one set. `split` puts
     * the photograph in a window with no type on it at all, so the quiet-area rule is dropped
     * and replaced by the one that actually matters in a small landscape window: one subject,
     * centred, uncluttered. The no-words rule is absolute in both, because Soul cannot spell.
     */
    const worldLine = body.world?.trim() ? ` ${body.world.trim()}` : '';
    const NO_WORDS =
      'No text, no words, no letters, no numbers, no logos and no signage anywhere in the image.';
    const composed =
      body.template === 'split'
        ? `${prompt}${worldLine} ${NO_WORDS} One clear subject, centred, with an uncluttered background. Photographic, not a screenshot and not a slide layout.`
        : `${prompt}${worldLine} ${NO_WORDS} Leave clear negative space with low detail and low contrast where a caption will sit. Photographic, not a screenshot and not a slide layout.`;

    const input: Record<string, unknown> = {
      prompt: composed,
      width_and_height: sourceSizeFor(body.template),
      quality: '1080p',
      batch_size: 1,
    };
    if (model.supportsReferenceImage && body.referenceUrl) {
      input.image_reference = { type: 'image_url', image_url: body.referenceUrl };
    }

    const res = await generateImages(model.endpoint, input);
    if (res.status !== 'completed' || res.urls.length === 0) {
      return NextResponse.json(
        {
          error:
            res.status === 'nsfw'
              ? 'That prompt was refused by the image model. Reword the slide and try again.'
              : (res.error ?? `Generation returned no image (status: ${res.status}).`),
        },
        { status: res.status === 'nsfw' ? 400 : 502 }
      );
    }
    bgUrl = res.urls[0];
  }

  /**
   * EXACTLY 1080 x 1350, every template, every slide. Instagram crops every slide of a
   * carousel to the FIRST slide's dimensions, so this is the difference between one set and
   * nine wrong crops, and it is also what makes the same ten PNGs bindable into the LinkedIn
   * document, where every page must be the same size.
   */
  const out = await renderAndHostSlide(
    {
      template: body.template,
      headline: body.headline.trim(),
      sub: body.sub?.trim() || undefined,
      kicker: body.kicker,
      accent: body.accent,
      n: body.n,
      total: body.total,
      role: body.role,
      position: body.position,
      bgUrl: bgUrl || undefined,
    },
    { stream: piece.stream, requestOrigin: new URL(req.url).origin }
  );
  if (out.error || !out.url) {
    // The background is still good, so it rides back: a failed composition must not cost a
    // generation the operator already waited for.
    return NextResponse.json(
      { error: out.error ?? 'Could not put the words on the slide.', bg_url: bgUrl || undefined },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    n: body.n,
    bg_url: bgUrl || undefined,
    url: out.url,
    generated: wantsImage,
  });
}
