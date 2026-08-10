import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { listSavedPieces, type MarketingPiece } from '@/lib/marketing/piece-store';
import { listConcepts, type ConceptDoc } from '@/lib/marketing/concept-store';
import { isStreamId, streamLabel, DEFAULT_STREAM } from '@/lib/marketing/streams';
import { getBrandVoiceForStream } from '@/lib/marketing/brand-voice-store';
import { listTemplates } from '@/lib/marketing/template-store';
import { listMediaForStream } from '@/lib/marketing/media-store';
import { listEpisodes } from '@/lib/marketing/podcast-store';
import { formatById } from '@/lib/marketing/output-plan';
import { groupKeyOf } from '@/lib/marketing/dev-group';
import { BackLink } from '@/app/console/marketing/_components/BackLink';
import s from '../../../_components/client-card.module.css';
import l from '../../../_components/launcher.module.css';

export const dynamic = 'force-dynamic';

/**
 * A stream's workflow: its concepts + in-development pieces, nested under the owner
 * (the dashboard cards link here). Team-scope only. Start-a-concept here pre-picks
 * this stream.
 */
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

  // ALL SIX LOADS AT ONCE. They are independent, and awaited one after another they
  // stacked five round trips (each of which was itself serial internally) into the time
  // to first byte: opening a stream took three to four seconds. Every one still degrades
  // on its own, so a single store being down costs its section and not the page.
  const [conceptsRes, piecesRes, brandVoiceRes, templatesRes, mediaRes, episodesRes] = await Promise.all([
    listConcepts(user.email).catch((err) => {
      console.error('[marketing.stream] concept list failed:', err);
      return [] as ConceptDoc[];
    }),
    listSavedPieces(user.email).catch((err) => {
      console.error('[marketing.stream] piece list failed:', err);
      return [] as MarketingPiece[];
    }),
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
    listEpisodes(user.email).catch((err) => {
      console.error('[marketing.stream] episode list failed:', err);
      return [];
    }),
  ]);

  const concepts: ConceptDoc[] = conceptsRes.filter(
    (c) => (c.stream || DEFAULT_STREAM) === stream
  );

  const byId = new Map<string, MarketingPiece>();
  for (const p of piecesRes) byId.set(p.piece_id, p);
  const pieces = [...byId.values()].filter((p) => (p.stream || DEFAULT_STREAM) === stream);

  // Group in-development pieces by their core concept: one card per concept,
  // ALWAYS drilling into the development hub (even for a single piece — the hub
  // is the standard landing, per Marrs 2026-07-13). groupKeyOf is the SHARED
  // predicate (lib/marketing/dev-group), so the hub and delete find exactly the
  // pieces grouped here (see that file for the undeletable-card bug this fixes).
  const groups = new Map<string, MarketingPiece[]>();
  for (const p of pieces) {
    const k = groupKeyOf(p);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(p);
  }
  const devCount = groups.size;

  // Stream-home core assets (D20/D25): the brand voice every piece in this
  // stream is written in, and the template library it creates from. Degrade
  // gracefully on error so the page still renders.
  const brandVoiceSet = !!brandVoiceRes;
  const totalTemplates = templatesRes.length;
  const activeTemplates = templatesRes.filter((t) => t.status === 'active').length;
  const mediaCount = mediaRes.length;

  // PODCAST EPISODES BELONG TO A STREAM, not to the marketing dashboard. Marrs: "it actually belongs
  // within the Polynize stream of content." An episode is that stream's source material, the same way
  // a concept is, and the clips it yields become that stream's pieces.
  const episodes = episodesRes.filter((e) => (e.stream || DEFAULT_STREAM) === stream);

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
            downstream), so they read at the top. */}
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

        <section className={`${s.dashSection} ${s.panel}`}>
          <div className={s.dashSectionHead}>
            <h2 className={s.dashSectionTitle}>Core concepts</h2>
            <span className={s.dashSectionCount}>{concepts.length}</span>
          </div>
          <div className={s.sectionCtas}>
            <Link
              href={`/console/marketing/intake?stream=${stream}`}
              className={s.startConceptCta}
            >
              + Develop a concept
            </Link>
            <Link
              href={`/console/marketing/import?stream=${stream}`}
              className={s.importCta}
            >
              Import a concept
            </Link>
            <Link
              href={`/console/marketing/library?stream=${stream}`}
              className={s.importCta}
            >
              Concept library
            </Link>
          </div>
          {concepts.length === 0 ? (
            <p className={s.dashSectionEmpty}>
              No concepts yet. Start one and April will interview you.
            </p>
          ) : (
            <div className={l.cards}>
              {concepts.map((c) => (
                <Link
                  key={c.concept_ref}
                  href={`/console/marketing/concept/${c.framing_slug}`}
                  className={`${l.card} ${s.onPanelCard}`}
                >
                  <span className={l.cardEyebrow}>concept</span>
                  <span className={l.cardTitle}>{c.title}</span>
                  <span className={l.cardDesc}>Open the concept doc.</span>
                  <span className={l.cardArrow} aria-hidden>
                    →
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className={`${s.dashSection} ${s.panel}`}>
          <div className={s.dashSectionHead}>
            <h2 className={s.dashSectionTitle}>In development</h2>
            <span className={s.dashSectionCount}>{devCount}</span>
          </div>
          {devCount === 0 ? (
            <p className={s.dashSectionEmpty}>No pieces in development yet.</p>
          ) : (
            <div className={l.cards}>
              {[...groups.entries()].map(([slug, grouped]) => {
                const kinds = [
                  ...new Set(
                    grouped.map(
                      (p) => p.pillar || formatById(p.format)?.label || p.format
                    )
                  ),
                ];
                const conceptBacked = /core-concept-.+\.md$/.test(
                  grouped[0].concept_ref ?? ''
                );
                // THE CARD IS THE CONCEPT, so it is named by the concept. It used to be
                // labelled with grouped[0].title, i.e. whichever piece happened to be
                // first, which meant renaming a piece silently renamed this card and the
                // two ideas became impossible to tell apart. The group key IS the concept
                // slug, so the concept's own title is the right label; a pre-concept-bank
                // group with no concept behind it still falls back to its first piece.
                const conceptTitle =
                  concepts.find((c) => c.framing_slug === slug)?.title ?? grouped[0].title;
                return (
                  <Link
                    key={slug}
                    href={`/console/marketing/concept/${slug}/develop`}
                    className={`${l.card} ${s.onPanelCard}`}
                  >
                    <span className={l.cardEyebrow}>
                      {conceptBacked ? 'core concept · ' : ''}
                      {grouped.length} piece{grouped.length === 1 ? '' : 's'}
                    </span>
                    <span className={l.cardTitle}>{conceptTitle}</span>
                    <span className={l.cardDesc}>{kinds.join(' · ')}</span>
                    <span className={l.cardArrow} aria-hidden>
                      →
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className={`${s.dashSection} ${s.panel}`}>
          <div className={s.dashSectionHead}>
            <h2 className={s.dashSectionTitle}>Podcasts</h2>
            <span className={s.dashSectionCount}>{episodes.length}</span>
          </div>
          {episodes.length === 0 ? (
            <p className={s.dashSectionEmpty}>
              No episodes yet.{' '}
              <Link href={`/console/marketing/podcast?stream=${stream}&new=1`}>
                Add one
              </Link>{' '}
              to mine it for vertical clips.
            </p>
          ) : (
            <div className={l.cards}>
              {episodes.map((ep) => {
                const cut = ep.clips.filter((c) => c.status === 'assembled').length;
                const ruled = ep.clips.filter(
                  (c) => c.status === 'approved' || c.status === 'assembling' || c.status === 'assembled'
                ).length;
                return (
                  <Link
                    key={ep.episode_id}
                    href={`/console/marketing/podcast/${ep.episode_id}`}
                    className={`${l.card} ${s.onPanelCard}`}
                  >
                    <span className={l.cardEyebrow}>
                      {ep.number ? `episode ${ep.number}` : 'episode'}
                    </span>
                    <span className={l.cardTitle}>{ep.title}</span>
                    <span className={l.cardDesc}>
                      {ep.clips.length === 0
                        ? ep.transcript_chars
                          ? 'Transcript in. No clips proposed yet.'
                          : 'No transcript yet.'
                        : `${ep.clips.length} proposed · ${ruled} approved · ${cut} cut`}
                    </span>
                    <span className={l.cardArrow} aria-hidden>
                      →
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
          {episodes.length ? (
            <p className={s.dashSectionEmpty} style={{ marginTop: 12 }}>
              <Link href={`/console/marketing/podcast?stream=${stream}`}>
                All episodes
              </Link>
            </p>
          ) : null}
        </section>
      </div>
    </>
  );
}
