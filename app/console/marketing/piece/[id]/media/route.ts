/**
 * GET /console/marketing/piece/[id]/media — the media assets a piece can attach:
 * its OWN stream's library. The stream is taken from the loaded piece when it has
 * been saved; for an unsaved seed piece it falls back to a validated ?stream=
 * query param (team users can read any stream's library, so this is not a
 * privilege boundary, just which library to show). Team-scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/console-auth';
import { getPiece } from '@/lib/marketing/piece-store';
import { listMediaForStream } from '@/lib/marketing/media-store';
import { isStreamId } from '@/lib/marketing/streams';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let stream: string | null = null;
  try {
    const piece = await getPiece(user.email, id);
    if (piece) stream = piece.stream;
  } catch (err) {
    console.error('[piece.media] piece read failed:', err);
  }
  if (!stream) {
    const q = req.nextUrl.searchParams.get('stream');
    if (q && isStreamId(q)) stream = q;
  }
  if (!stream || !isStreamId(stream)) {
    return NextResponse.json({ error: 'unknown stream' }, { status: 400 });
  }

  try {
    const media = await listMediaForStream(stream);
    return NextResponse.json({ media });
  } catch (err) {
    console.error('[piece.media] media list failed:', err);
    return NextResponse.json({ error: 'could not list media' }, { status: 500 });
  }
}
