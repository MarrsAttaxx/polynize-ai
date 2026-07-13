/**
 * POST /console/marketing/piece/[id]/delete — delete an output draft (piece) and
 * its calendar entries (so a deleted piece leaves no dead calendar rows). Returns
 * the concept slug (if any) so the client can land back on the source concept.
 * Team-scope only; owner from the session.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/console-auth';
import { getPiece, deletePiece } from '@/lib/marketing/piece-store';
import { listEntriesForPiece, deleteEntry } from '@/lib/marketing/calendar-store';

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

  let conceptSlug: string | undefined;
  try {
    const piece = await getPiece(owner, id);
    const m = piece?.concept_ref?.match(/core-concept-(.+)\.md$/);
    if (m) conceptSlug = m[1];
  } catch (err) {
    console.error('[piece.delete] piece read failed (continuing):', err);
  }

  try {
    // Remove the piece's calendar entries first so none are orphaned.
    const entries = await listEntriesForPiece(owner, id);
    for (const e of entries) await deleteEntry(owner, e.entry_id);
  } catch (err) {
    console.error('[piece.delete] calendar cleanup failed (continuing):', err);
  }

  try {
    await deletePiece(owner, id);
    return NextResponse.json({ ok: true, conceptSlug });
  } catch (err) {
    console.error('[piece.delete] delete failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'delete failed' },
      { status: 500 }
    );
  }
}
