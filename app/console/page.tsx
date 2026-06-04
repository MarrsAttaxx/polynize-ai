import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { loadClientCardData, type ClientCardData } from './_lib/load-clients';
import { ClientCard } from './_components/ClientCard';
import { PipelineStrip } from './_components/PipelineStrip';
import s from './_components/client-card.module.css';

export const dynamic = 'force-dynamic';

export default async function ConsolePage() {
  const user = await getCurrentUser();

  // Client-scoped users land directly on their own Blueprint.
  // The layout's auth gate already handles the !user case (renders SignInGate).
  if (user && user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }

  const clients = await loadClientCardData();
  const allFailed = clients.length > 0 && clients.every((c) => c.error);
  const empty = clients.length === 0 || allFailed;

  // Pass the signed-in user's email to each ClientCard so the inline RAG
  // editor (Step 7A.3) knows who to stamp on rag_set_by. Only team-scoped
  // users can write; for everyone else we pass null so the editor never
  // mounts. Defense-in-depth alongside the API's requireTeamScope check.
  const actorEmail = user?.scope.type === 'team' ? user.email : null;

  // Sort engagements into sections by engagement_status.
  const clientEngagements = clients.filter(
    (c) => c.engagementStatus === 'client'
  );
  const leadEngagements = clients.filter((c) => c.engagementStatus === 'lead');
  const archivedEngagements = clients.filter(
    (c) => c.engagementStatus === 'archived'
  );

  // Pipeline birds-eye covers active engagements (clients + leads), not archived.
  const pipelineEngagements = [...clientEngagements, ...leadEngagements];

  return (
    <>
      <div className={s.bgPattern} aria-hidden />
      <div className={s.dashboard}>
        <div className={s.header}>
          <div className={s.eyebrow}>polynize agentic management console</div>
          <h1 className={s.title}>PAM Control Centre</h1>
        </div>

        {empty ? (
          <p className={s.emptyState}>
            No clients configured. Add a slug to{' '}
            <code>app/console/_config/clients.ts</code> to get started.
          </p>
        ) : (
          <>
            {pipelineEngagements.length > 0 && (
              <PipelineStrip engagements={pipelineEngagements} />
            )}

            <Section
              title="Client Blueprints"
              count={clientEngagements.length}
              cards={clientEngagements}
              actorEmail={actorEmail}
              variant="client"
            />

            {leadEngagements.length > 0 && (
              <Section
                title="Leads"
                count={leadEngagements.length}
                cards={leadEngagements}
                actorEmail={actorEmail}
                variant="lead"
              />
            )}

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
          </>
        )}
      </div>
    </>
  );
}

function Section({
  title,
  count,
  cards,
  actorEmail,
  variant,
}: {
  title: string;
  count: number;
  cards: ClientCardData[];
  actorEmail: string | null;
  variant: 'client' | 'lead';
}) {
  return (
    <section className={s.dashSection}>
      <div className={s.dashSectionHead}>
        <h2 className={s.dashSectionTitle}>{title}</h2>
        <span className={s.dashSectionCount}>{count}</span>
      </div>
      {cards.length === 0 ? (
        <p className={s.dashSectionEmpty}>None yet.</p>
      ) : (
        <div className={s.grid}>
          {cards.map((c) => (
            <ClientCard
              key={c.slug}
              data={c}
              actorEmail={actorEmail}
              variant={variant}
            />
          ))}
        </div>
      )}
    </section>
  );
}
