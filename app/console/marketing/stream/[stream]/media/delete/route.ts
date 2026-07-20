/**
 * POST /console/marketing/stream/[stream]/media/delete — remove a media asset
 * from this stream's library. This drops the REFERENCE only; the file in Box (or
 * wherever it is hosted) is untouched. Team-scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/console-auth';
import { isStreamId } from '@/lib/marketing/streams';
import { deleteMediaAsset } from '@/lib/marketing/media-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({ media_id: z.string().trim().min(1).max(120) });

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

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  try {
    await deleteMediaAsset(stream, body.media_id);
  } catch (err) {
    console.error('[media.delete] failed:', err);
    return NextResponse.json({ error: 'could not delete the media asset' }, { status: 500 });
  }
  revalidatePath(`/console/marketing/stream/${stream}`);
  return NextResponse.json({ ok: true });
}
