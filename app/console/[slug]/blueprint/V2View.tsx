/**
 * Stage 2 (schema_version: 2.0) Blueprint renderer.
 *
 * Renders the two-layer Blueprint as a single page, sections top to
 * bottom (spec §9.2):
 *   1. Engagement summary       (blueprint.md, future)
 *   2. Team                     (future)
 *   3. Infrastructure           (future)
 *   4. Capability Map           (L6 — this landmark)
 *   5. Benchmarking Analysis    (L7)
 *   6. Uplift Plan              (L7)
 *   7. Next Steps               (L7)
 *   8. Gap Register             (L9)
 *   9. Work Plan(s)             (L10)
 *  10. Project Timeline         (L11)
 *
 * This component only renders when blueprint_schema_version === '2.0'.
 * Legacy engagements use LegacyBlueprintView.
 */

import Link from 'next/link';
import { loadBlueprintV2 } from '@/lib/blueprint/load-v2';
import { RefreshButton } from './RefreshButton';
import { CapabilityMapInteractive } from './_components/v2/CapabilityMapInteractive';
import { BenchmarkingAnalysis } from './_components/v2/BenchmarkingAnalysis';
import { UpliftPlan } from './_components/v2/UpliftPlan';
import { NextSteps } from './_components/v2/NextSteps';
import { GapRegisterV2 } from './_components/v2/GapRegisterV2';
import { WorkPlanSection } from './_components/v2/WorkPlanSection';
import { ProjectTimeline } from './_components/v2/ProjectTimeline';
import { ExportButton } from './_components/v2/ExportButton';
import { LockControl } from './_components/v2/LockControl';
import s from './blueprint.module.css';
import v2s from './_components/v2/v2-sections.module.css';

function SectionShell({
  number,
  title,
  id,
  children,
}: {
  number: string;
  title: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={s.section}>
      <div className={s.sectionHeader}>
        <span className={s.sectionNumber}>{number}</span>
        <h2 className={s.sectionTitle}>{title}</h2>
      </div>
      <div className={s.sectionBody}>{children}</div>
    </section>
  );
}

export async function V2BlueprintView({
  slug,
  isTeamUser,
  actorEmail,
}: {
  slug: string;
  isTeamUser: boolean;
  actorEmail: string | null;
}) {
  const blueprint = await loadBlueprintV2(slug);

  if (!blueprint) {
    return (
      <>
        <div className={s.bgPattern} aria-hidden />
        <div className={s.container}>
          <header className={s.header}>
            <div className={s.eyebrow}>
              POLYNIZE AGENTIC MANAGEMENT CONSOLE · CLIENT BLUEPRINT
            </div>
            <h1 className={s.title}>{slug}</h1>
            {isTeamUser && (
              <Link href="/console" className={s.backLink}>
                ← All clients
              </Link>
            )}
          </header>
          <p className={s.emptyState}>
            Stage 2 Blueprint not yet populated. Add{' '}
            <code>modelling/capability-map.json</code> to the client repo to
            populate this dashboard.
          </p>
        </div>
      </>
    );
  }

  const { capabilityMap, engagementModel, workPlans, timeline, config } =
    blueprint;
  const clientName =
    config?.client?.display_name ?? config?.client?.name ?? slug;
  const statusLabel = config?.engagement_status ?? 'client';
  const phase = config?.engagement_phase ?? null;
  const showWorkPlans = phase === 'building' || phase === 'operate';
  const locked = config?.lock?.locked === true;
  // Editing is enabled for team users only. Engagement-section edits are
  // additionally lock-gated at the API layer (423) and in the UI.
  const canEdit = isTeamUser;

  return (
    <>
      <div className={s.bgPattern} aria-hidden />
      <div className={s.container}>
        <header className={s.header}>
          <div className={s.eyebrow}>
            POLYNIZE AGENTIC MANAGEMENT CONSOLE · CLIENT BLUEPRINT ·{' '}
            {statusLabel.toUpperCase()}
          </div>
          <h1 className={s.title}>{clientName}</h1>
          <div className={s.headerActions}>
            {isTeamUser ? (
              <Link href="/console" className={s.backLink}>
                ← All clients
              </Link>
            ) : (
              <span aria-hidden />
            )}
            <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Export is a read op — available to client-scope too. */}
              <ExportButton slug={slug} />
              {isTeamUser && <RefreshButton slug={slug} />}
            </span>
          </div>
        </header>

        {/* Engagement-status strip — team only. The lock/unlock control
            lives here in its own full-width row so it is always clearly
            visible, rather than buried in the wrapping header pill row. */}
        {isTeamUser && (
          <div className={v2s.engagementBar}>
            <div className={v2s.engagementBarMeta}>
              <span className={v2s.engagementBarEyebrow}>Engagement section</span>
              <span
                className={`${v2s.engagementBarState} ${
                  locked ? v2s.engagementBarStateLocked : ''
                }`}
              >
                {locked ? `Locked · v${config?.lock?.lock_version ?? 1}` : 'Unlocked'}
              </span>
            </div>
            <LockControl
              slug={slug}
              locked={locked}
              lockVersion={config?.lock?.lock_version ?? 0}
              actorEmail={actorEmail}
            />
          </div>
        )}

        {capabilityMap.interpretation && (
          <div className={s.intro}>{capabilityMap.interpretation}</div>
        )}

        <SectionShell number="04" title="Capability map" id="capability-map">
          <CapabilityMapInteractive
            map={capabilityMap}
            engagementModel={engagementModel}
            workPlanRegistry={config?.work_plan_registry ?? []}
          />
        </SectionShell>

        <SectionShell
          number="05"
          title="Benchmarking analysis"
          id="benchmarking"
        >
          {engagementModel ? (
            <BenchmarkingAnalysis
              map={capabilityMap}
              model={engagementModel}
              slug={slug}
              canEdit={canEdit}
              locked={locked}
              actorEmail={actorEmail}
            />
          ) : (
            <p className={v2s.placeholder}>
              Pending Modelling phase. Benchmarking is populated in the deep
              dive with the client.
            </p>
          )}
        </SectionShell>

        <SectionShell number="06" title="Uplift plan" id="uplift">
          {engagementModel ? (
            <UpliftPlan
              map={capabilityMap}
              model={engagementModel}
              slug={slug}
              canEdit={canEdit}
              locked={locked}
            />
          ) : (
            <p className={v2s.placeholder}>
              Pending Modelling phase. The uplift plan is defined once
              benchmarks are agreed.
            </p>
          )}
        </SectionShell>

        <SectionShell number="07" title="Next steps" id="next-steps">
          {engagementModel ? (
            <NextSteps
              model={engagementModel}
              slug={slug}
              canEdit={canEdit}
              locked={locked}
            />
          ) : (
            <p className={v2s.placeholder}>
              Pending Modelling phase. The motions that close the gaps are set
              during Modelling.
            </p>
          )}
        </SectionShell>

        <SectionShell number="08" title="Gap register" id="gap-register">
          <GapRegisterV2
            map={capabilityMap}
            slug={slug}
            canEdit={canEdit}
            locked={locked}
          />
        </SectionShell>

        {showWorkPlans && (
          <SectionShell number="09" title="Work plans" id="work-plans">
            <WorkPlanSection
              workPlans={workPlans}
              slug={slug}
              canEdit={canEdit}
            />
          </SectionShell>
        )}

        {timeline && (
          <SectionShell number="10" title="Project timeline" id="timeline">
            <ProjectTimeline
              slug={slug}
              timeline={timeline}
              canEdit={isTeamUser}
            />
          </SectionShell>
        )}
      </div>
    </>
  );
}
