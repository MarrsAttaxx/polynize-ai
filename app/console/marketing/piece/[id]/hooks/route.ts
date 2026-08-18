/**
 * POST /console/marketing/piece/[id]/hooks — stage one of the staged build (D39).
 *
 * April reports what is usable in the concept, then proposes six candidate hooks for the
 * operator to choose from. Nothing is persisted here: the client shows the proposal, the
 * operator picks and edits, and the chosen hooks go back through the existing /state autosave,
 * so there stays one validated write path onto a piece.
 *
 * Replaces the one-shot angle box for video. The optional `steer` in the body is what remains
 * of the angle, demoted to one input among several; lines supplied there survive verbatim.
 * Team-scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/console-auth';
import { getPiece } from '@/lib/marketing/piece-store';
import { proposeHooks, DraftError, scriptModelInUse } from '@/lib/marketing/draft';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/** A steer is a note, not a document. Capped so it cannot crowd out the concept. */
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
  try {
    const body = (await req.json().catch(() => null)) as { steer?: unknown } | null;
    if (body && typeof body.steer === 'string') steer = body.steer.slice(0, MAX_STEER);
  } catch {
    /* no body is fine: a steer is optional */
  }

  let piece;
  try {
    piece = await getPiece(owner, id);
  } catch (err) {
    console.error('[hooks] piece read failed:', err);
    return NextResponse.json({ error: 'could not read the piece' }, { status: 502 });
  }
  if (!piece) return NextResponse.json({ error: 'piece not found' }, { status: 404 });

  try {
    const proposal = await proposeHooks(owner, piece, steer);
    return NextResponse.json({ ...proposal, model: scriptModelInUse() });
  } catch (e) {
    if (e instanceof DraftError) {
      if (e.reason === 'no-concept') {
        return NextResponse.json(
          { error: 'no concept to work from. Re-plan this output from a concept.' },
          { status: 400 }
        );
      }
      if (e.reason === 'empty') {
        return NextResponse.json(
          { error: 'the hooks came back empty or malformed. Try again.' },
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
