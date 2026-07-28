/**
 * POST /console/marketing/stream/[stream]/media/move — move library assets to
 * another stream.
 *
 * Built because uploading to the wrong library is an easy mistake with an expensive
 * manual fix (delete everything, re-upload it all in the right place). It does not need
 * to be expensive: under D27 an asset is a REFERENCE plus light metadata, so the file in
 * Box never moves and the "move" is one small JSON record changing its storage key.
 *
 * The order is deliberate: WRITE to the target, then DELETE the source. There is no
 * transaction across two keys, so one of the two has to be able to fail second, and a
 * duplicate the operator can see and remove is a far better outcome than an asset that
 * exists in neither library. Each id is independent, so a partial batch reports exactly
 * which ones moved.
 *
 * Two things a move deliberately does NOT touch, both checked before building this:
 *  - Soul IDs. They live on the Higgsfield account rather than in a stream, and they were
 *    trained on the asset's URL, which a move does not change. Moving a person's photos
 *    cannot orphan their Soul ID.
 *  - The file itself. Box keeps serving it from the same link.
 *
 * The one live consequence: a piece or calendar entry in the SOURCE stream that has this
 * asset attached loses it, because `resolveMediaUrls` is scoped by stream and drops ids it
 * cannot find. That degrades quietly rather than breaking, and it is the right trade for
 * the case this exists to fix (a batch uploaded to the wrong library, attached to
 * nothing). If moving attached media becomes normal, this should warn first.
 *
 * Team-scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { isStreamId, STREAM_IDS, streamLabel } from '@/lib/marketing/streams';
import {
  getMediaAsset,
  saveMediaAsset,
  deleteMediaAsset,
} from '@/lib/marketing/media-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  media_ids: z.array(z.string().trim().min(1).max(200)).min(1).max(200),
  target_stream: z.enum(STREAM_IDS),
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

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }
  if (body.target_stream === stream) {
    return NextResponse.json(
      { error: 'That is already this library.' },
      { status: 400 }
    );
  }

  const moved: string[] = [];
  const failed: string[] = [];
  const now = new Date().toISOString();

  for (const id of body.media_ids) {
    try {
      const asset = await getMediaAsset(stream, id);
      if (!asset) {
        failed.push(id);
        continue;
      }
      await saveMediaAsset({
        ...asset,
        stream: body.target_stream,
        updated_at: now,
      });
      // Only now is it safe to drop the original: the asset exists in both places for
      // this instant, never in neither.
      await deleteMediaAsset(stream, id);
      moved.push(id);
    } catch (err) {
      console.error(`[media.move] ${id} -> ${body.target_stream} failed:`, err);
      failed.push(id);
    }
  }

  if (moved.length === 0) {
    return NextResponse.json(
      { error: 'Could not move those. Nothing was changed.' },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    moved,
    failed,
    target: body.target_stream,
    message:
      failed.length === 0
        ? `Moved ${moved.length} to ${streamLabel(body.target_stream)}.`
        : `Moved ${moved.length} to ${streamLabel(body.target_stream)}. ${failed.length} could not be moved.`,
  });
}
