import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { loadClientCardData } from '../_lib/load-clients';
import { PipelineStrip } from '../_components/PipelineStrip';
import { DashSection } from '../_components/DashSection';
import s from '../_components/client-card.module.css';

export const dynamic = 'force-dynamic';

/**
 * Leads roster — inbound prospects from the polynize.ai funnel (engagements
 * flagged engagement_status: lead). Split out of the old combined dashboard
 * behind the launcher. This surface will likely change when Salesforce
 * becomes the core CRM.
 */
export default async function LeadsPage() {
  const user = await getCurrentUser();

  if (user && user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }

  const actorEmail = user?.scope.type === 'team' ? user.email : null;

  const clients = await loadClientCardData();
  const leadEngagements = clients.filter((c) => c.engagementStatus === 'lead');

  return (
    <>
      <div className={s.bgPattern} aria-hidden />
      <div className={s.dashboard}>
        <div className={s.header}>
          <div className={s.eyebrow}>leads</div>
          <h1 className={s.title}>Leads</h1>
        </div>

        {leadEngagements.length > 0 && (
          <PipelineStrip engagements={leadEngagements} />
        )}

        <DashSection
          title="Leads"
          count={leadEngagements.length}
          cards={leadEngagements}
          actorEmail={actorEmail}
          variant="lead"
        />
      </div>
    </>
  );
}
