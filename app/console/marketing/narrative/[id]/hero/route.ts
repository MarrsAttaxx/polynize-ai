/**
 * POST /console/marketing/narrative/[id]/hero
 *
 * MAKE THE LOOK. One image for the whole narrative, generated first, that every later image is
 * generated against.
 *
 * Marrs: "we need a 'Hero Image' as an option, so a main hero image gets created that can then
 * set the style for the rest of the images."
 *
 * WHY IT IS A DECISION AND NOT A SIDE EFFECT. The reference plumbing already existed: the slide
 * render route passes `referenceUrl` to Soul as `image_reference`, and the slide screen was
 * inferring that reference from whichever slide happened to be approved first. So the look of a
 * ten slide set was decided by approval order. The hero replaces that with one image he chose,
 * and settling it on ONE generation before spending ten is the whole economy of the thing.
 *
 * REUSE, not reimplementation. Generation is lib/marketing/higgsfield.generateImages, the same
 * call the media library's generate route makes. The crop to the post frame is
 * renderAndHostOverlay with EMPTY text, which is the compositor already proven by the slide
 * route: it forces the canvas to exactly 1080 x 1350 with the source object-fit cover, so the
 * hero is usable as a post image and not only as a reference.
 *
 * NOTHING IS PERSISTED HERE. The screen shows the result, and blessing it registers it through the
 * library's own add route and saves it onto the narrative through ./state. Same discipline as the
 * slide routes: a rejected hero leaves no litter in the library and no half-state on the narrative.
 *
 * Team scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { getNarrative } from '@/lib/marketing/narrative-store';
import { isStreamId } from '@/lib/marketing/streams';
import { isHiggsfieldConfigured, generateImages } from '@/lib/marketing/higgsfield';
import { imageModelById } from '@/lib/marketing/higgsfield-models';
import { renderAndHostOverlay } from '@/lib/marketing/text-overlay';
import { SLIDE_W, SLIDE_H, SLIDE_SOURCE_SIZE } from '@/lib/marketing/slide-plan';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/** A Higgsfield generation polls for up to 240s, and the crop follows it. */
export const maxDuration = 300;

const BodySchema = z.object({
  /** What the look is. His words, not April's: this is the one image he is art directing. */
  prompt: z.string().trim().min(3).max(1200),
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
    return NextResponse.json({ error: 'write a line about the look first' }, { status: 400 });
  }

  // The stream comes from the stored narrative, never from the client: it keys the bucket the
  // hero is stored under.
  let narrative;
  try {
    narrative = await getNarrative(id);
  } catch (err) {
    console.error('[hero] narrative read failed:', err);
    return NextResponse.json({ error: 'could not read the narrative' }, { status: 502 });
  }
  if (!narrative) return NextResponse.json({ error: 'narrative not found' }, { status: 404 });
  if (!isStreamId(narrative.lane)) {
    return NextResponse.json({ error: 'unknown stream' }, { status: 400 });
  }

  if (!isHiggsfieldConfigured()) {
    return NextResponse.json(
      { error: 'Image generation is not connected yet. Add the Higgsfield keys in Vercel.' },
      { status: 400 }
    );
  }
  const model = imageModelById('soul');
  if (!model) {
    return NextResponse.json({ error: 'no image model is configured' }, { status: 400 });
  }

  /**
   * The two house rules restated at the end, because a long prompt loses its opening
   * instructions first: no words in the image, and leave room to read against. The hero carries
   * no type itself, but every image generated FROM it will, so the negative space has to be
   * established here or the whole set inherits a busy frame.
   */
  const prompt =
    `${body.prompt.trim()} No text, no words, no letters, no numbers, no logos and no signage anywhere in the image. ` +
    'Leave clear negative space with low detail and low contrast where a caption could sit. Photographic, not a screenshot and not a slide layout.';

  const res = await generateImages(model.endpoint, {
    prompt,
    width_and_height: SLIDE_SOURCE_SIZE,
    quality: '1080p',
    batch_size: 1,
  });
  if (res.status !== 'completed' || res.urls.length === 0) {
    return NextResponse.json(
      {
        error:
          res.status === 'nsfw'
            ? 'That prompt was refused by the image model. Reword the look and try again.'
            : (res.error ?? `Generation returned no image (status: ${res.status}).`),
      },
      { status: res.status === 'nsfw' ? 400 : 502 }
    );
  }

  /**
   * Cropped to the post frame with NO text on it. `frame` forces exactly 1080 x 1350 with the
   * source object-fit cover, which is what makes the hero usable directly as the image on a text
   * post rather than only as a style reference.
   */
  const out = await renderAndHostOverlay(
    res.urls[0],
    {
      text: '',
      position: 'centre',
      hAlign: 'centre',
      size: 'medium',
      baseColor: '#ffffff',
      highlightColor: '#69fccb',
      frame: { w: SLIDE_W, h: SLIDE_H },
    },
    { stream: narrative.lane, requestOrigin: new URL(req.url).origin }
  );
  if (out.error || !out.url) {
    // The raw generation is still good, so it rides back rather than costing him the wait.
    return NextResponse.json(
      { error: out.error ?? 'Could not crop the hero.', raw_url: res.urls[0] },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, url: out.url, prompt: body.prompt.trim() });
}
