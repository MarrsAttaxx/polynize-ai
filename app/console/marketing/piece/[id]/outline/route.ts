/**
 * POST /console/marketing/piece/[id]/outline — stage two of the staged build (D39).
 *
 * Given the hooks the operator already agreed, April proposes the narrative arc: the beats, what
 * each one argues, and the concept material each one stands on. That last part is the point of
 * the stage. It is the first time her selection from the concept is visible before a script
 * exists, which is where it is cheap to correct.
 *
 * Requires `hooks` on the piece: the arc has to hand over cleanly to every agreed hook, so
 * proposing one before they are chosen would be guessing at its own entry point. Nothing is
 * persisted here; the edited arc returns through /state. Team-scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/console-auth';
import { getPiece } from '@/lib/marketing/piece-store';
import { proposeOutline, DraftError, scriptModelInUse } from '@/lib/marketing/draft';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const owner = user.email;

  let piece;
  try {
    piece = await getPiece(owner, id);
  } catch (err) {
    console.error('[outline] piece read failed:', err);
    return NextResponse.json({ error: 'could not read the piece' }, { status: 502 });
  }
  if (!piece) return NextResponse.json({ error: 'piece not found' }, { status: 404 });

  try {
    const outline = await proposeOutline(owner, piece);
    return NextResponse.json({ outline, model: scriptModelInUse() });
  } catch (e) {
    if (e instanceof DraftError) {
      if (e.reason === 'no-concept') {
        return NextResponse.json(
          { error: 'no concept to work from. Re-plan this output from a concept.' },
          { status: 400 }
        );
      }
      if (e.reason === 'no-hooks') {
        return NextResponse.json(
          { error: 'choose the hooks first: the arc has to hand over to them.' },
          { status: 400 }
        );
      }
      if (e.reason === 'empty') {
        return NextResponse.json(
          { error: 'the arc came back empty. Try again.' },
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
