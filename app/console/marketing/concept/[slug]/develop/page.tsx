import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { getConcept, conceptKey } from '@/lib/marketing/concept-store';
import { listSavedPieces, type MarketingPiece } from '@/lib/marketing/piece-store';
import { formatById } from '@/lib/marketing/output-plan';
import { BackLink } from '@/app/console/marketing/_components/BackLink';
import s from '../concept.module.css';

export const dynamic = 'force-dynamic';

/**
 * A core concept's development hub: everything in development from this concept,
 * in one place (the "In development" card per concept drills in here). Lists the
 * concept's pieces and offers the next moves (create more content, view the core
 * concept). Team-scope only; owner from the session.
 */
export default async function ConceptDevelopPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }
  const owner = user.email;

  let concept = null;
  try {
    concept = await getConcept(owner, slug);
  } catch (err) {
    console.error('[concept.develop] concept read failed:', err);
  }

  // Match the same grouping the stream page uses: concept-bank refs by their
  // slug, plus non-bank refs by their tail and ref-less pieces by piece id, so
  // EVERY in-development card (including pre-concept-bank pieces like the seed)
  // lands on a hub that finds its pieces.
  let pieces: MarketingPiece[] = [];
  try {
    const ref = conceptKey(owner, slug);
    pieces = (await listSavedPieces(owner)).filter((p) => {
      if (p.concept_ref === ref) return true;
      if (/core-concept-.+\.md$/.test(p.concept_ref ?? '')) return false;
      const tail = p.concept_ref?.split('/').filter(Boolean).pop();
      return tail === slug || p.piece_id === slug;
    });
  } catch (err) {
    console.error('[concept.develop] pieces read failed:', err);
  }

  const title = concept?.title ?? pieces[0]?.title ?? slug;
  const stream = concept?.stream ?? pieces[0]?.stream ?? 'polynize';

  return (
    <div className={s.root}>
      <header className={s.head}>
        <BackLink fallbackHref={`/console/marketing/stream/${stream}`} className={s.back} />
        <span className={s.eyebrow}>in development · {stream}</span>
        <h1 className={s.title}>{title}</h1>
      </header>

      <div className={s.developRow}>
        <div className={s.actionGroup}>
          {concept ? (
            <>
              <Link
                href={`/console/marketing/concept/${slug}/create`}
                className={s.developBtn}
              >
                Create more content →
              </Link>
              <Link href={`/console/marketing/concept/${slug}`} className={s.updateBtn}>
                View core concept
              </Link>
            </>
          ) : null}
        </div>
      </div>

      <section className={s.outputs}>
        <h2 className={s.outputsTitle}>Pieces from this concept</h2>
        {pieces.length === 0 ? (
          <p className={s.notFound}>
            Nothing in development from this concept yet.
          </p>
        ) : (
          <ul className={s.outputList}>
            {pieces.map((p) => {
              const fmt = formatById(p.format);
              const kind = p.kind ?? fmt?.kind ?? 'video';
              return (
                <li key={p.piece_id}>
                  <Link
                    href={`/console/marketing/piece/${p.piece_id}`}
                    className={s.outputItem}
                  >
                    <span className={`${s.outputKind} ${s[`kind_${kind}`] ?? ''}`}>
                      {kind}
                    </span>
                    <span className={s.outputLabel}>
                      {fmt?.label ?? p.format}
                      {p.pillar ? (
                        <span className={s.outputPillar}> · {p.pillar}</span>
                      ) : null}
                    </span>
                    <span className={s.outputStatus}>{p.status ?? 'draft'}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
