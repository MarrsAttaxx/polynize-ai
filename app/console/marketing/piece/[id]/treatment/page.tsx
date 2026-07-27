import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { getPiece, type MarketingPiece } from '@/lib/marketing/piece-store';
import { TreatmentScreen } from './TreatmentScreen';
import s from '../script.module.css';

export const dynamic = 'force-dynamic';

/**
 * The Treatment stage for a piece (D29 amended): the PRE-RECORD screen plan, its own
 * stage between Script and Record because it is a real gate (the screen has to be
 * built before the shoot). Team-scope only; owner from the session.
 */
export default async function PieceTreatmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }

  let piece: MarketingPiece | null = null;
  try {
    piece = await getPiece(user.email, id);
  } catch (err) {
    console.error('[treatment] piece read failed:', err);
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

  return <TreatmentScreen initial={piece} />;
}
