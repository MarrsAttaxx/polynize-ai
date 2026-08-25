/**
 * POST /console/marketing/piece/[id]/slides
 *
 * April writes the slide narrative for an image piece: the visual world, the caption, and
 * one headline plus one background prompt per slide. Ten for a carousel, one for a card.
 *
 * Nothing is persisted here. The screen shows the plan, the operator runs it slide by
 * slide, and it goes back through the existing /state autosave, so there stays one
 * validated write path onto a piece (same discipline as the hooks route). Team-scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/console-auth';
import { getPiece } from '@/lib/marketing/piece-store';
import { DraftError, scriptModelInUse } from '@/lib/marketing/draft';
import { proposeSlidePlan } from '@/lib/marketing/slide-propose';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

/** A steer is a note, not a document. Capped so it cannot crowd out the source. */
const MAX_STEER = 4000;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const owner = user.email;

  let steer = '';
  const body = (await req.json().catch(() => null)) as { steer?: unknown } | null;
  if (body && typeof body.steer === 'string') steer = body.steer.slice(0, MAX_STEER);

  let piece;
  try {
    piece = await getPiece(owner, id);
  } catch (err) {
    console.error('[slides] piece read failed:', err);
    return NextResponse.json({ error: 'could not read the piece' }, { status: 502 });
  }
  if (!piece) return NextResponse.json({ error: 'piece not found' }, { status: 404 });

  try {
    const plan = await proposeSlidePlan(owner, piece, steer);
    return NextResponse.json({ plan, model: scriptModelInUse() });
  } catch (e) {
    if (e instanceof DraftError) {
      if (e.reason === 'no-concept') {
        return NextResponse.json(
          { error: 'No article to work from. Re-confirm this narrative at gate 3.' },
          { status: 400 }
        );
      }
      if (e.reason === 'empty') {
        return NextResponse.json(
          { error: 'The slides came back empty or malformed. Try again.' },
          { status: 502 }
        );
      }
    }
    return NextResponse.json(
      { error: 'The writing assistant is unavailable right now. Try again in a moment.' },
      { status: 502 }
    );
  }
}
