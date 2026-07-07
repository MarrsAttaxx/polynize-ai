import Link from 'next/link';
import { redirect } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getCurrentUser } from '@/lib/console-auth';
import { getConcept } from '@/lib/marketing/concept-store';
import { DevelopButton } from './DevelopButton';
import s from './concept.module.css';

export const dynamic = 'force-dynamic';

/**
 * Concept doc view (T5 output). Renders core-concept-{slug}.md for the owner.
 * Team-scope only; owner from the session so the slug alone can't read another
 * owner's concept. This is the doc the rest of the spine drafts from.
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
        <Link href={`/console/marketing/stream/${concept.stream}`} className={s.back}>
          ← {concept.stream}
        </Link>
        <span className={s.eyebrow}>concept · {concept.stream}</span>
        <h1 className={s.title}>{concept.title}</h1>
      </header>
      <DevelopButton />
      <article className={s.doc}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{concept.body_md}</ReactMarkdown>
      </article>
    </div>
  );
}
