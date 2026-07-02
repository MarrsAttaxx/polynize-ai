import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { loadClientCardData } from '../_lib/load-clients';
import { ClientCard } from '../_components/ClientCard';
import { PipelineStrip } from '../_components/PipelineStrip';
import { DashSection } from '../_components/DashSection';
import s from '../_components/client-card.module.css';

export const dynamic = 'force-dynamic';

/**
 * Blueprinting roster — the client capability blueprints (now EverStock only;
 * capability mapping / blueprinting is moving to Cognitive Studio on
 * polynize.io, so this section is legacy and shrinks to zero once EverStock
 * wraps). Split out of the old combined dashboard behind the launcher.
 */
export default async function BlueprintingPage() {
  const user = await getCurrentUser();

  if (user && user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }

  const actorEmail = user?.scope.type === 'team' ? user.email : null;

  const clients = await loadClientCardData();
  const clientEngagements = clients.filter(
    (c) => c.engagementStatus === 'client'
  );
  const archivedEngagements = clients.filter(
    (c) => c.engagementStatus === 'archived'
  );

  return (
    <>
      <div className={s.bgPattern} aria-hidden />
      <div className={s.dashboard}>
        <div className={s.header}>
          <div className={s.eyebrow}>blueprinting</div>
          <h1 className={s.title}>Client Blueprints</h1>
        </div>

        {clientEngagements.length > 0 && (
          <PipelineStrip engagements={clientEngagements} />
        )}

        <DashSection
          title="Client Blueprints"
          count={clientEngagements.length}
          cards={clientEngagements}
          actorEmail={actorEmail}
          variant="client"
        />

        {archivedEngagements.length > 0 && (
          <details className={s.archivedDetails}>
            <summary className={s.archivedSummary}>
              Archived ({archivedEngagements.length})
            </summary>
            <div className={s.grid}>
              {archivedEngagements.map((c) => (
                <ClientCard
                  key={c.slug}
                  data={c}
                  actorEmail={actorEmail}
                  variant="archived"
                />
              ))}
            </div>
          </details>
        )}
      </div>
    </>
  );
}
