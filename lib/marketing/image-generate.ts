/**
 * ONE WAY TO MAKE AN IMAGE (D62), whichever model is asked for.
 *
 * Three routes generate images: the narrative hero, a carousel slide, and the media library. Each
 * one used to call `generateImages` directly, which is Higgsfield-only, so adding a model on a
 * different provider would have meant three copies of the same branch and three chances to get
 * one of them wrong. This is the one place that knows there is more than one provider.
 *
 * IT ALWAYS RETURNS URLS WE HOST. That folds in the fix from D60, where the media library was the
 * one route still handing back a raw vendor url, and makes it structural rather than remembered: a
 * caller cannot get an ephemeral url out of this function, so it cannot register one.
 *
 * THE TWO PROVIDERS ARE NOT ONE SHAPE, and pretending otherwise is how the frame gets lost:
 *
 * - Higgsfield takes an exact `width_and_height` from a 13 value allow-list plus a `batch_size`,
 *   so N candidates cost one request and the size is guaranteed by the API.
 * - OpenRouter's Gemini image models expose NO dimension parameter at all (verified against their
 *   public model list). So the aspect is asked for in words, the frame is enforced afterwards by
 *   cropping, and N candidates cost N requests.
 *
 * Server-side only. Never throws.
 */

import { generateImages } from './higgsfield';
import { generateOpenRouterImage, bytesFromDataUri } from './openrouter-image';
import { hostGeneratedImage, mirrorImageToHost } from './image-host';
import { renderAndHostOverlay } from './text-overlay';
import { providerOf, type ImageModel } from './higgsfield-models';

export type GenerateSpec = {
  prompt: string;
  /** How many candidates to come back with. */
  count: number;
  /**
   * The output frame, in pixels. Guaranteed on both providers: Higgsfield is asked for the nearest
   * native size it allows, and an OpenRouter result is cropped to exactly this.
   */
  frame: { w: number; h: number };
  /** The style reference, when there is one. Both providers accept one. */
  referenceUrl?: string;
  /** Higgsfield only: a trained identity and a Soul style. Ignored elsewhere. */
  soulId?: string;
  styleId?: string;
};

export type GenerateOut = { urls: string[]; error?: string };
export type HostOpts = { stream: string; requestOrigin?: string };

/**
 * Soul's own allow-list, all 13 of them, not the five the console offers in its picker. Written
 * here as pairs because this has to pick the nearest one by SHAPE, and a string cannot be compared.
 */
const SOUL_SIZES: { id: string; w: number; h: number }[] = [
  { id: '2048x1152', w: 2048, h: 1152 },
  { id: '2048x1536', w: 2048, h: 1536 },
  { id: '2016x1344', w: 2016, h: 1344 },
  { id: '1696x960', w: 1696, h: 960 },
  { id: '1632x1088', w: 1632, h: 1088 },
  { id: '1536x1536', w: 1536, h: 1536 },
  { id: '1536x1152', w: 1536, h: 1152 },
  { id: '1152x1536', w: 1152, h: 1536 },
  { id: '1536x2048', w: 1536, h: 2048 },
  { id: '1152x2048', w: 1152, h: 2048 },
  { id: '1344x2016', w: 1344, h: 2016 },
  { id: '1088x1632', w: 1088, h: 1632 },
  { id: '960x1696', w: 960, h: 1696 },
];

/**
 * The Soul size whose ASPECT is closest to the frame asked for, biggest first on a tie.
 *
 * Closest by aspect rather than by pixel count, because the shape is what the frame is for: a
 * caller asking for 4:3 would rather have a bigger 4:3 than a same-sized 16:9 it has to crop hard.
 * The API rejects anything not on this list, which is why it cannot simply be handed w and h.
 */
export function nearestSoulSize(frame: { w: number; h: number }): string {
  const want = frame.w / frame.h;
  let best = SOUL_SIZES[0];
  let bestGap = Infinity;
  for (const s of SOUL_SIZES) {
    const gap = Math.abs(s.w / s.h - want);
    if (gap < bestGap - 1e-9 || (Math.abs(gap - bestGap) < 1e-9 && s.w * s.h > best.w * best.h)) {
      best = s;
      bestGap = gap;
    }
  }
  return best.id;
}

/**
 * The aspect, in words, for a provider that has no parameter for it.
 *
 * Both the ratio and the orientation, because a model given only "4:3" has been known to read it
 * as the shape and not the direction, and repeated at the END of the prompt because a long prompt
 * loses its opening instructions first.
 */
export function aspectSentence(frame: { w: number; h: number }): string {
  const r = frame.w / frame.h;
  const name =
    Math.abs(r - 1) < 0.02
      ? 'a square 1:1'
      : Math.abs(r - 4 / 3) < 0.03
        ? 'a landscape 4:3'
        : Math.abs(r - 3 / 4) < 0.03
          ? 'a portrait 3:4'
          : Math.abs(r - 16 / 9) < 0.04
            ? 'a wide landscape 16:9'
            : Math.abs(r - 9 / 16) < 0.04
              ? 'a tall vertical 9:16'
              : Math.abs(r - 4 / 5) < 0.03
                ? 'a portrait 4:5'
                : r > 1
                  ? 'a landscape'
                  : 'a portrait';
  return `Compose it as ${name} image, ${frame.w} by ${frame.h}, filling the whole frame.`;
}

/**
 * THE FRAME A CALLER MEANT, from whichever control its screen offers.
 *
 * The media library asks for a size on a Soul model and an aspect ratio on the others, because
 * those are the two shapes the providers used to take. The dispatcher wants pixels, so this is the
 * one place that converts, and it defaults to Soul's own default rather than to a square: a
 * request with neither is the old behaviour, not a new one.
 */
export function frameFor(
  model: ImageModel,
  size?: string,
  aspectRatio?: string
): { w: number; h: number } {
  const wh = (size ?? '').match(/^(\d{3,4})x(\d{3,4})$/);
  if (wh) return { w: Number(wh[1]), h: Number(wh[2]) };

  const ar = (aspectRatio ?? '').match(/^(\d{1,2}):(\d{1,2})$/);
  if (ar) {
    const rw = Number(ar[1]);
    const rh = Number(ar[2]);
    if (rw > 0 && rh > 0) {
      // Scaled so the long edge is 2048, which is the largest edge Soul offers and a sane ceiling
      // for a provider with no size parameter at all.
      const scale = 2048 / Math.max(rw, rh);
      return { w: Math.round(rw * scale), h: Math.round(rh * scale) };
    }
  }
  // Soul's own default in this console, so a caller that sends nothing keeps what it always got.
  return { w: 1152, h: 2048 };
}

export async function generateHostedImages(
  model: ImageModel,
  spec: GenerateSpec,
  host: HostOpts
): Promise<GenerateOut> {
  const count = Math.max(1, Math.min(8, Math.floor(spec.count)));
  return providerOf(model) === 'openrouter'
    ? viaOpenRouter(model, { ...spec, count }, host)
    : viaHiggsfield(model, { ...spec, count }, host);
}

/** One request for the whole batch, then a byte-for-byte copy of each result into our bucket. */
async function viaHiggsfield(
  model: ImageModel,
  spec: GenerateSpec,
  host: HostOpts
): Promise<GenerateOut> {
  const input: Record<string, unknown> = {
    prompt: spec.prompt,
    width_and_height: nearestSoulSize(spec.frame),
    quality: '1080p',
    /** Soul's BatchSize is exactly {1, 4}, so anything else is a 400. */
    batch_size: spec.count > 1 ? 4 : 1,
  };
  if (model.supportsSoulId && spec.soulId) input.custom_reference_id = spec.soulId;
  if (model.supportsStyle && spec.styleId) input.style_id = spec.styleId;
  if (model.supportsReferenceImage && spec.referenceUrl) {
    input.image_reference = { type: 'image_url', image_url: spec.referenceUrl };
  }

  const res = await generateImages(model.endpoint, input);
  if (res.status !== 'completed' || res.urls.length === 0) {
    return {
      urls: [],
      error:
        res.status === 'nsfw'
          ? 'That prompt was refused by the image model. Reword it and try again.'
          : (res.error ?? `Generation returned no image (status: ${res.status}).`),
    };
  }

  const hosted = await Promise.all(
    res.urls.slice(0, spec.count).map(async (u) => {
      const out = await mirrorImageToHost(u, host);
      if ('error' in out) {
        console.error(`[image-generate] could not store a result: ${out.error}`);
        return null;
      }
      return out.url;
    })
  );
  return finish(hosted);
}

/**
 * One request per image, all at once, then a crop to the exact frame.
 *
 * The crop is what makes the frame a guarantee rather than a request on a provider with no size
 * parameter. It goes through the overlay compositor with EMPTY text, which is the crop-to-frame
 * path already in production on the media library's overlay route: it forces the canvas to exactly
 * w by h with the source object-fit cover. So what is judged on screen is what is stored, which is
 * the promise D56 made when it stopped cropping the hero.
 */
async function viaOpenRouter(
  model: ImageModel,
  spec: GenerateSpec,
  host: HostOpts
): Promise<GenerateOut> {
  const prompt = `${spec.prompt} ${aspectSentence(spec.frame)}`;
  const errors: string[] = [];

  const results = await Promise.all(
    Array.from({ length: spec.count }, async () => {
      const gen = await generateOpenRouterImage(model.endpoint, prompt, {
        referenceUrl: model.supportsReferenceImage ? spec.referenceUrl : undefined,
      });
      if (gen.error || !gen.dataUri) {
        if (gen.error) errors.push(gen.error);
        return null;
      }
      const parts = bytesFromDataUri(gen.dataUri);
      if (!parts) {
        errors.push('The model returned an image in a format we cannot store.');
        return null;
      }

      // Stored first, because the compositor takes a url rather than bytes, and because a crop
      // that fails should not also lose the generation.
      const raw = await hostGeneratedImage(parts.bytes, parts.mime, host);
      if ('error' in raw) {
        errors.push(raw.error);
        return null;
      }
      const framed = await renderAndHostOverlay(
        raw.url,
        {
          text: '',
          position: 'centre',
          hAlign: 'centre',
          size: 'medium',
          baseColor: '#ffffff',
          highlightColor: '#69fccb',
          frame: spec.frame,
        },
        host
      );
      // A failed crop keeps the uncropped image rather than throwing the generation away: the
      // wrong aspect is a smaller problem than nothing at all.
      if (framed.error || !framed.url) {
        console.error(`[image-generate] crop failed, keeping the raw size: ${framed.error}`);
        return raw.url;
      }
      return framed.url;
    })
  );

  const out = finish(results);
  // Every one failed, so the reason the model gave is the useful thing to say.
  if (out.urls.length === 0 && errors.length > 0) return { urls: [], error: errors[0] };
  return out;
}

function finish(list: (string | null)[]): GenerateOut {
  const urls = list.filter((u): u is string => Boolean(u));
  if (urls.length === 0) {
    return { urls: [], error: 'The images were generated but none of them could be stored.' };
  }
  return { urls };
}
