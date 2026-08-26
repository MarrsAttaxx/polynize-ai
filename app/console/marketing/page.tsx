import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { narrativeCountsByLane, GATE_LABELS } from '@/lib/marketing/narrative-store';
import { listSavedPieces, type MarketingPiece } from '@/lib/marketing/piece-store';
import { STREAMS, STREAM_AVATARS } from '@/lib/marketing/streams';
import s from '../_components/client-card.module.css';
import l from '../_components/launcher.module.css';

export const dynamic = 'force-dynamic';

/**
 * THE FRONT PAGE: the content engine, and the streams inside it (D45, retitled D49).
 *
 * Marrs: "I've decided that I want this to be for everyone in the team, so we need that first
 * page to come back where it has Polynize, Marrs, Shourov, Kristin and Julian as the opening.
 * When you click on anyone's individual stream, you have the narratives as the board."
 *
 * This reverses part of D40, which made the flat board the marketing home on the reasoning that
 * the unit of work is a narrative rather than a stream. That reasoning was right and incomplete:
 * a narrative belongs to exactly one person or brand, and with five of them a single flat board
 * mixes five people's work into one list where nobody can find their own. So the board did not
 * go away, it moved down a level. Whose work, then which narrative.
 *
 * The card counts are NARRATIVES now, not concepts and pieces. What matters on this screen is
 * how much work each person has moving and how much has landed.
 */
export default async function MarketingHome() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }

  // Both at once: awaited in turn they stack two full store reads into the time to first byte,
  // which is a visible wait every time you come back here. Each degrades on its own.
  const [counts, pieces] = await Promise.all([
    narrativeCountsByLane().catch((err) => {
      console.error('[marketing] narrative counts failed:', err);
      return new Map<string, { live: number; shipped: number }>();
    }),
    listSavedPieces(user.email).catch((err) => {
      console.error('[marketing] piece list failed:', err);
      return [] as MarketingPiece[];
    }),
  ]);

  // How many takes are waiting, so the Studio button says whether a session is worth setting up
  // rather than only that a studio exists.
  const byId = new Map<string, MarketingPiece>();
  for (const p of pieces) byId.set(p.piece_id, p);
  const queued = [...byId.values()].filter((p) => p.shoot_ready && !p.recorded_at).length;

  return (
    <>
      <div className={s.bgPattern} aria-hidden />
      <div className={s.dashboard}>
        <div className={s.header}>
          <div className={s.eyebrow}>marketing engine</div>
          <h1 className={s.title}>Content engine</h1>
        </div>

        <div className={s.marketingCtaRow}>
          <div className={s.ctaGroup}>
            <Link href="/console/marketing/calendar" className={s.startConceptCta}>
              Calendar
            </Link>
            {/* The Studio and the Calendar sit here because they are about the whole engine
                rather than one stream. */}
            <Link href="/console/studio" className={s.startConceptCta}>
              Studio{queued > 0 ? ` · ${queued}` : ''}
            </Link>
          </div>
        </div>

        <div className={l.cards}>
          {STREAMS.map((st) => {
            const c = counts.get(st.id) ?? { live: 0, shipped: 0 };
            const avatar = STREAM_AVATARS[st.id];
            return (
              <Link
                key={st.id}
                href={`/console/marketing/stream/${st.id}`}
                className={`${l.card} ${s.hasAvatar}`}
              >
                <span className={s.streamAvatar} aria-hidden>
                  {avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatar} alt="" className={s.streamAvatarImg} />
                  ) : (
                    /* The mint mark, half the circle's diameter, so the brand card reads as a
                       mark and not as a logo that has been shrunk. */
                    <span className={s.streamAvatarMark} />
                  )}
                </span>
                <span className={l.cardTitle}>{st.label}</span>
                <span className={l.cardDesc}>
                  {c.live === 0 && c.shipped === 0
                    ? 'Nothing yet'
                    : [
                        c.live > 0 ? `${c.live} in flight` : null,
                        c.shipped > 0 ? `${c.shipped} shipped` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                </span>
                <span className={l.cardArrow} aria-hidden>
                  →
                </span>
              </Link>
            );
          })}
        </div>

        {/* The gate vocabulary, once, on the way in. It is the same five words on every board
            below and it is the only thing on this screen that is not a name. */}
        <p className={s.dashSectionEmpty} style={{ marginTop: 28 }}>
          Every narrative walks the same five gates: {[1, 2, 3, 4, 5].map((g) => GATE_LABELS[String(g)]).join(', ')}.
        </p>
      </div>
    </>
  );
}
