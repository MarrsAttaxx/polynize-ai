/**
 * POST /console/marketing/concept/[slug]/develop/adopt — promote a
 * pre-concept-bank piece group into a real core concept, so its development hub
 * gets the full toolset (Create content / View core concept / Update concept).
 *
 * Creates a concept doc from the group's primary piece (title as framing, the
 * script as source material — Update concept can evolve it from there), then
 * re-points every piece in the group at the new concept_ref. Idempotent: if the
 * concept already exists at this slug, it just returns it. Team-scope only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/console-auth';
import { getConcept, saveConcept, conceptKey } from '@/lib/marketing/concept-store';
import { listSavedPieces, savePiece } from '@/lib/marketing/piece-store';
import { pieceInDevGroup } from '@/lib/marketing/dev-group';
import { stripEmDashes } from '@/lib/em-dash';

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

  try {
    // Already concept-backed (e.g. a double click, or adopted earlier): done.
    const existing = await getConcept(owner, slug);
    if (existing) {
      return NextResponse.json({ ok: true, slug: existing.framing_slug });
    }

    const group = (await listSavedPieces(owner)).filter((p) =>
      pieceInDevGroup(p, owner, slug)
    );
    if (group.length === 0) {
      return NextResponse.json({ error: 'no pieces found for this group' }, { status: 404 });
    }

    const primary = group[0];
    const title = primary.title || slug;
    const script = (primary.script || primary.body || '').trim();
    const body_md = [
      '## Framing',
      title,
      '',
      '## Source script',
      script || '(no script material yet)',
    ].join('\n');

    const concept = await saveConcept({
      owner,
      stream: primary.stream,
      framing: stripEmDashes(title),
      title: stripEmDashes(title),
      body_md: stripEmDashes(body_md),
    });

    // Re-point the whole group at the new concept so the hub, the picker's
    // idempotency, and the drafting context all see one concept-backed family.
    const ref = conceptKey(owner, concept.framing_slug);
    for (const p of group) {
      await savePiece(owner, { ...p, concept_ref: ref, framing: concept.framing });
    }

    return NextResponse.json({ ok: true, slug: concept.framing_slug });
  } catch (err) {
    console.error('[develop.adopt] failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'adopt failed' },
      { status: 500 }
    );
  }
}
