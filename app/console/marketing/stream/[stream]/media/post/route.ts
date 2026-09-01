/**
 * POST /console/marketing/stream/[stream]/media/post — THE DOOR FOR WORK THAT IS ALREADY FINISHED
 * (D80).
 *
 * Marrs: "I recorded that video. It's edited. I've got three versions of it, and I'm not sure how to
 * post it using the console, which is an issue."
 *
 * He was right that there was no way in, and the reason is worth stating plainly: every route into
 * the calendar started from a Story. The console could make a video and it could publish one it had
 * made, and it had nothing to say to a finished file.
 *
 * THIS IS NOT A NEW PIPELINE. It is the same construction the podcast clip already does
 * (podcast/[id]/clip/render/route.ts), whose own header says it best: the clip becomes an ordinary
 * MARKETING PIECE with an ordinary MEDIA ASSET attached, so the calendar and the Metricool tail need
 * no knowledge of podcasts at all. The same is true of an edited video, and the only reason it could
 * not use that route is that it is gated on a Descript project.
 *
 * SO THE DOOR IS ONE BUTTON ON THE ASSET, not a new screen. The operator is already in the media
 * library, because a Box direct link is the only way a video gets into this console (video upload is
 * refused with that reason, media-upload.ts). Posting it starts where it already is, and three cuts
 * is three presses rather than one form filled in three times.
 *
 * IDEMPOTENT PER ASSET. Pressing it twice reopens the same piece rather than making a second one.
 * Two pieces carrying the same file is the specific failure that would be invisible: they would
 * become two sets of calendar entries and the same video would go out twice.
 *
 * Team scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { isStreamId } from '@/lib/marketing/streams';
import { getMediaAsset } from '@/lib/marketing/media-store';
import { listSavedPieces, savePiece, type MarketingPiece } from '@/lib/marketing/piece-store';
import { FINISHED_MEDIA_FORMAT, finishedMediaPieceFor } from '@/lib/marketing/finished-media';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({ media_id: z.string().trim().min(1).max(200) });

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

  const asset = await getMediaAsset(stream, body.media_id).catch((err) => {
    console.error('[media.post] asset read failed:', err);
    return null;
  });
  if (!asset) {
    return NextResponse.json({ error: 'that file is not in this library' }, { status: 404 });
  }

  /**
   * REUSE BEFORE CREATE. A read failure here is NOT fatal: the worst case is a second piece for the
   * same file, which is a duplicate the operator can see and delete, while refusing to open the door
   * because a list read hiccuped would leave him with no way in at all.
   */
  let existing: MarketingPiece[] = [];
  try {
    existing = await listSavedPieces(user.email);
  } catch (err) {
    console.error('[media.post] piece list failed, may create a duplicate:', err);
  }
  const prior = existing.find(
    (p) =>
      p.stream === stream &&
      p.format === FINISHED_MEDIA_FORMAT &&
      !p.narrative_ref &&
      (p.media ?? []).includes(asset.media_id)
  );
  if (prior) {
    return NextResponse.json({ piece_id: prior.piece_id, reused: true });
  }

  const piece = finishedMediaPieceFor({
    piece_id: randomUUID(),
    owner: user.email,
    stream,
    label: asset.label,
    media_id: asset.media_id,
  });
  try {
    await savePiece(user.email, piece);
  } catch (err) {
    console.error('[media.post] piece write failed:', err);
    return NextResponse.json({ error: 'could not start the post' }, { status: 500 });
  }
  return NextResponse.json({ piece_id: piece.piece_id, reused: false });
}
