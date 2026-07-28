/**
 * POST /console/marketing/piece/[id]/screen-prompt/deck/revise — change ONE state of a
 * built deck (D30), leaving the others byte-identical.
 *
 * DELETE removes a state outright, for when the answer is "that slide should not exist"
 * rather than "that slide is wrong".
 *
 * Team-scope only. Both verbs return the deck's states so the client can re-render
 * without a second read.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { getDeck, saveDeck } from '@/lib/marketing/deck-store';
import { reviseDeckState } from '@/lib/marketing/deck-revise';
import { DraftError } from '@/lib/marketing/draft';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/** Label + cue only: the client previews the real page, so it never needs the html. */
const stateList = (d: { states: { label: string; cue?: string }[] }) =>
  d.states.map((st) => ({ label: st.label, cue: st.cue ?? '' }));

const ReviseSchema = z.object({
  index: z.number().int().min(0).max(31),
  instruction: z.string().trim().min(1).max(2000),
});
const DeleteSchema = z.object({ index: z.number().int().min(0).max(31) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof ReviseSchema>;
  try {
    body = ReviseSchema.parse((await req.json().catch(() => ({}))) ?? {});
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const deck = await getDeck(id);
  if (!deck) {
    return NextResponse.json({ error: 'No deck built yet.' }, { status: 404 });
  }
  if (!deck.states[body.index]) {
    return NextResponse.json({ error: 'That state is gone. Reload the page.' }, { status: 409 });
  }

  try {
    const { deck: next, note } = await reviseDeckState(deck, body.index, body.instruction);
    await saveDeck(id, next);
    return NextResponse.json({ ok: true, note, states: stateList(next) });
  } catch (e) {
    if (e instanceof DraftError && e.reason === 'empty') {
      return NextResponse.json(
        { error: 'That came back unusable. Try saying it a different way.' },
        { status: 502 }
      );
    }
    console.error('[deck.revise] failed:', e);
    return NextResponse.json(
      { error: 'April is unavailable right now. Try again in a moment.' },
      { status: 502 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof DeleteSchema>;
  try {
    body = DeleteSchema.parse((await req.json().catch(() => ({}))) ?? {});
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const deck = await getDeck(id);
  if (!deck) return NextResponse.json({ error: 'No deck built yet.' }, { status: 404 });
  if (!deck.states[body.index]) {
    return NextResponse.json({ error: 'That state is gone. Reload the page.' }, { status: 409 });
  }
  if (deck.states.length === 1) {
    return NextResponse.json(
      { error: 'That is the only state. Rebuild the deck instead.' },
      { status: 400 }
    );
  }

  const next = { ...deck, states: deck.states.filter((_, i) => i !== body.index) };
  await saveDeck(id, next);
  return NextResponse.json({ ok: true, note: 'Removed that state.', states: stateList(next) });
}
