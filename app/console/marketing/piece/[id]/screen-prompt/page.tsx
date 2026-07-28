import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { getPiece, type MarketingPiece } from '@/lib/marketing/piece-store';
import { getDeck } from '@/lib/marketing/deck-store';
import { ScreenPromptScreen } from './ScreenPromptScreen';
import s from '../script.module.css';

export const dynamic = 'force-dynamic';

/**
 * The Screen Prompt stage for a piece (D29 amended): the PRE-RECORD plan for what the
 * touchscreen does, its own stage between Script and Record because it is a real gate
 * (the screen has to be built before the shoot). Team-scope only; owner from session.
 */
export default async function PieceScreenPromptPage({
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
    console.error('[screen-prompt] piece read failed:', err);
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

  // The built deck, when there is one, so the operator can revise a single state
  // instead of rebuilding the lot. Label + cue only; the preview loads the real page.
  const deck = await getDeck(id).catch(() => null);
  const deckStates = deck?.states.map((st) => ({ label: st.label, cue: st.cue ?? '' })) ?? null;

  return <ScreenPromptScreen initial={piece} deckStates={deckStates} />;
}
