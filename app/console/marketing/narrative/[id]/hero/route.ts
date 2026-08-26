/**
 * POST /console/marketing/narrative/[id]/hero
 *
 * MAKE THE LOOK. One image for the whole narrative, generated first, that every later image is
 * generated against.
 *
 * Marrs: "we need a 'Hero Image' as an option, so a main hero image gets created that can then
 * set the style for the rest of the images."
 *
 * FOUR AT A TIME, AT 4:3 (D56). Marrs: "I would like the prompt to generate four images, and
 * then you choose the one you want. Make those 4:3 ratio."
 *
 * One prompt, one request, four candidates. Soul takes `batch_size`, so this is one generation
 * call rather than four, and 4:3 is a real Soul size (`2048x1536`) rather than a crop of a
 * landscape, which matters because a crop would mean the photograph he picked is not quite the
 * photograph he gets.
 *
 * WHY IT IS A DECISION AND NOT A SIDE EFFECT. The reference plumbing already existed: the slide
 * render route passes `referenceUrl` to Soul as `image_reference`, and the slide screen was
 * inferring that reference from whichever slide happened to be approved first. So the look of a
 * ten slide set was decided by approval order. The hero replaces that with one image he chose,
 * and settling it on ONE generation before spending ten is the whole economy of the thing.
 *
 * ALL FOUR ARE COPIED INTO OUR BUCKET BEFORE THEY ARE SHOWN, and that is not premature work.
 *
 * A Higgsfield url is temporary and `/media/add` stores a url and nothing else, so registering
 * one straight off their CDN makes a library entry that works today and 404s later. The
 * alternative shape, hosting only the one he picks, means the client hands the server a url to go
 * and fetch, which is a request forgery hole for the sake of saving three small files. So the
 * candidates he judges ARE the files that get used, and the three he rejects are unregistered
 * bytes in a bucket that nothing points at.
 *
 * Byte for byte, through mirrorImageToHost rather than the compositor. renderAndHostOverlay would
 * also produce a hosted copy, but it re-encodes to PNG at a frame you give it, which is right
 * when the point is to compose something and wrong when the point is to keep exactly what the
 * model made. The hero used to go through it to force the 1080 x 1350 post frame; at 4:3 there is
 * nothing to force.
 *
 * NOTHING IS PERSISTED HERE. Four hosted files and no record of them anywhere: the screen shows
 * them, and blessing one registers THAT one through the library's own add route and saves it onto
 * the narrative through ./state. Same discipline as the slide routes: a rejected hero leaves no
 * litter in the library and no half-state on the narrative.
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
import { mirrorImageToHost } from '@/lib/marketing/image-host';
import { HERO_BATCH, HERO_SIZE } from '@/lib/marketing/hero';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/** A Higgsfield generation polls for up to 240s, and four copies into the bucket follow it. */
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
    width_and_height: HERO_SIZE,
    quality: '1080p',
    batch_size: HERO_BATCH,
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
   * ALL OF THEM AT ONCE, and a failure loses one candidate rather than the batch. Sequentially
   * this would be four round trips added to a generation he has already waited minutes for, and
   * they are independent: nothing about copying the second file depends on the first.
   */
  const origin = new URL(req.url).origin;
  const hosted = await Promise.all(
    res.urls.slice(0, HERO_BATCH).map(async (u) => {
      const out = await mirrorImageToHost(u, { stream: narrative.lane, requestOrigin: origin });
      if ('error' in out) {
        console.error(`[hero] could not store a candidate: ${out.error}`);
        return null;
      }
      return out.url;
    })
  );
  const urls = hosted.filter((u): u is string => Boolean(u));

  /**
   * Every copy failed, so the generation is spent and there is nothing durable to show. Saying
   * WHICH half broke matters: the images exist and the storing is what did not work, and a
   * message that only says "could not make the look" sends someone reading the generation code.
   */
  if (urls.length === 0) {
    return NextResponse.json(
      { error: 'The images were generated but none of them could be stored. Try again.' },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, urls, prompt: body.prompt.trim() });
}
