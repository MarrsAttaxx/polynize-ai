import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { SEED_PIECES } from '@/lib/marketing/seed';
import s from '../_components/client-card.module.css';
import l from '../_components/launcher.module.css';

export const dynamic = 'force-dynamic';

/**
 * Marketing engine — the console's new primary surface. Phase 1: a piece opens
 * on the Script screen. The full dashboard (streams, calendar, analytics) is
 * built out over the following phases.
 */
export default async function MarketingPage() {
  const user = await getCurrentUser();

  if (user && user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }

  const pieces = Object.values(SEED_PIECES);

  return (
    <>
      <div className={s.bgPattern} aria-hidden />
      <div className={s.dashboard}>
        <div className={s.header}>
          <div className={s.eyebrow}>marketing engine</div>
          <h1 className={s.title}>Marketing</h1>
        </div>

        <div className={l.cards}>
          {pieces.map((p) => (
            <Link
              key={p.piece_id}
              href={`/console/marketing/piece/${p.piece_id}`}
              className={l.card}
            >
              <span className={l.cardEyebrow}>
                {p.format.replace(/_/g, ' ')} · {p.stage}
              </span>
              <span className={l.cardTitle}>{p.title}</span>
              <span className={l.cardDesc}>
                Open the Script screen. Edit and autosave; teleprompter and chat
                land in the next tickets.
              </span>
              <span className={l.cardArrow} aria-hidden>
                →
              </span>
            </Link>
          ))}
        </div>

        <p className={l.placeholderNote} style={{ marginTop: 18 }}>
          Phase 1 in progress: the Script screen is live. Treatment Map, the
          context chat, and the dashboard follow.
        </p>
      </div>
    </>
  );
}
