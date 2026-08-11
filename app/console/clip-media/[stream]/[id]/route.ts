/**
 * SERVE a rendered clip, publicly.
 *
 * WHY THIS EXISTS AND WHY IT IS UNAUTHENTICATED. `lib/marketing/publish.ts` notes that "Metricool
 * fetches by URL", and it fetches at PUBLISH time, which can be days after a post was scheduled.
 * Descript's own download url is a signed link that expires, so handing that to Metricool produces a
 * post that dies quietly between scheduling and going out. So the file is copied into our own private
 * bucket and served from here.
 *
 * It has to be reachable without a session, because the thing fetching it is Metricool's server. This
 * is the same deliberate choice as the unlisted prezie URLs (D31): a route handler under /console
 * bypasses the sign-in layout. The id is a uuid, so the url is unguessable, and the only thing behind
 * it is a clip of a podcast that is about to be published anyway.
 *
 * Nothing here trusts the path: both segments are checked against a strict pattern before they are used
 * to build a key, so this cannot be walked into another part of the bucket.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getObjectBytes, isBucketConfigured } from '@/lib/agents/bucket';
import { clipMediaKey } from '@/lib/marketing/podcast-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** A single safe path segment. Anything with a slash, a dot or a wildcard in it is refused. */
const SAFE = /^[A-Za-z0-9_-]{1,80}$/;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ stream: string; id: string }> }
) {
  const { stream, id } = await params;
  if (!SAFE.test(stream) || !SAFE.test(id)) {
    return new NextResponse('not found', { status: 404 });
  }
  if (!isBucketConfigured()) {
    return new NextResponse('storage not configured', { status: 503 });
  }

  let object;
  try {
    object = await getObjectBytes(clipMediaKey(stream, id));
  } catch (err) {
    console.error('[clip-media] read failed:', err);
    return new NextResponse('unavailable', { status: 502 });
  }
  if (!object) return new NextResponse('not found', { status: 404 });

  return new NextResponse(object.bytes as unknown as BodyInit, {
    headers: {
      'content-type': object.contentType,
      'content-length': String(object.length),
      // A rendered clip never changes under the same id, so it can be cached hard.
      'cache-control': 'public, max-age=31536000, immutable',
      // Metricool needs to fetch this from its own servers.
      'access-control-allow-origin': '*',
    },
  });
}
