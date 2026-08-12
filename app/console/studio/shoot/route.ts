/**
 * The shoot queue's two verbs.
 *
 * POST   { piece_id, ready }   queue a piece for the studio, or take it back out.
 * PATCH  { piece_id }          mark it RECORDED: it leaves the queue and advances to the next stage.
 *
 * Team-scope only. Cross-stream by design, so nothing here filters by stream: a studio session is one
 * room, not one brand.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { getPiece, savePiece } from '@/lib/marketing/piece-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ReadySchema = z.object({
  piece_id: z.string().trim().min(1).max(200),
  ready: z.boolean(),
});
const DoneSchema = z.object({ piece_id: z.string().trim().min(1).max(200) });

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let body: z.infer<typeof ReadySchema>;
  try {
    body = ReadySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const piece = await getPiece(user.email, body.piece_id).catch(() => null);
  if (!piece) return NextResponse.json({ error: 'piece not found' }, { status: 404 });

  const now = new Date().toISOString();
  try {
    await savePiece(user.email, {
      ...piece,
      shoot_ready: body.ready || undefined,
      shoot_ready_at: body.ready ? now : undefined,
      // Queueing something again after it was shot is a legitimate RE-TAKE, so the old timestamp goes:
      // otherwise the queue builder would filter it straight back out as already recorded.
      recorded_at: body.ready ? undefined : piece.recorded_at,
      updated_at: now,
    });
  } catch (err) {
    console.error('[studio.shoot] save failed:', err);
    return NextResponse.json({ error: 'could not save' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, ready: body.ready });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let body: z.infer<typeof DoneSchema>;
  try {
    body = DoneSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const piece = await getPiece(user.email, body.piece_id).catch(() => null);
  if (!piece) return NextResponse.json({ error: 'piece not found' }, { status: 404 });

  const now = new Date().toISOString();
  try {
    await savePiece(user.email, {
      ...piece,
      shoot_ready: undefined,
      recorded_at: now,
      /**
       * ADVANCES THE STAGE, rather than only leaving the queue.
       *
       * Marrs's call. A shot piece should land in the rough-cut work instead of disappearing from every
       * view at once: leaving it at `record` would mean footage exists with nothing in the console
       * pointing at it.
       */
      stage: 'rough_cut',
      updated_at: now,
    });
  } catch (err) {
    console.error('[studio.shoot] recorded save failed:', err);
    return NextResponse.json({ error: 'could not save' }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
