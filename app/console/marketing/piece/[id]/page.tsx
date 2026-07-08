import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { getPiece, type MarketingPiece } from '@/lib/marketing/piece-store';
import { getConcept } from '@/lib/marketing/concept-store';
import { SEED_PIECES } from '@/lib/marketing/seed';
import { kindOf } from '@/lib/marketing/output-plan';
import { ScriptScreen } from './ScriptScreen';
import { TextOutputScreen } from './TextOutputScreen';
import s from './script.module.css';

export const dynamic = 'force-dynamic';

/**
 * A single content piece — Phase 1 opens on the Script screen (the swappable
 * middle's first stage for short-form video). Team-scope only; a saved piece
 * wins, otherwise a Phase-1 seed is used.
 */
export default async function MarketingPiecePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  // The layout renders the SignInGate when there is no user.
  if (!user) return null;
  if (user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }

  const owner = user.email;
  // Degrade gracefully: if storage is unreachable (e.g. the Supabase project is
  // paused), fall back to the seed so the screen still loads instead of the
  // whole page 500-ing. Autosave surfaces its own error until storage is back.
  let saved: MarketingPiece | null = null;
  try {
    saved = await getPiece(owner, id);
  } catch (err) {
    console.error('[marketing] piece read failed, using seed:', err);
  }
  const seed = SEED_PIECES[id];
  const piece: MarketingPiece | null = saved ?? (seed ? { ...seed, owner } : null);

  if (!piece) {
    return (
      <div className={s.root}>
        <div className={s.notFound}>
          <p>No piece <code>{id}</code> yet.</p>
          <Link href="/console/marketing" className={s.back}>
            ← Marketing
          </Link>
        </div>
      </div>
    );
  }

  // Non-video pieces (text) open on the text output screen; it drafts from the
  // concept server-side, so no concept body is threaded through here.
  const kind = piece.kind ?? kindOf(piece.format);
  if (kind === 'text') {
    return <TextOutputScreen initial={piece} />;
  }

  // If this piece was developed from a concept, load the concept body so the chat
  // (April) can draft/refine the script grounded in the full concept, not just the
  // visible scaffold. Only resolves S3-style concept refs; degrades to undefined.
  let conceptBody: string | undefined;
  if (piece.concept_ref) {
    const m = piece.concept_ref.match(/core-concept-(.+)\.md$/);
    if (m) {
      try {
        const concept = await getConcept(owner, m[1]);
        conceptBody = concept?.body_md;
      } catch (err) {
        console.error('[marketing] concept read for chat context failed:', err);
      }
    }
  }

  return <ScriptScreen initial={piece} conceptBody={conceptBody} />;
}
