import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { narrativeCountsByLane, GATE_LABELS } from '@/lib/marketing/narrative-store';
import { listSavedPieces, type MarketingPiece } from '@/lib/marketing/piece-store';
import { STREAMS, STREAM_AVATARS } from '@/lib/marketing/streams';
import { AnalyticsPanel } from './_components/AnalyticsPanel';
import { getStreamAnalytics } from '@/lib/marketing/analytics-store';
import { listNotes } from '@/lib/marketing/feedback-store';
import type { StreamSlice } from '@/lib/marketing/analytics-metrics';
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
  /**
   * EVERY STREAM'S STORED NUMBERS, MERGED (D86). Five reads of one small object each, which is why
   * the store keeps one file per stream rather than one row per post: the engine page is the read
   * that has to stay cheap.
   *
   * A stream with nothing pulled contributes nothing rather than a zero, and an error on one stream
   * is surfaced without hiding the other four. Same discipline as everywhere else here: absent and
   * zero are different claims.
   */
  const stored = await Promise.all(
    STREAMS.map(async (st) => {
      try {
        return await getStreamAnalytics(st.id);
      } catch (err) {
        console.error(`[marketing] analytics read failed for ${st.id}:`, err);
        return null;
      }
    })
  );
  /**
   * ONE SLICE PER STREAM, kept apart rather than merged (D87). Merging here would throw away the
   * one thing the engine page is for: whose reach is in each platform's bar. The view sums them.
   */
  const slices: StreamSlice[] = STREAMS.map((st, i) => ({
    stream: st.id,
    label: st.label,
    posts: stored[i]?.posts ?? [],
  }));
  /**
   * ONE LINE, NOT ONE PARAGRAPH PER STREAM (D89). Two of five streams are simply not connected yet,
   * which is a configuration state rather than a fault, and printing each one's full sentence gave
   * this screen two long paragraphs saying the same thing. Unmapped streams are named together; a
   * real failure still gets its own words, because that one is worth reading.
   */
  const unmapped = stored
    .filter((x) => x?.error_kind === 'unmapped')
    .map((x) => STREAMS.find((st) => st.id === x!.stream)?.label ?? x!.stream);
  const realErrors = stored
    .filter((x) => x?.error && x.error_kind !== 'unmapped')
    .map((x) => `${STREAMS.find((st) => st.id === x!.stream)?.label ?? x!.stream}: ${x!.error}`);
  const notes = [
    unmapped.length
      ? `${listWords(unmapped)} ${unmapped.length === 1 ? 'is' : 'are'} not connected to a Metricool brand yet.`
      : '',
    ...realErrors,
  ].filter(Boolean);
  const engine = {
    pulledAt: stored.find((x) => x?.pulled_at)?.pulled_at,
    error: notes.length ? notes.join(' ') : undefined,
  };

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

  /**
   * HOW MANY RULES ARE IN FORCE (D93), on the chip beside the link. A count is the cheapest possible
   * reminder that the list exists and is doing something, which is what stops it becoming a pile
   * nobody revisits. A read failure costs the number and nothing else.
   */
  let liveRules = 0;
  try {
    liveRules = (await listNotes()).filter((n) => !n.retired_at && n.kind === 'rule').length;
  } catch (err) {
    console.error('[marketing] feedback count failed:', err);
  }

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
            {/* WHAT APRIL HAS BEEN TOLD (D93). Here for the same reason as the other two: it is
                about the whole engine rather than one stream, and a feedback list nobody can find
                is a feedback list that becomes a write-only pile. */}
            <Link href="/console/marketing/feedback" className={s.startConceptCta}>
              April&rsquo;s brief{liveRules > 0 ? ` · ${liveRules}` : ''}
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

        {/* AT THE BOTTOM (D66). Marrs: "it's always going to be the thing at the bottom, because
            you don't want to look at that first." Aggregated here, per stream on a stream board,
            and scaled up because every stream's work sits under this page. */}
        <AnalyticsPanel
          scope="engine"
          title="Across every stream"
          slices={slices}
          today={new Date().toISOString().slice(0, 10)}
          pulledAt={engine.pulledAt}
          error={engine.error}
        />
      </div>
    </>
  );
}

/** "Kristin and Julian", or "Kristin, Julian and Shourov". A list a person would say out loud. */
function listWords(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
