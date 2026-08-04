import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { getPiece, type MarketingPiece } from '@/lib/marketing/piece-store';
import { randomUUID } from 'node:crypto';
import { getScene } from '@/lib/marketing/scene-store';
import { listPreziesForConcept, savePrezie, UNFILED } from '@/lib/marketing/prezie-store';
import { PrezieScreen } from './PrezieScreen';
import s from '../script.module.css';

export const dynamic = 'force-dynamic';

/**
 * The PREZIE stage for a piece (D31): the interactive presentation the touchscreen runs.
 * Its own stage between Script and Record because it is a real gate, and because it now
 * comes BEFORE the words: the board is what pulls the script out of the presenter.
 *
 * Prezies belong to the CONCEPT, so this page loads every version that concept has and
 * marks the ones built for this piece. Team-scope only; owner from session.
 */
export default async function PiecePreziePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { id } = await params;
  const { v: wanted } = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }

  let piece: MarketingPiece | null = null;
  try {
    piece = await getPiece(user.email, id);
  } catch (err) {
    console.error('[prezie] piece read failed:', err);
  }

  if (!piece) {
    return (
      <div className={s.root}>
        <div className={s.notFound}>
          <p>
            No piece <code>{id}</code> yet.
          </p>
          <Link href="/console/marketing" className={s.back}>
            ← Marketing
          </Link>
        </div>
      </div>
    );
  }

  const concept = piece.concept_ref?.trim() || UNFILED;
  const pieceId = piece.piece_id;
  let all = await listPreziesForConcept(concept);

  // ONE-TIME IMPORT of the pre-versioning store. Before prezies belonged to the concept a
  // scene was keyed to the piece, so work that already exists would show up here as an
  // empty list, which reads as losing it. Idempotent by construction: once it has been
  // imported, prezies exist for the concept and this never runs again.
  if (all.length === 0) {
    try {
      const legacy = await getScene(pieceId);
      if (legacy) {
        const now = new Date().toISOString();
        await savePrezie({
          prezie_id: randomUUID(),
          concept,
          piece_id: pieceId,
          stream: piece.stream,
          owner: user.email,
          name: legacy.title || piece.title,
          scene: legacy,
          created_at: now,
        });
        all = await listPreziesForConcept(concept);
      }
    } catch (err) {
      // Never block the stage on a migration; the worst case is an empty list.
      console.error('[prezie] legacy scene import failed:', err);
    }
  }

  const versions = all.map((p) => ({
    prezie_id: p.prezie_id,
    name: p.name,
    concept: p.concept,
    for_this_piece: p.piece_id === pieceId,
    created_at: p.created_at,
    updated_at: p.updated_at,
    url: `/console/prezie/${p.concept}/${p.prezie_id}`,
    node_count: p.scene.nodes.length,
  }));

  // An explicit `?v=` wins (that is the version list being clicked). Otherwise open the
  // newest built for THIS piece, then the concept's newest, so arriving at the stage never
  // shows a blank editor when work already exists.
  const opening =
    (wanted ? all.find((p) => p.prezie_id === wanted) : undefined) ??
    all.find((p) => p.piece_id === pieceId) ??
    all[0] ??
    null;

  return (
    <PrezieScreen
      initial={piece}
      concept={concept}
      versions={versions}
      opening={
        opening
          ? { prezie_id: opening.prezie_id, name: opening.name, scene: opening.scene }
          : null
      }
    />
  );
}
