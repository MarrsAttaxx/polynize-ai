import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { getConcept } from '@/lib/marketing/concept-store';
import { FORMATS, ICP_ARCHETYPES, defaultPlan } from '@/lib/marketing/output-plan';
import { OutputPlanForm } from './OutputPlanForm';
import s from './plan.module.css';

export const dynamic = 'force-dynamic';

/**
 * The Output-plan step (D19/D23): choose which outputs to make from a concept.
 * A one-tap pre-filled confirm (defaults from the concept + stream); "Create
 * outputs" fans out to one piece per selected built format. Team-scope only;
 * owner from the session so the slug alone can't plan another owner's concept.
 */
export default async function OutputPlanPage({
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
    console.error('[concept.plan] read failed:', err);
  }

  if (!concept) {
    return (
      <div className={s.root}>
        <Link href={`/console/marketing/concept/${slug}`} className={s.back}>
          ← Concept
        </Link>
        <p className={s.notFound}>
          No concept found for <code>{slug}</code>.
        </p>
      </div>
    );
  }

  const defaults = defaultPlan(concept.body_md, concept.stream);

  return (
    <div className={s.root}>
      <header className={s.head}>
        <Link href={`/console/marketing/concept/${slug}`} className={s.back}>
          ← {concept.title}
        </Link>
        <span className={s.eyebrow}>plan the outputs · {concept.stream}</span>
        <h1 className={s.title}>What should this concept become?</h1>
        <p className={s.sub}>
          Pick the outputs to make. Each one becomes a piece you can draft, review, and
          publish. Video opens on the script; text opens on the post draft.
        </p>
      </header>

      <OutputPlanForm
        formats={FORMATS}
        icps={ICP_ARCHETYPES}
        defaults={defaults}
      />
    </div>
  );
}
