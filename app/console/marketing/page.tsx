import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import s from '../_components/client-card.module.css';
import l from '../_components/launcher.module.css';

export const dynamic = 'force-dynamic';

/**
 * Marketing engine — the console's new primary surface. Placeholder until the
 * UX-flow / functional spec lands and the full dashboard is built from it.
 */
export default async function MarketingPage() {
  const user = await getCurrentUser();

  if (user && user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }

  return (
    <>
      <div className={s.bgPattern} aria-hidden />
      <div className={s.dashboard}>
        <div className={s.header}>
          <div className={s.eyebrow}>marketing engine</div>
          <h1 className={s.title}>Marketing</h1>
        </div>

        <div className={l.placeholder}>
          <p className={l.placeholderLead}>
            The marketing engine is the next major build.
          </p>
          <p className={l.placeholderNote}>
            A UX flow and functional spec are incoming. The dashboard will be
            built from there.
          </p>
        </div>
      </div>
    </>
  );
}
