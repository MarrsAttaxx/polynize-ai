import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { getPiece, type MarketingPiece } from '@/lib/marketing/piece-store';
import { SEED_PIECES } from '@/lib/marketing/seed';
import { ScriptScreen } from './ScriptScreen';
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
  const saved = await getPiece(owner, id);
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

  return <ScriptScreen pieceId={id} initial={piece} />;
}
