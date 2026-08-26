/**
 * POST /console/marketing/stream/[stream]/media/upload-url
 *
 * Hand the browser a short-lived url it can PUT one file to, plus the public url that file will
 * have once it is there (D65).
 *
 * Marrs's todo calls this "the last hard gap between Gate 4 and a published post": a media asset is
 * a url reference only, so getting a picture into the library meant hosting it somewhere else and
 * pasting the link.
 *
 * TWO STEPS AND THE SERVER OWNS THE KEY. This route decides the filename, because the filename is
 * the whole security surface: it is a fresh uuid, so nothing a caller sends can walk the path,
 * collide with an existing object, or make the serving route emit something unexpected. The
 * browser's file name is used for the LABEL only, which is text.
 *
 * NOTHING IS REGISTERED HERE. The upload lands in the bucket and the caller then registers it
 * through the library's own /add route, exactly as a generated image does. So a failed or abandoned
 * upload leaves bytes nobody points at, and never a library entry pointing at nothing, which is the
 * discipline every other route in this feature already follows.
 *
 * Team scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { isStreamId } from '@/lib/marketing/streams';
import { isBucketConfigured, presignPut } from '@/lib/agents/bucket';
import { generatedImageKey, hostOrigin } from '@/lib/marketing/image-host';
import { checkUpload, MAX_UPLOAD_BYTES } from '@/lib/marketing/media-upload';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  contentType: z.string().trim().min(3).max(100),
  /** Checked against the same cap the browser checked, because the browser cannot be trusted. */
  bytes: z.number().int().positive().max(MAX_UPLOAD_BYTES * 4),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ stream: string }> }
) {
  const { stream } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!isStreamId(stream)) {
    return NextResponse.json({ error: 'unknown stream' }, { status: 400 });
  }
  if (!isBucketConfigured()) {
    return NextResponse.json(
      { error: 'File storage is not configured, so uploads are off. Paste a Box link instead.' },
      { status: 503 }
    );
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  /**
   * The same check the browser ran, run again. Not belt and braces: the browser's copy exists to
   * say no before a 40MB file is read, and this one exists because a request can be made without a
   * browser at all.
   */
  const check = checkUpload(body.contentType, body.bytes);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  const file = `${randomUUID()}.${check.ext}`;
  const key = generatedImageKey(stream, file);

  let uploadUrl: string;
  try {
    uploadUrl = await presignPut(key, body.contentType.toLowerCase().split(';')[0].trim());
  } catch (err) {
    console.error('[media.upload-url] presign failed:', err);
    return NextResponse.json({ error: 'Could not start the upload. Try again.' }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    uploadUrl,
    /**
     * Where it will be readable once the PUT lands. Built from the request's own origin so the url
     * is right on localhost, on a preview and in production, which is the same reason
     * hostGeneratedImage takes a requestOrigin.
     */
    url: `${hostOrigin(new URL(req.url).origin)}/console/generated/${stream}/${file}`,
    /** Echoed back so the browser sends exactly what the signature committed to. */
    contentType: body.contentType.toLowerCase().split(';')[0].trim(),
  });
}
