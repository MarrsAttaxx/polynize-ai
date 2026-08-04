import Link from 'next/link';
import { redirect } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getCurrentUser } from '@/lib/console-auth';
import { getConcept } from '@/lib/marketing/concept-store';
import { listPreziesForConcept } from '@/lib/marketing/prezie-store';
import { DeleteButton } from './DeleteButton';
import { BackLink } from '@/app/console/marketing/_components/BackLink';
import { MoveConceptButton } from './MoveConceptButton';
import { ConceptTitle } from './ConceptTitle';
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

  // Every prezie built from this concept, whichever piece it was made for. They are
  // assets of the concept rather than of a piece, so this is where the whole set lives
  // (Marrs expects to come back to these, including in the podcast).
  const prezies = await listPreziesForConcept(slug).catch(() => []);

  return (
    <div className={s.root}>
      <header className={s.head}>
        <div className={s.headTop}>
          <BackLink
            fallbackHref={`/console/marketing/stream/${concept.stream}`}
            className={s.back}
            dashboardHref={`/console/marketing/stream/${concept.stream}`}
          />
          <MoveConceptButton currentStream={concept.stream} />
        </div>
        <span className={s.eyebrow}>concept · {concept.stream}</span>
        <ConceptTitle slug={slug} initial={concept.title} className={s.title} />
      </header>

      <div className={s.developRow}>
        <div className={s.actionGroup}>
          <Link href={`/console/marketing/concept/${slug}/create`} className={s.developBtn}>
            Create content →
          </Link>
          <Link href={`/console/marketing/concept/${slug}/update`} className={s.updateBtn}>
            Update concept
          </Link>
        </div>
        <DeleteButton stream={concept.stream} />
      </div>

      {prezies.length ? (
        <section className={s.prezies}>
          <span className={s.preziesTitle}>Prezies from this concept</span>
          <div className={s.prezieList}>
            {prezies.map((p) => (
              <a
                key={p.prezie_id}
                href={`/console/prezie/${p.concept}/${p.prezie_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className={s.prezieCard}
              >
                <span className={s.prezieName}>{p.name}</span>
                <span className={s.prezieMeta}>
                  {p.scene.nodes.length} objects · {(p.updated_at ?? p.created_at).slice(0, 10)}
                </span>
                <span className={s.prezieObjects}>
                  {p.scene.nodes.map((n) => n.label).join(' · ')}
                </span>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <article className={s.doc}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{concept.body_md}</ReactMarkdown>
      </article>
    </div>
  );
}
