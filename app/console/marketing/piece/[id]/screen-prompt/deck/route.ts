/**
 * POST /console/marketing/piece/[id]/screen-prompt/deck — BUILD THE DECK (D29): April
 * composes the touchscreen deck's states from the locked script, the agreed Screen
 * Prompt and the operator's direction, and it is saved so the unlisted deck URL serves
 * it. Replaces the external animator handoff.
 *
 * Team-scope only. Returns the deck URL + state count for the client to show.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { getPiece } from '@/lib/marketing/piece-store';
import { generateDeck } from '@/lib/marketing/deck-generate';
import { saveDeck } from '@/lib/marketing/deck-store';
import { DraftError } from '@/lib/marketing/draft';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const BodySchema = z.object({ direction: z.string().max(6000).optional() });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse((await req.json().catch(() => ({}))) ?? {});
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  let piece;
  try {
    piece = await getPiece(user.email, id);
  } catch (err) {
    console.error('[deck.build] piece read failed:', err);
    return NextResponse.json({ error: 'could not read the piece' }, { status: 502 });
  }
  if (!piece) return NextResponse.json({ error: 'piece not found' }, { status: 404 });

  try {
    const deck = await generateDeck(user.email, piece, body.direction ?? '');
    await saveDeck(id, deck);
    return NextResponse.json({
      ok: true,
      // The label + cue of each state, so the client can offer per-state revision
      // straight away. The html stays server-side; the client previews the real page.
      states: deck.states.map((st) => ({ label: st.label, cue: st.cue ?? '' })),
      note: deck.note,
      url: `/console/deck/${id}`,
    });
  } catch (e) {
    if (e instanceof DraftError && e.reason === 'no-concept') {
      return NextResponse.json(
        { error: 'Write the script first. The deck is built from it.' },
        { status: 400 }
      );
    }
    if (e instanceof DraftError && e.reason === 'empty') {
      return NextResponse.json(
        { error: 'The deck came back unusable. Try again, or give more direction.' },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: 'April is unavailable right now. Try again in a moment.' },
      { status: 502 }
    );
  }
}
