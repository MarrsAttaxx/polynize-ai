/**
 * POST /console/marketing/piece/[id]/text-draft — draft the post copy for a text
 * output (D23, the text module). April writes a full post from the concept +
 * script + ICP + brand voice + template recipe, in one call. The route loads the
 * piece server-side (never trusting the client for the source), returns the copy,
 * and the client applies it through the existing /state autosave, so there is a
 * single validated write path (same discipline as the Script screen chat).
 *
 * The generation itself lives in lib/marketing/draft.ts, shared with the script
 * draft and the auto-draft on template creation. Team-scope only, session-authed.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/console-auth';
import { getPiece } from '@/lib/marketing/piece-store';
import { draftTextBody, DraftError, scriptModelInUse } from '@/lib/marketing/draft';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
    console.error('[text-draft] piece read failed:', err);
    return NextResponse.json({ error: 'could not read the piece' }, { status: 502 });
  }
  if (!piece) {
    return NextResponse.json({ error: 'piece not found' }, { status: 404 });
  }

  try {
    const body = await draftTextBody(owner, piece);
    // The model rides back with the draft so the screen can say who wrote it.
    return NextResponse.json({ body, model: scriptModelInUse() });
  } catch (e) {
    if (e instanceof DraftError) {
      if (e.reason === 'no-concept') {
        return NextResponse.json(
          { error: 'no concept to draft from. Re-plan this output from a concept.' },
          { status: 400 }
        );
      }
      if (e.reason === 'empty') {
        return NextResponse.json(
          { error: 'the draft came back empty. Try again.' },
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
