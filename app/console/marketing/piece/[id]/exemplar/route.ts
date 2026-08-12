/**
 * Mark a piece as hitting the standard, or take the mark off.
 *
 *   POST { good, note? }
 *
 * A marked piece becomes a worked example in every later draft for the same stream and
 * format. That is the whole feedback loop for now: Marrs's taste is the definition of good
 * until there is enough posted work for measured traction to be one.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { getPiece, savePiece } from '@/lib/marketing/piece-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Schema = z.object({
  good: z.boolean(),
  // Short on purpose. A paragraph explaining why a piece is good becomes a second brief
  // competing with the recipe; one sentence is the useful size.
  note: z.string().trim().max(400).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const piece = await getPiece(user.email, id).catch(() => null);
  if (!piece) return NextResponse.json({ error: 'piece not found' }, { status: 404 });

  const now = new Date().toISOString();
  try {
    await savePiece(user.email, {
      ...piece,
      exemplar: body.good || undefined,
      // The note goes with the mark. Unmarking clears it, so a stale reason cannot come
      // back attached to a piece that is no longer an example.
      exemplar_note: body.good ? body.note || undefined : undefined,
      exemplar_at: body.good ? now : undefined,
      updated_at: now,
    });
  } catch (err) {
    console.error('[exemplar] save failed:', err);
    return NextResponse.json({ error: 'Could not save that.' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, exemplar: body.good });
}
