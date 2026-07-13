import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { listSavedPieces, type MarketingPiece } from '@/lib/marketing/piece-store';
import { listConcepts, type ConceptDoc } from '@/lib/marketing/concept-store';
import { SEED_PIECES } from '@/lib/marketing/seed';
import { isStreamId, streamLabel, DEFAULT_STREAM } from '@/lib/marketing/streams';
import { getBrandVoiceForStream } from '@/lib/marketing/brand-voice-store';
import { listTemplates } from '@/lib/marketing/template-store';
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

  let concepts: ConceptDoc[] = [];
  try {
    concepts = (await listConcepts(user.email)).filter(
      (c) => (c.stream || DEFAULT_STREAM) === stream
    );
  } catch (err) {
    console.error('[marketing.stream] concept list failed:', err);
  }

  const byId = new Map<string, MarketingPiece>();
  for (const seed of Object.values(SEED_PIECES)) {
    byId.set(seed.piece_id, { ...seed, owner: user.email });
  }
  try {
    for (const p of await listSavedPieces(user.email)) byId.set(p.piece_id, p);
  } catch (err) {
    console.error('[marketing.stream] piece list failed:', err);
  }
  const pieces = [...byId.values()].filter((p) => (p.stream || DEFAULT_STREAM) === stream);

  // Stream-home core assets (D20/D25): the brand voice every piece in this
  // stream is written in, and the template library it creates from. Degrade
  // gracefully on error so the page still renders.
  let brandVoiceSet = false;
  try {
    brandVoiceSet = !!(await getBrandVoiceForStream(stream));
  } catch (err) {
    console.error('[marketing.stream] brand voice read failed:', err);
  }
  let activeTemplates = 0;
  let totalTemplates = 0;
  try {
    const templates = await listTemplates(stream);
    totalTemplates = templates.length;
    activeTemplates = templates.filter((t) => t.status === 'active').length;
  } catch (err) {
    console.error('[marketing.stream] template list failed:', err);
  }

  return (
    <>
      <div className={s.bgPattern} aria-hidden />
      <div className={s.dashboard}>
        <div className={s.header}>
          <BackLink fallbackHref="/console/marketing" className={s.marketingBack} />
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
                <span className={s.bvTitle}>Content series</span>
                <span className={s.bvState}>
                  {activeTemplates > 0
                    ? `${activeTemplates} active`
                    : totalTemplates > 0
                      ? 'In development'
                      : 'None yet'}
                </span>
              </span>
              <span className={s.bvDesc}>
                The repeatable series this stream&rsquo;s content is made from. Manage them.
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
              + Start a concept
            </Link>
            <Link
              href={`/console/marketing/import?stream=${stream}`}
              className={s.importCta}
            >
              Import a concept
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
                  className={l.card}
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
            <span className={s.dashSectionCount}>{pieces.length}</span>
          </div>
          {pieces.length === 0 ? (
            <p className={s.dashSectionEmpty}>No pieces in development yet.</p>
          ) : (
            <div className={l.cards}>
              {pieces.map((p) => (
                <Link
                  key={p.piece_id}
                  href={`/console/marketing/piece/${p.piece_id}`}
                  className={l.card}
                >
                  <span className={l.cardEyebrow}>
                    {(p.format ?? '').replace(/_/g, ' ')} · {p.stage ?? 'draft'}
                  </span>
                  <span className={l.cardTitle}>{p.title}</span>
                  <span className={l.cardDesc}>Open the production flow.</span>
                  <span className={l.cardArrow} aria-hidden>
                    →
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
