/**
 * POST /console/marketing/concept/[slug]/move — move a concept to a different
 * stream. The concept doc moves IN PLACE (same owner + slug, so concept_ref is
 * unchanged), and its in-development pieces plus their calendar entries move with
 * it, so the whole group stays together under the new stream. Team-scope only;
 * owner from the session.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/console-auth';
import { STREAM_IDS, streamLabel } from '@/lib/marketing/streams';
import { getConcept, moveConceptToStream } from '@/lib/marketing/concept-store';
import { listSavedPieces, savePiece } from '@/lib/marketing/piece-store';
import { pieceInDevGroup } from '@/lib/marketing/dev-group';
import { listEntriesForPiece, saveEntry } from '@/lib/marketing/calendar-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({ targetStream: z.enum(STREAM_IDS) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const owner = user.email;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }
  const targetStream = body.targetStream;

  let concept;
  try {
    concept = await getConcept(owner, slug);
  } catch (err) {
    console.error('[concept.move] read failed:', err);
    return NextResponse.json({ error: 'could not read the concept' }, { status: 502 });
  }
  if (!concept) {
    return NextResponse.json({ error: 'concept not found' }, { status: 404 });
  }
  const fromStream = concept.stream;
  if (fromStream === targetStream) {
    return NextResponse.json(
      { error: `This concept is already in ${streamLabel(targetStream)}.` },
      { status: 400 }
    );
  }

  try {
    // 1. The concept doc, in place (same slug/key).
    await moveConceptToStream(owner, slug, targetStream);
    // 2. Its pieces + their calendar entries, so the group stays together under
    //    the new stream (a piece left in the old stream would orphan its concept).
    const pieces = (await listSavedPieces(owner)).filter((p) =>
      pieceInDevGroup(p, owner, slug)
    );
    for (const p of pieces) {
      await savePiece(owner, { ...p, stream: targetStream });
      const entries = await listEntriesForPiece(owner, p.piece_id);
      for (const e of entries) {
        await saveEntry(owner, { ...e, stream: targetStream });
      }
    }
  } catch (err) {
    console.error('[concept.move] move failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'move failed' },
      { status: 500 }
    );
  }

  // Refresh both stream homes (source loses it, target gains it) and the concept
  // views, so nothing shows stale after the move.
  revalidatePath(`/console/marketing/stream/${fromStream}`);
  revalidatePath(`/console/marketing/stream/${targetStream}`);
  revalidatePath(`/console/marketing/concept/${slug}`);
  revalidatePath(`/console/marketing/concept/${slug}/develop`);
  return NextResponse.json({ ok: true, stream: targetStream });
}
