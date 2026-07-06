import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { listSavedPieces, type MarketingPiece } from '@/lib/marketing/piece-store';
import { listConcepts, type ConceptDoc } from '@/lib/marketing/concept-store';
import { SEED_PIECES } from '@/lib/marketing/seed';
import s from '../_components/client-card.module.css';
import l from '../_components/launcher.module.css';

export const dynamic = 'force-dynamic';

/**
 * Marketing engine — the dashboard SHELL (the console's home). Streams by owner
 * plus the in-development pieces. Explicitly minimal: no calendar, analytics, or
 * pillar library yet (those need data and come in later phases). The Marketing
 * launcher card lands here, not on a piece.
 */
const STREAMS = [
  { id: 'marrs', label: 'Marrs' },
  { id: 'polynize', label: 'Polynize (brand)' },
  { id: 'shourov', label: 'Shourov' },
  { id: 'team', label: 'Team' },
] as const;

export default async function MarketingPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }

  // Seeds are always present; merge any saved pieces on top (saved wins),
  // deduped by piece_id. Degrade to seeds-only if storage is unreachable.
  const byId = new Map<string, MarketingPiece>();
  for (const seed of Object.values(SEED_PIECES)) {
    byId.set(seed.piece_id, { ...seed, owner: user.email });
  }
  try {
    for (const p of await listSavedPieces(user.email)) byId.set(p.piece_id, p);
  } catch (err) {
    console.error('[marketing] piece list failed, showing seeds only:', err);
  }
  const pieces = [...byId.values()];

  // Concepts are the top of the spine (created on the intake screen). Degrade to
  // an empty bank if storage is unreachable.
  let concepts: ConceptDoc[] = [];
  try {
    concepts = await listConcepts(user.email);
  } catch (err) {
    console.error('[marketing] concept list failed, showing none:', err);
  }

  return (
    <>
      <div className={s.bgPattern} aria-hidden />
      <div className={s.dashboard}>
        <div className={s.header}>
          <div className={s.eyebrow}>marketing engine</div>
          <h1 className={s.title}>Marketing</h1>
        </div>

        <section className={s.dashSection}>
          <div className={s.dashSectionHead}>
            <h2 className={s.dashSectionTitle}>Concept bank</h2>
            <Link href="/console/marketing/intake" className={s.newConceptCta}>
              + Start a concept
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
                  <span className={l.cardEyebrow}>concept · {c.stream}</span>
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

        {STREAMS.map((stream) => {
          const items = pieces.filter((p) => (p.stream || 'polynize') === stream.id);
          return (
            <section key={stream.id} className={s.dashSection}>
              <div className={s.dashSectionHead}>
                <h2 className={s.dashSectionTitle}>{stream.label}</h2>
                <span className={s.dashSectionCount}>{items.length}</span>
              </div>
              {items.length === 0 ? (
                <p className={s.dashSectionEmpty}>No pieces in development yet.</p>
              ) : (
                <div className={l.cards}>
                  {items.map((p) => (
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
          );
        })}

        <p className={l.placeholderNote} style={{ marginTop: 24 }}>
          Shell view: streams and in-development pieces. The content calendar,
          analytics, and the pillar library land in later phases.
        </p>
      </div>
    </>
  );
}
