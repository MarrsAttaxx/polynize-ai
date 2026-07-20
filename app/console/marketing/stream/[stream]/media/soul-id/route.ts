/**
 * POST /console/marketing/stream/[stream]/media/soul-id — train a reusable Soul
 * ID (a person's identity) from reference photo URLs, so Soul generations can hold
 * that person consistent. The photos are provided as public URLs (e.g. the stream's
 * own library images). Team-scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { isStreamId } from '@/lib/marketing/streams';
import { isHiggsfieldConfigured, createSoulIdentity } from '@/lib/marketing/higgsfield';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const BodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  imageUrls: z.array(z.string().url().max(2000)).min(1).max(30),
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
  if (!isHiggsfieldConfigured()) {
    return NextResponse.json(
      { error: 'Image generation is not configured (Higgsfield keys missing).' },
      { status: 400 }
    );
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  try {
    const soul = await createSoulIdentity(body.name, body.imageUrls);
    return NextResponse.json({ ok: true, soul });
  } catch (err) {
    console.error('[media.soul-id] create failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'could not create the Soul ID' },
      { status: 502 }
    );
  }
}
