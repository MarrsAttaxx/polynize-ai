/**
 * PUT /console/marketing/feedback/save — change one note (D93).
 *
 * Retire it, revive it, widen or narrow its scope, or mark it a defect. Team scope only.
 *
 * NOTHING IS DELETED. Retiring stamps a date, which takes the note out of every prompt and leaves it
 * on the screen: the point of this feature is seeing what has been said to April and what happened
 * to it, and a delete throws away the half that explains the other half.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { isStreamId } from '@/lib/marketing/streams';
import { JOBS } from '@/lib/marketing/feedback';
import { updateNote } from '@/lib/marketing/feedback-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  id: z.string().trim().min(1).max(200),
  scope: z.enum(['house', 'stream', 'job']).optional(),
  stream: z.string().trim().max(64).optional(),
  job: z.enum(JOBS.map((j) => j.id) as [string, ...string[]]).optional(),
  kind: z.enum(['rule', 'defect']).optional(),
  /** true retires it, false revives it. */
  retired: z.boolean().optional(),
});

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  /**
   * A STREAM SCOPE NEEDS A REAL STREAM. Widening to 'stream' with an unknown id would produce a note
   * that matches nothing and looks active, which is worse than refusing.
   */
  if (body.scope === 'stream' && !isStreamId(body.stream ?? '')) {
    return NextResponse.json({ error: 'pick a stream for this note' }, { status: 400 });
  }
  if (body.scope === 'job' && !body.job) {
    return NextResponse.json({ error: 'pick a job for this note' }, { status: 400 });
  }

  /**
   * THE PATCH IS BUILT KEY BY KEY, not spread with undefineds.
   *
   * `updateNote` merges with `{ ...note, ...patch }`, so a key present with the value `undefined`
   * OVERWRITES the stored one. Sending `retired_at: undefined` because he only changed the scope
   * would quietly revive a retired note, which is the opposite of what he pressed. Only the fields
   * he actually changed are in the object.
   */
  const patch: Parameters<typeof updateNote>[1] = {};
  if (body.scope) {
    patch.scope = body.scope;
    if (body.scope === 'stream') patch.stream = body.stream;
    if (body.scope === 'job') patch.job = body.job as never;
  }
  if (body.kind) patch.kind = body.kind;
  if (body.retired !== undefined) {
    patch.retired_at = body.retired ? new Date().toISOString() : undefined;
  }

  try {
    const note = await updateNote(body.id, patch);
    if (!note) return NextResponse.json({ error: 'note not found' }, { status: 404 });
    return NextResponse.json({ ok: true, note });
  } catch (err) {
    console.error('[feedback.save] write failed:', err);
    return NextResponse.json({ error: 'could not save that change' }, { status: 500 });
  }
}
