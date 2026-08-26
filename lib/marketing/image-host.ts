import { randomUUID } from 'node:crypto';
import { isBucketConfigured, putObject } from '@/lib/agents/bucket';
import { uploadReferenceImage } from './higgsfield';

/**
 * WHERE A GENERATED IMAGE LIVES.
 *
 * Marrs, this week: "The image was created but could not be saved. Try again." and "The
 * overlay was created but could not be saved. Try again."
 *
 * Both messages came from ONE cause, `uploadReferenceImage`, which pushes bytes to
 * Higgsfield's CDN through `POST /files/generate-upload-url` and then a PUT to the
 * presigned url it hands back. Generation worked in both cases; only the hosting failed.
 *
 * THE REAL PROBLEM IS THAT IT WAS HOSTED THERE AT ALL. That endpoint exists so you can
 * hand a reference photo to a generation call. Using it as a general-purpose image host
 * means every saved image depends on an AI vendor's file service staying shaped the way it
 * is, on that account's plan continuing to allow it, and on files put there sticking
 * around. This codebase has already been bitten three times by Higgsfield endpoints
 * moving: `/v1/text2image/soul` was retired, FLUX Kontext started 404ing, and the Soul
 * body shape changed.
 *
 * So the bucket PAM already uses is now the primary host, and Higgsfield is only a
 * fallback for the case where no bucket is configured. Same arrangement as the podcast
 * clips: private bucket, served through an unauthenticated route handler under /console so
 * that Metricool (and Higgsfield, when an image is fed back in as a reference) can fetch
 * it by url.
 */

/** Extensions we will serve, mapped from the content type we were handed. */
const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
};

export function extForContentType(contentType: string): string | null {
  return EXT[contentType.toLowerCase().split(';')[0].trim()] ?? null;
}

/** Content type from a stored filename. The serving route's half of the same mapping. */
export function contentTypeForFile(file: string): string | null {
  const ext = file.toLowerCase().split('.').pop() ?? '';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  return null;
}

export function generatedImageKey(stream: string, file: string): string {
  return `pam/generated/${stream}/${file}`;
}

/**
 * The origin to build absolute urls against.
 *
 * Absolute and not relative, because these urls are handed to other people's servers:
 * Metricool fetches them at publish time and Higgsfield fetches them when an image is fed
 * back in as an edit source. A relative path is useless to both.
 *
 * Prefers the request's own origin when a caller can supply it, so previews and localhost
 * are right, and falls back to the configured console origin.
 */
export function hostOrigin(requestOrigin?: string): string {
  if (requestOrigin) return requestOrigin.replace(/\/+$/, '');
  const env = process.env.PAM_CONSOLE_ORIGIN?.trim();
  if (env) return env.replace(/\/+$/, '');
  return 'https://pam.polynize.ai';
}

/**
 * The type from the bytes themselves, for when the server that served them did not say.
 *
 * A generation CDN can hand back `application/octet-stream` or no content type at all, and
 * refusing a perfectly good JPEG because of a missing header is the kind of failure that reads
 * as "the image could not be saved" and sends someone hunting through the generation code.
 */
function sniffImageType(bytes: Buffer): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

/** 25MB. A 2048px generation is a couple of megabytes; anything near this is not one. */
const MAX_MIRROR_BYTES = 25 * 1024 * 1024;

export type HostResult = { url: string } | { error: string };

/**
 * COPY SOMEONE ELSE'S IMAGE INTO OUR BUCKET, BYTE FOR BYTE.
 *
 * A generation url is temporary. `/media/add` stores a url and nothing else, so anything
 * registered straight off a vendor CDN is a library entry that works today and 404s later. The
 * only durable move is to take the bytes.
 *
 * Byte for byte and NOT through the compositor, which is the other way to end up with a hosted
 * copy: `renderAndHostOverlay` re-encodes to PNG at a frame you give it, so it changes both the
 * file size and the aspect. That is right when the point is to compose something and wrong when
 * the point is to keep exactly what the model made.
 */
export async function mirrorImageToHost(
  sourceUrl: string,
  opts: { stream: string; requestOrigin?: string }
): Promise<HostResult> {
  let bytes: Buffer;
  let contentType: string;
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) return { error: `Could not read the generated image (${res.status}).` };
    bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0) return { error: 'The generated image came back empty.' };
    if (bytes.length > MAX_MIRROR_BYTES) {
      return { error: 'That image is too large to store.' };
    }
    const declared = (res.headers.get('content-type') ?? '').toLowerCase();
    contentType = extForContentType(declared) ? declared : (sniffImageType(bytes) ?? declared);
  } catch (e) {
    console.error('[image-host] mirror fetch failed:', e);
    return { error: 'Network error reading the generated image.' };
  }
  return hostGeneratedImage(bytes, contentType, opts);
}


/**
 * Store the bytes and return a public url for them.
 *
 * The error strings name WHAT failed rather than saying "try again", because the previous
 * message hid whether the cause was auth, a moved endpoint or a size limit, and that is
 * precisely why this went a week without being fixed.
 */
export async function hostGeneratedImage(
  bytes: Buffer,
  contentType: string,
  opts: { stream: string; requestOrigin?: string }
): Promise<HostResult> {
  const ext = extForContentType(contentType);
  if (!ext) {
    return { error: `That image came back as ${contentType}, which we do not host.` };
  }

  // The stream reaches a bucket key, so it is checked rather than trusted.
  if (!/^[a-z0-9_-]{1,40}$/.test(opts.stream)) {
    return { error: 'That stream name is not one we can store against.' };
  }

  if (isBucketConfigured()) {
    const file = `${randomUUID()}.${ext}`;
    try {
      await putObject(generatedImageKey(opts.stream, file), bytes, contentType);
      return {
        url: `${hostOrigin(opts.requestOrigin)}/console/generated/${opts.stream}/${file}`,
      };
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      console.error(`[image-host] bucket write failed: ${detail}`);
      // Falls through to Higgsfield rather than giving up: a working image saved to the
      // wrong-but-working place beats losing it.
    }
  }

  try {
    const url = await uploadReferenceImage(bytes, contentType);
    return { url };
  } catch (e) {
    /**
     * The last resort failed too, so the message has to be USEFUL. Higgsfield's SDK uses
     * axios, whose errors carry the status on `response.status` and the body on
     * `response.data`, neither of which appears in `err.message`. Reading them is the
     * difference between "could not be saved" and "Higgsfield refused with 403".
     */
    const ax = e as { response?: { status?: number; data?: unknown }; message?: string };
    const status = ax?.response?.status;
    const body =
      typeof ax?.response?.data === 'string'
        ? ax.response.data.slice(0, 200)
        : ax?.response?.data
          ? JSON.stringify(ax.response.data).slice(0, 200)
          : '';
    console.error(
      `[image-host] every host failed. bucket=${isBucketConfigured() ? 'configured' : 'NOT configured'} ` +
        `higgsfield_status=${status ?? 'none'} body=${body} message=${ax?.message ?? String(e)}`
    );
    if (!isBucketConfigured()) {
      return {
        error:
          'The image was created but there is nowhere to store it: no storage bucket is configured, and Higgsfield refused the upload' +
          (status ? ` (${status}).` : '.'),
      };
    }
    return {
      error: `The image was created but could not be stored${status ? ` (Higgsfield said ${status})` : ''}. The log has the detail.`,
    };
  }
}
