import Link from 'next/link';
import { redirect } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getCurrentUser } from '@/lib/console-auth';
import { getConcept } from '@/lib/marketing/concept-store';
import { listSavedPieces, type MarketingPiece } from '@/lib/marketing/piece-store';
import { formatById } from '@/lib/marketing/output-plan';
import { DeleteButton } from './DeleteButton';
import s from './concept.module.css';

export const dynamic = 'force-dynamic';

/**
 * Concept doc view + production hub. Renders core-concept-{slug}.md and the
 * outputs planned from it (D19/D23): "Plan outputs" opens the Output-plan step,
 * which fans the concept into one piece per selected format. Team-scope only;
 * owner from the session so the slug alone can't read another owner's concept.
 */
export default async function ConceptPage({
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

  let concept = null;
  try {
    concept = await getConcept(user.email, slug);
  } catch (err) {
    console.error('[concept] read failed:', err);
  }

  if (!concept) {
    return (
      <div className={s.root}>
        <Link href="/console/marketing" className={s.back}>
          ← Marketing
        </Link>
        <p className={s.notFound}>
          No concept found for <code>{slug}</code>.
        </p>
      </div>
    );
  }

  // The concept's outputs (pieces created from it). Degrade to none on error so
  // the doc still renders.
  let outputs: MarketingPiece[] = [];
  try {
    outputs = (await listSavedPieces(user.email)).filter(
      (p) => p.concept_ref === concept.concept_ref
    );
  } catch (err) {
    console.error('[concept] outputs read failed:', err);
  }

  return (
    <div className={s.root}>
      <header className={s.head}>
        <Link href={`/console/marketing/stream/${concept.stream}`} className={s.back}>
          ← {concept.stream}
        </Link>
        <span className={s.eyebrow}>concept · {concept.stream}</span>
        <h1 className={s.title}>{concept.title}</h1>
      </header>

      <div className={s.developRow}>
        <Link href={`/console/marketing/concept/${slug}/plan`} className={s.developBtn}>
          {outputs.length ? 'Plan more outputs →' : 'Plan outputs →'}
        </Link>
        <DeleteButton stream={concept.stream} />
      </div>

      {outputs.length > 0 ? (
        <section className={s.outputs}>
          <h2 className={s.outputsTitle}>Outputs</h2>
          <ul className={s.outputList}>
            {outputs.map((p) => {
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
                    <span className={s.outputLabel}>{fmt?.label ?? p.format}</span>
                    <span className={s.outputStatus}>{p.status ?? 'draft'}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <article className={s.doc}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{concept.body_md}</ReactMarkdown>
      </article>
    </div>
  );
}
