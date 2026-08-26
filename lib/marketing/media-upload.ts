/**
 * UPLOADING A FILE INTO A STREAM'S LIBRARY (D65).
 *
 * Todo item 1, the one it calls "the last hard gap between Gate 4 and a published post": a media
 * asset is a url reference only, so getting a picture into the library means hosting it somewhere
 * else first and pasting the link.
 *
 * WHY THE UPLOAD IS PRESIGNED AND NOT A POST TO OUR OWN ROUTE. Vercel caps a serverless request
 * body at 4.5MB. A phone photo clears that on its own, so a route that accepts the bytes would
 * fail on a fraction of real files with a platform error nobody can act on. A presigned PUT sends
 * the bytes from the browser straight to the bucket, so the size limit is ours to choose rather
 * than the platform's to impose.
 *
 * WHY IMAGES ONLY, AND THIS IS THE HONEST BOUNDARY. Uploading a video would work. SERVING it would
 * not: `/console/generated/[stream]/[file]` reads the whole object into memory and returns it,
 * which is right for a 2MB picture and wrong for a 500MB video, and the bucket is private so there
 * is no direct url to hand out instead. That is the actual reason this console uses Box for video,
 * and it is a bucket-policy decision rather than a code one. So a video upload is refused HERE,
 * with the reason, rather than accepted and then discovered to be unplayable.
 *
 * Pure and client-safe: the same rules have to be applied in the browser, to say no before a
 * 40MB file is read, and on the server, which cannot trust the browser's word for any of it.
 */

/** What the library can both store and serve today. */
export const UPLOAD_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

/**
 * 20MB. Comfortably above any real photograph or generated image, and below the point where the
 * serving route reading an object into memory becomes a problem.
 */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/** The types a person will try, so the refusal can name the right reason for each. */
const VIDEO_TYPES = /^video\//;
const KNOWN_DOC = /^application\/(pdf|zip)$/;

export type UploadCheck = { ok: true; ext: string } | { ok: false; error: string };

/**
 * Whether this file can be uploaded, and if not, why in words the person can act on.
 *
 * The three refusals are deliberately different messages. "Too big" is something he can fix by
 * choosing another file; "video" is a platform limit with a named workaround; an unknown type is
 * neither, and saying which types work is more useful than listing what is wrong.
 */
export function checkUpload(contentType: string, bytes: number): UploadCheck {
  const type = contentType.toLowerCase().split(';')[0].trim();

  if (VIDEO_TYPES.test(type)) {
    return {
      ok: false,
      error:
        'Video cannot be uploaded here yet. The library can store it but not serve it: our bucket is private and a video is too large to stream through the console. Put it in Box and paste the Direct Link instead.',
    };
  }

  const ext = UPLOAD_TYPES[type];
  if (!ext) {
    return {
      ok: false,
      error: KNOWN_DOC.test(type)
        ? `${type} is not something the library serves yet. Images only for now: PNG, JPEG or WebP.`
        : 'That file type is not supported. Images only for now: PNG, JPEG or WebP.',
    };
  }

  if (!Number.isFinite(bytes) || bytes <= 0) {
    return { ok: false, error: 'That file looks empty.' };
  }
  if (bytes > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `That file is ${mb(bytes)}MB. The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024}MB, so resize it or export it smaller.`,
    };
  }

  return { ok: true, ext };
}

function mb(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

/**
 * A LABEL FROM A FILENAME, so the library entry is findable later.
 *
 * The extension goes and the separators become spaces, because "brand-shoot-final-v3.jpg" is a
 * worse label than "brand shoot final v3" and a much better one than nothing. The filename is
 * NEVER used to build the stored key: that is a uuid, so a name cannot walk the path or collide.
 */
export function labelFromFilename(name: string): string {
  const base = name.replace(/\.[A-Za-z0-9]{1,8}$/, '');
  return (
    base
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 90) || 'Uploaded image'
  );
}
