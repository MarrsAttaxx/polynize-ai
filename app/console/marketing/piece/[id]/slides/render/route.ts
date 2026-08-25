/**
 * POST /console/marketing/piece/[id]/slides/render
 *
 * ONE TAP MAKES ONE SLIDE. Generate the background with Higgsfield, then composite the
 * brand-standard words onto it at exactly 1080 x 1350, and hand back both urls.
 *
 * REUSE, not reimplementation. The generation is lib/marketing/higgsfield.generateImages,
 * the same call app/console/marketing/stream/[stream]/media/generate/route.ts makes, and
 * the words are lib/marketing/text-overlay.renderAndHostOverlay, the same call the media
 * library's overlay route makes. Chained server side in one request rather than through
 * two HTTP hops, because the operator is waiting and the intermediate image is of no
 * interest to him: he asked for a slide, not for a background.
 *
 * The result is NOT registered in the library. Registration is what approval means, and
 * that goes through the library's own ./add route from the screen, so a rejected slide
 * never leaves litter behind. Team-scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { getPiece } from '@/lib/marketing/piece-store';
import { isStreamId } from '@/lib/marketing/streams';
import { isHiggsfieldConfigured, generateImages } from '@/lib/marketing/higgsfield';
import { imageModelById } from '@/lib/marketing/higgsfield-models';
import { renderAndHostOverlay } from '@/lib/marketing/text-overlay';
import { BRAND_HEXES } from '@/lib/marketing/brand-colors';
import { SLIDE_W, SLIDE_H, SLIDE_SOURCE_SIZE } from '@/lib/marketing/slide-plan';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/** A Higgsfield generation polls for up to 240s, and the overlay render follows it. */
export const maxDuration = 300;

const brandHex = z.string().refine((v) => BRAND_HEXES.has(v), 'not a brand colour');

const BodySchema = z.object({
  n: z.number().int().min(1).max(10),
  headline: z.string().trim().min(1).max(400),
  prompt: z.string().trim().max(1200).optional(),
  world: z.string().trim().max(600).optional(),
  position: z.enum(['top', 'upper', 'centre', 'lower', 'bottom']).optional(),
  size: z.enum(['small', 'medium', 'large']).optional(),
  baseColor: brandHex.optional(),
  highlightColor: brandHex.optional(),
  /**
   * KEEP THIS BACKGROUND. Sent when only the words changed, so retyping a headline costs
   * a render and not a generation. It is also what makes "try the words bigger" instant.
   */
  bgUrl: z.string().url().max(2000).optional(),
  /**
   * The first approved slide's background, used as an image reference so slide seven
   * lives in the same world as slide one. Soul takes image_reference natively.
   */
  referenceUrl: z.string().url().max(2000).optional(),
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

  // The stream comes from the stored piece, never from the client: it keys the bucket
  // the rendered slide is stored under.
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

  let bgUrl = body.bgUrl ?? '';

  if (!bgUrl) {
    if (!isHiggsfieldConfigured()) {
      return NextResponse.json(
        { error: 'Image generation is not connected yet. Add the Higgsfield keys in Vercel.' },
        { status: 400 }
      );
    }
    if (!body.prompt) {
      return NextResponse.json(
        { error: 'This slide has no image prompt yet. Write the slides first.' },
        { status: 400 }
      );
    }
    const model = imageModelById('soul');
    if (!model) {
      return NextResponse.json({ error: 'no image model is configured' }, { status: 400 });
    }

    /**
     * THE PROMPT THE MODEL ACTUALLY SEES. The slide's own prompt, then the deck's shared
     * world so ten slides match, then the two house rules restated at the end because a
     * long prompt loses its opening instructions first: no words in the image, and keep
     * the area under the type quiet enough to read against.
     */
    const worldLine = body.world?.trim() ? ` ${body.world.trim()}` : '';
    const prompt =
      `${body.prompt.trim()}${worldLine} No text, no words, no letters, no numbers, no logos and no signage anywhere in the image. ` +
      'Leave clear negative space with low detail and low contrast where a caption will sit. Photographic, not a screenshot and not a slide layout.';

    const input: Record<string, unknown> = {
      prompt,
      width_and_height: SLIDE_SOURCE_SIZE,
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
   * THE CROP HAPPENS HERE. `frame` forces the canvas to exactly 1080 x 1350 and the
   * source is object-fit cover onto it, so every slide in the set is identical in size
   * whatever the model returned. Instagram crops every slide to the first slide's
   * dimensions, so this is the difference between one set and nine wrong crops.
   */
  const out = await renderAndHostOverlay(
    bgUrl,
    {
      text: body.headline.trim(),
      position: body.position ?? 'centre',
      hAlign: 'centre',
      size: body.size ?? 'medium',
      baseColor: body.baseColor ?? '#ffffff',
      highlightColor: body.highlightColor ?? '#69fccb',
      frame: { w: SLIDE_W, h: SLIDE_H },
    },
    { stream: piece.stream, requestOrigin: new URL(req.url).origin }
  );
  if (out.error || !out.url) {
    // The background is still good, so it rides back: a failed overlay must not cost a
    // generation the operator already waited for.
    return NextResponse.json(
      { error: out.error ?? 'Could not put the words on the slide.', bg_url: bgUrl },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, n: body.n, bg_url: bgUrl, url: out.url });
}
