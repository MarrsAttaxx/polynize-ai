import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { getPiece, type MarketingPiece } from '@/lib/marketing/piece-store';
import { getConcept } from '@/lib/marketing/concept-store';
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
  // paused), the piece reads as null and the screen shows "not found" instead of
  // the whole page 500-ing.
  let piece: MarketingPiece | null = null;
  try {
    piece = await getPiece(owner, id);
  } catch (err) {
    console.error('[marketing] piece read failed:', err);
  }

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

  // If this piece was developed from a concept, load the concept body so the chat
  // (April) can draft/refine grounded in the full concept, not just what is on
  // screen. Both screens use it. Only resolves S3-style concept refs; degrades to
  // undefined.
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

  // Non-video pieces (text) open on the text output screen; video on the script
  // screen. Both carry the on-screen April chat.
  const kind = piece.kind ?? kindOf(piece.format);
  if (kind === 'text') {
    return <TextOutputScreen initial={piece} conceptBody={conceptBody} />;
  }
  return <ScriptScreen initial={piece} conceptBody={conceptBody} />;
}
