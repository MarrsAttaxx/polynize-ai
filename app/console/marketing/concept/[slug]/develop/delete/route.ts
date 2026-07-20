/**
 * POST /console/marketing/concept/[slug]/develop/delete — delete an entire
 * in-development group: every piece in the group (and its calendar entries) plus
 * the concept doc itself, if one exists. This is the dev hub's "delete the whole
 * thing" action. Idempotent (a re-run finishes a partial delete). Team-scope
 * only; owner from the session. Returns the stream so the client can land home.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/console-auth';
import { getConcept, deleteConcept } from '@/lib/marketing/concept-store';
import { listSavedPieces, deletePiece } from '@/lib/marketing/piece-store';
import { pieceInDevGroup } from '@/lib/marketing/dev-group';
import { listEntriesForPiece, deleteEntry } from '@/lib/marketing/calendar-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const owner = user.email;

  // Resolve the group's pieces and the stream to return to (from the concept doc
  // if it exists, else the first piece).
  let concept = null;
  try {
    concept = await getConcept(owner, slug);
  } catch (err) {
    console.error('[dev.delete] concept read failed (continuing):', err);
  }
  let pieces;
  try {
    pieces = (await listSavedPieces(owner)).filter((p) =>
      pieceInDevGroup(p, owner, slug)
    );
  } catch (err) {
    console.error('[dev.delete] piece list failed:', err);
    return NextResponse.json({ error: 'could not read the pieces' }, { status: 502 });
  }
  const stream = concept?.stream ?? pieces[0]?.stream;

  try {
    for (const p of pieces) {
      // Remove each piece's calendar entries first so none are orphaned.
      const entries = await listEntriesForPiece(owner, p.piece_id);
      for (const e of entries) await deleteEntry(owner, e.entry_id);
      await deletePiece(owner, p.piece_id);
    }
    // Remove the concept doc too (idempotent, a no-op for a doc-less group).
    await deleteConcept(owner, slug);
  } catch (err) {
    console.error('[dev.delete] delete failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'delete failed' },
      { status: 500 }
    );
  }

  if (stream) revalidatePath(`/console/marketing/stream/${stream}`);
  return NextResponse.json({ ok: true, stream });
}
