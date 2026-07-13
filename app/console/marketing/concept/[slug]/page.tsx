import Link from 'next/link';
import { redirect } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getCurrentUser } from '@/lib/console-auth';
import { getConcept } from '@/lib/marketing/concept-store';
import { DeleteButton } from './DeleteButton';
import { BackLink } from '@/app/console/marketing/_components/BackLink';
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

  return (
    <div className={s.root}>
      <header className={s.head}>
        <BackLink
          fallbackHref={`/console/marketing/stream/${concept.stream}`}
          className={s.back}
        />
        <span className={s.eyebrow}>concept · {concept.stream}</span>
        <h1 className={s.title}>{concept.title}</h1>
      </header>

      <div className={s.developRow}>
        <Link href={`/console/marketing/concept/${slug}/create`} className={s.developBtn}>
          Create content →
        </Link>
        <DeleteButton stream={concept.stream} />
      </div>

      <article className={s.doc}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{concept.body_md}</ReactMarkdown>
      </article>
    </div>
  );
}
