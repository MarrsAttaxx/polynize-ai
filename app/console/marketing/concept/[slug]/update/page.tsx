import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { getConcept } from '@/lib/marketing/concept-store';
import { BackLink } from '@/app/console/marketing/_components/BackLink';
import { UpdateScreen } from './UpdateScreen';
import s from '../concept.module.css';

export const dynamic = 'force-dynamic';

/**
 * Update a core concept (D25 living concepts): the owner's thinking evolves, so
 * the concept doc evolves with it. April asks what changed, digs in, then
 * restructures the WHOLE doc to reflect the new thinking, saved in place (same
 * slug, no versioning). Team-scope only.
 */
export default async function UpdateConceptPage({
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
    console.error('[concept.update] read failed:', err);
  }
  if (!concept) {
    return (
      <div className={s.root}>
        <BackLink fallbackHref="/console/marketing" className={s.back} />
        <p className={s.notFound}>
          No concept found for <code>{slug}</code>.
        </p>
      </div>
    );
  }

  return <UpdateScreen owner={user.email} slug={slug} title={concept.title} />;
}
