import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { listSavedPieces, type MarketingPiece } from '@/lib/marketing/piece-store';
import { listConcepts } from '@/lib/marketing/concept-store';
import { STREAMS, STREAM_AVATARS, DEFAULT_STREAM } from '@/lib/marketing/streams';
import s from '../_components/client-card.module.css';
import l from '../_components/launcher.module.css';

export const dynamic = 'force-dynamic';

/**
 * Marketing engine — the dashboard. A key "Start a concept" action plus one card
 * per stream (owner bucket), listed in the order STREAMS declares them. Each
 * card shows its counts and opens that owner's workflow (their concepts + pieces).
 * Concepts and pieces live INSIDE their stream, not in a flat top-level list.
 */
export default async function MarketingPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }

  // Tally concepts + pieces per stream for the card counts. Degrade to zeros if a
  // store is unreachable (never 500 the dashboard).
  const counts = new Map<string, { concepts: number; pieces: number }>();
  for (const st of STREAMS) counts.set(st.id, { concepts: 0, pieces: 0 });

  // Both lists at once: awaited in turn they stacked two full store reads into the time
  // to first byte, which is a visible wait on the way back to this page.
  const [piecesRes, conceptsRes] = await Promise.all([
    listSavedPieces(user.email).catch((err) => {
      console.error('[marketing] piece list failed:', err);
      return [] as MarketingPiece[];
    }),
    listConcepts(user.email).catch((err) => {
      console.error('[marketing] concept list failed:', err);
      return [];
    }),
  ]);

  const byId = new Map<string, MarketingPiece>();
  for (const p of piecesRes) byId.set(p.piece_id, p);
  for (const p of byId.values()) {
    const c = counts.get(p.stream || DEFAULT_STREAM);
    if (c) c.pieces += 1;
  }
  for (const cpt of conceptsRes) {
    const c = counts.get(cpt.stream || DEFAULT_STREAM);
    if (c) c.concepts += 1;
  }

  // How many takes are waiting, so the Studio button says whether a session is worth setting up rather than
  // only that a studio exists. Counted off the pieces already loaded above, so it costs no extra read.
  const queued = [...byId.values()].filter((p) => p.shoot_ready && !p.recorded_at).length;

  return (
    <>
      <div className={s.bgPattern} aria-hidden />
      <div className={s.dashboard}>
        <div className={s.header}>
          <div className={s.eyebrow}>marketing engine</div>
          <h1 className={s.title}>Marketing</h1>
        </div>

        <div className={s.marketingCtaRow}>
          <div className={s.ctaGroup}>
            <Link href="/console/marketing/calendar" className={s.startConceptCta}>
              Calendar
            </Link>
            {/* THE STUDIO, beside the Calendar, because they are the two things that are about the whole
                engine rather than one stream. Carries its count so the button says whether there is a
                session waiting, not merely that a studio exists. */}
            <Link href="/console/studio" className={s.startConceptCta}>
              Studio{queued > 0 ? ` · ${queued}` : ''}
            </Link>
          </div>
        </div>

        <div className={l.cards}>
          {STREAMS.map((st) => {
            const c = counts.get(st.id) ?? { concepts: 0, pieces: 0 };
            const total = c.concepts + c.pieces;
            const avatar = STREAM_AVATARS[st.id];
            return (
              <Link
                key={st.id}
                href={`/console/marketing/stream/${st.id}`}
                /* LEATHERED + GRAINED: the lifted face lives in this page's own module (see
                   .leathered), the grain is the global tactile utility. Marrs is trying it here
                   first; if it works it goes on every card. */
                className={`${l.card} ${s.hasAvatar} ${s.leathered} tacCardTexture`}
              >
                <span className={s.streamAvatar} aria-hidden>
                  {avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatar} alt="" className={s.streamAvatarImg} />
                  ) : (
                    <span className={s.streamAvatarInitial}>{st.label[0]}</span>
                  )}
                </span>
                <span className={l.cardTitle}>{st.label}</span>
                <span className={l.cardDesc}>
                  {total === 0
                    ? 'Nothing yet'
                    : `${c.concepts} concept${c.concepts === 1 ? '' : 's'} · ${c.pieces} piece${
                        c.pieces === 1 ? '' : 's'
                      }`}
                </span>
                <span className={l.cardArrow} aria-hidden>
                  →
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
