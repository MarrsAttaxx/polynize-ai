import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { listIdeas, type Idea } from '@/lib/marketing/idea-store';
import { Ideas } from './Ideas';
import { isStreamId, streamLabel } from '@/lib/marketing/streams';
import { AnalyticsPanel } from '@/app/console/marketing/_components/AnalyticsPanel';
import { NarrativeDelete } from './NarrativeDelete';
import { getBrandVoiceForStream } from '@/lib/marketing/brand-voice-store';
import { listTemplates } from '@/lib/marketing/template-store';
import { listMediaForStream } from '@/lib/marketing/media-store';
import { BackLink } from '@/app/console/marketing/_components/BackLink';
import { listNarrativeCards, GATE_LABELS, type NarrativeCard } from '@/lib/marketing/narrative-store';
import { listSavedPieces, type MarketingPiece } from '@/lib/marketing/piece-store';
import { cardState } from '@/lib/marketing/kit';
import s from '../../../_components/client-card.module.css';
import l from '../../../_components/launcher.module.css';
import lane from './lanes.module.css';

export const dynamic = 'force-dynamic';

/**
 * A STREAM'S BOARD (D45): this person's or brand's narratives at their gates, and below it the
 * setup that shapes them plus the older per-stream sections.
 *
 * Marrs: "when you click on anyone's individual stream, you have the narratives as the board...
 * that makes more sense." So the board leads. It used to be the marketing home and it mixed five
 * people's work into one list; here it is scoped to one of them, which is the level at which the
 * question "what am I working on" actually has an answer.
 *
 * D48 removed Core concepts, In development and Podcasts from this page on his word: "that's the
 * old way of thinking." The narrative's own article replaced the concept as the source of truth at
 * Gate 2 (D40), so none of the three is the way in any more. NOTHING WAS DELETED: the concept
 * pages, the development hub and the podcast screens all still exist and are reachable by url,
 * with their data untouched. This page simply stops leading with them, and stops paying for three
 * store reads on the way to first byte.
 *
 * Stream setup sits ABOVE the narratives, his layout call.
 */
/**
 * One dot per piece. Marrs asked for dots and dots are right at this scale: the default kit makes
 * seven pieces. Past ten nobody counts them, so the overflow becomes a number rather than a
 * longer row, which also leaves room for the word beside it.
 *
 * `on` fills them: a piece that has cleared the making step is solid, one still being made is an
 * outline, so the two columns read differently even out of the corner of your eye.
 */
const DOT_CAP = 10;
function Dots({ n, on }: { n: number; on: boolean }) {
  const shown = Math.min(n, DOT_CAP);
  return (
    <span className={lane.dots} aria-hidden>
      {Array.from({ length: shown }, (_, i) => (
        <span key={i} className={`${lane.dot} ${on ? lane.dotOn : ''}`} />
      ))}
      {n > shown ? <span className={lane.dotMore}>+{n - shown}</span> : null}
    </span>
  );
}

export default async function StreamPage({
  params,
}: {
  params: Promise<{ stream: string }>;
}) {
  const { stream } = await params;
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }

  if (!isStreamId(stream)) {
    return (
      <div className={s.dashboard}>
        <Link href="/console/marketing" className={l.cardEyebrow} style={{ textDecoration: 'none' }}>
          ← Marketing
        </Link>
        <p className={s.dashSectionEmpty} style={{ marginTop: 16 }}>
          Unknown stream <code>{stream}</code>.
        </p>
      </div>
    );
  }

  // EVERY LOAD AT ONCE. They are independent, and awaited one after another they stacked
  // round trips (each itself serial internally) into the time to first byte. Every one still
  // degrades on its own, so a single store being down costs its section and not the page.
  const ideasPromise: Promise<Idea[]> = listIdeas(stream).catch((err) => {
    console.error('[marketing.stream] idea list failed:', err);
    return [] as Idea[];
  });

  const narrativesPromise: Promise<NarrativeCard[]> = listNarrativeCards(
    stream as NarrativeCard['lane']
  ).catch((err) => {
    console.error('[marketing.stream] narrative list failed:', err);
    return [] as NarrativeCard[];
  });

  /**
   * ONE OF THEM CAME BACK (D58). Marrs: "the gate steps that we create are a little more
   * nuanced. After gate four, you could have two or three pieces that are on gate five, but you
   * still have some on gate four."
   *
   * He is right, and a single `gate` number on a narrative cannot say it. The distribution lives
   * on the PIECES, so the piece list is loaded again, but as one parallel read that overlaps the
   * block below rather than as a serial one, and it degrades on its own: if it fails the bars
   * render exactly as they did and only the counts under them go missing.
   */
  const piecesPromise: Promise<MarketingPiece[]> = listSavedPieces(user.email).catch((err) => {
    console.error('[marketing.stream] piece list failed:', err);
    return [] as MarketingPiece[];
  });

  /**
   * THREE LOADS WENT WITH THE THREE SECTIONS (D48). Concepts, every saved piece, and the
   * podcast episodes were each a full store read on the way to first byte, and none of them
   * has anything left to render. Their screens still exist and are reachable by url; this
   * page simply stops paying for them.
   */
  const [brandVoiceRes, templatesRes, mediaRes] = await Promise.all([
    getBrandVoiceForStream(stream).catch((err) => {
      console.error('[marketing.stream] brand voice read failed:', err);
      return null;
    }),
    listTemplates(stream).catch((err) => {
      console.error('[marketing.stream] template list failed:', err);
      return [];
    }),
    listMediaForStream(stream).catch((err) => {
      console.error('[marketing.stream] media list failed:', err);
      return [];
    }),
  ]);

  // Both started before the block above so they overlap with it rather than adding round trips.
  const ideas = await ideasPromise;
  const narratives = await narrativesPromise;
  const pieces = await piecesPromise;

  /**
   * HOW MANY PIECES ARE STILL BEING MADE, AND HOW MANY HAVE CLEARED IT.
   *
   * Deduped by piece_id first, the same way the marketing home does: the store can hand back the
   * same piece twice and a double would inflate a count with no way to tell from the screen.
   *
   * `ready` is cardState's own definition, so the dots and the Gate 4 cards can never disagree:
   * the words exist AND the media is attached. Anything else is still work.
   */
  const byPieceId = new Map<string, MarketingPiece>();
  for (const p of pieces) byPieceId.set(p.piece_id, p);
  const pieceCounts = new Map<string, { toMake: number; ready: number }>();
  for (const p of byPieceId.values()) {
    if (!p.narrative_ref) continue;
    const c = pieceCounts.get(p.narrative_ref) ?? { toMake: 0, ready: 0 };
    if (cardState(p.master ?? '', p) === 'ready') c.ready += 1;
    else c.toMake += 1;
    pieceCounts.set(p.narrative_ref, c);
  }

  // One list per gate, in gate order, so the eye reads it as a production line: what is waiting
  // to be developed, what is being written, what is being made, what is ready to ship. Shipped
  // is the scoreboard at the end, not a graveyard.
  /**
   * THE LANES (D48). One row per narrative on a shared five-column gate scale, most advanced
   * first, so the funnel is readable without reading a word.
   *
   * Marrs: "If there's a concept that's a gate 3, there are three squares: two of them are
   * filled in, and the third one says Emergent AI. It's all in line, so we can see over time
   * which narratives are further down into the funnel... you can sort them top to bottom, so
   * the most developed you can bring to the top."
   *
   * `done` is how many gates are BEHIND it, which is what indents the title. A narrative at
   * gate 3 has two squares and its title sits in the third column. Shipped has all five
   * behind it. And the sort is what absorbs the idea list: a gate 1 note has nothing behind
   * it, so it starts hard left at the bottom and is still visibly there.
   */
  const gateRank = (g: NarrativeCard['gate']): number => (g === 'shipped' ? 6 : g);
  /** The five gates, in order, shared by the scale header and every bar. */
  const GATE_ORDER = [1, 2, 3, 4, 5] as const;
  const lanes = [...narratives]
    .sort(
      (a, b) =>
        gateRank(b.gate) - gateRank(a.gate) ||
        String(b.updated_at).localeCompare(String(a.updated_at))
    )
    .map((c) => ({
      ...c,
      /**
       * WHICH GATE THE BAR HIGHLIGHTS. 1 to 5 while it is moving; 6 once shipped, which is off
       * the end of the scale on purpose so every segment renders as behind it and the bar reads
       * solid rather than leaving a gap where an "at" would have been.
       */
      at: gateRank(c.gate),
      gateLabel:
        c.gate === 'shipped' ? 'shipped' : `gate ${c.gate} · ${GATE_LABELS[String(c.gate)]}`,
      counts: pieceCounts.get(c.id) ?? { toMake: 0, ready: 0 },
    }));

  const brandVoiceSet = !!brandVoiceRes;
  const totalTemplates = templatesRes.length;
  const activeTemplates = templatesRes.filter((t) => t.status === 'active').length;
  const mediaCount = mediaRes.length;

  return (
    <>
      <div className={s.bgPattern} aria-hidden />
      <div className={s.dashboard}>
        <div className={s.header}>
          <BackLink
            fallbackHref="/console/marketing"
            className={s.marketingBack}
            dashboardHref={`/console/marketing/stream/${stream}`}
          />
          <h1 className={s.title}>{streamLabel(stream)}</h1>
        </div>

        {/* Stream setup — the assets to get right first (they shape everything
            downstream), so they read above the older sections. */}
        <section className={s.setupPanel}>
          <span className={s.setupTitle}>Stream setup</span>
          <div className={s.assetCards}>
            <Link
              href={`/console/marketing/stream/${stream}/brand-voice`}
              className={`${s.brandVoiceCard} ${brandVoiceSet ? s.bvSet : s.bvUnset}`}
            >
              <span className={s.bvHead}>
                <span className={s.bvDot} aria-hidden />
                <span className={s.bvTitle}>Brand voice</span>
                <span className={s.bvState}>{brandVoiceSet ? 'Set' : 'Not set'}</span>
              </span>
              <span className={s.bvDesc}>
                {brandVoiceSet
                  ? 'The voice every concept and post in this stream is written in. Edit it.'
                  : 'Set the voice so every concept and post in this stream sounds like this brand.'}
              </span>
            </Link>
            <Link
              href={`/console/marketing/stream/${stream}/templates`}
              className={`${s.brandVoiceCard} ${activeTemplates > 0 ? s.bvSet : s.bvUnset}`}
            >
              <span className={s.bvHead}>
                <span className={s.bvDot} aria-hidden />
                <span className={s.bvTitle}>Content templates</span>
                <span className={s.bvState}>
                  {activeTemplates > 0
                    ? `${activeTemplates} active`
                    : totalTemplates > 0
                      ? 'In development'
                      : 'None yet'}
                </span>
              </span>
              <span className={s.bvDesc}>
                The repeatable templates this stream&rsquo;s content is made from. Manage them.
              </span>
            </Link>
            <Link
              href={`/console/marketing/stream/${stream}/media`}
              className={`${s.brandVoiceCard} ${mediaCount > 0 ? s.bvSet : s.bvUnset}`}
            >
              <span className={s.bvHead}>
                <span className={s.bvDot} aria-hidden />
                <span className={s.bvTitle}>Media library</span>
                <span className={s.bvState}>
                  {mediaCount > 0 ? `${mediaCount} asset${mediaCount === 1 ? '' : 's'}` : 'Empty'}
                </span>
              </span>
              <span className={s.bvDesc}>
                The reusable footage and images this stream&rsquo;s posts are built from. Manage them.
              </span>
            </Link>
          </div>
        </section>

        {/* THE BOARD, first, because it is the work. Everything below it is setup or archive. */}
        <section className={`${s.dashSection} ${s.panel}`}>
          <div className={s.dashSectionHead}>
            <h2 className={s.dashSectionTitle}>Narratives</h2>
            <span className={s.dashSectionCount}>{narratives.length}</span>
          </div>
          <div className={s.sectionCtas}>
            <Link
              href={`/console/marketing/narrative/new?stream=${stream}`}
              className={s.startConceptCta}
            >
              + New narrative
            </Link>
          </div>
          {narratives.length === 0 ? (
            <p className={lane.empty}>
              Nothing here yet. Catch an idea and it lands at gate 1, at the bottom, until it
              starts moving.
            </p>
          ) : (
            <>
              {/*
                The scale is honest again. It was dropped when a completed gate was a
                fixed-width square, because then nothing lined up with it. The segments divide
                the row equally now, so the header labels sit exactly above the gates they name.
              */}
              <div className={lane.scale} aria-hidden>
                {GATE_ORDER.map((g) => (
                  <span key={g} className={lane.scaleCell}>
                    {GATE_LABELS[String(g)]}
                  </span>
                ))}
              </div>
              <div className={lane.wrap}>
                {lanes.map((c) => (
                  /* The row is a Link and the delete is its SIBLING (D76): a button inside an
                     anchor is invalid HTML and the click resolves to whichever the browser
                     prefers. Wrapped so each control can only mean one thing. */
                  <div key={c.id} className={lane.rowWrap}>
                  <Link
                    href={`/console/marketing/narrative/${c.id}`}
                    className={`${lane.row} ${c.gate === 'shipped' ? lane.shipped : ''}`}
                  >
                    <span className={lane.top}>
                      <span className={lane.headline}>{c.headline}</span>
                      <span className={lane.gate}>{c.gateLabel}</span>
                    </span>
                    {/*
                      Five equal segments, three states. Behind it is filled and quiet, the gate
                      it is AT is full strength, ahead is an empty well. Position is readable
                      without counting anything.
                    */}
                    <span className={lane.bar}>
                      {GATE_ORDER.map((g) => (
                        <span
                          key={g}
                          className={`${lane.seg} ${
                            g < c.at ? lane.segDone : g === c.at ? lane.segAt : ''
                          }`}
                        />
                      ))}
                    </span>
                    {/*
                      WHERE THE PIECES ARE, which the bar above cannot say (D58). A narrative is
                      at one gate; its pieces are not. Aligned to the same five columns, so a dot
                      under Create is a piece still being made and a dot under Ship is one that
                      has cleared it. Only drawn once there are pieces to count.
                    */}
                    {c.gate !== 'shipped' && c.counts.toMake + c.counts.ready > 0 ? (
                      <span className={lane.counts}>
                        {GATE_ORDER.map((g) => {
                          const shipped = c.gate === 'shipped';
                          const nDots =
                            g === 4 && !shipped
                              ? c.counts.toMake
                              : g === 5
                                ? shipped
                                  ? c.counts.toMake + c.counts.ready
                                  : c.counts.ready
                                : 0;
                          const word = g === 4 ? 'to make' : shipped ? 'shipped' : 'ready';
                          return (
                            <span key={g} className={lane.countCell}>
                              {nDots > 0 ? (
                                <>
                                  <Dots n={nDots} on={g === 5} />
                                  <span className={lane.countWord}>{word}</span>
                                </>
                              ) : null}
                            </span>
                          );
                        })}
                      </span>
                    ) : null}
                  </Link>
                  <NarrativeDelete id={c.id} headline={c.headline} />
                  </div>
                ))}
              </div>
            </>
          )}

          {/*
            THE IDEA BOX STAYS, moved rather than removed. It lived inside the Core concepts
            panel, which is gone, and it is the only place in the console an idea can be
            caught. Marrs: "If we're writing an idea and it's only a gate one, it goes to the
            bottom. It's still an idea, and still there." A caught note becomes a narrative
            at gate 1 through New narrative, which is where it joins the lanes above.
          */}
          <Ideas stream={stream} initial={ideas} />
        </section>

        {/* AT THE BOTTOM (D66), below the ideas, because it is the last thing you look at and
            never the first. This stream's own numbers, where the engine page aggregates. */}
        <AnalyticsPanel scope={stream} title={`${streamLabel(stream)} · last 12 weeks`} />
      </div>
    </>
  );
}
