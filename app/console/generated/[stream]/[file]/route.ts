/**
 * SERVE a generated image (an AI edit, or a brand text overlay), publicly.
 *
 * Unauthenticated on purpose, and for two named readers rather than for people: Metricool
 * fetches attached media by url at PUBLISH time, which can be days after scheduling, and
 * Higgsfield fetches an image by url when it is fed back in as an edit source or a Soul-ID
 * input. Neither has a session. Same deliberate choice as the unlisted prezie urls (D31)
 * and the clip media route: a route handler under /console bypasses the sign-in layout.
 *
 * The filename is a uuid, so the url is unguessable.
 *
 * Nothing here trusts the path. Both segments are matched against anchored patterns before
 * they build a key, so a `..` or a slash cannot walk this into another part of the bucket,
 * and the extension is checked against a fixed list rather than echoed into a header.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getObjectBytes, isBucketConfigured } from '@/lib/agents/bucket';
import { contentTypeForFile, generatedImageKey } from '@/lib/marketing/image-host';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SAFE_STREAM = /^[a-z0-9_-]{1,40}$/;
/** One uuid-ish name, one dot, one known extension. Anchored, so nothing else fits. */
const SAFE_FILE = /^[A-Za-z0-9_-]{1,80}\.(png|jpe?g|webp)$/;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ stream: string; file: string }> }
) {
  const { stream, file } = await params;
  if (!SAFE_STREAM.test(stream) || !SAFE_FILE.test(file)) {
    return new NextResponse('not found', { status: 404 });
  }
  const contentType = contentTypeForFile(file);
  if (!contentType) return new NextResponse('not found', { status: 404 });

  if (!isBucketConfigured()) {
    return new NextResponse('not configured', { status: 503 });
  }

  let obj: { bytes: Uint8Array; contentType?: string } | null = null;
  try {
    obj = await getObjectBytes(generatedImageKey(stream, file));
  } catch (err) {
    console.error(`[generated] read failed for ${stream}/${file}:`, err);
    return new NextResponse('unavailable', { status: 502 });
  }
  if (!obj) return new NextResponse('not found', { status: 404 });

  /**
   * Prefer what the bucket recorded on the way in over what the filename implies, but only
   * if it is one of the types we agreed to serve. That way a stored content type cannot be
   * used to make this route emit something it should not, and the extension stays as the
   * fallback.
   */
  const stored = obj.contentType ? contentTypeForFile(`x.${obj.contentType.split('/')[1] ?? ''}`) : null;

  return new NextResponse(Buffer.from(obj.bytes), {
    headers: {
      'content-type': stored ?? contentType,
      'content-length': String(obj.bytes.byteLength),
      // The name is a uuid and the bytes never change under it, so this can be cached hard.
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
