/**
 * Stage 2 (schema_version: 2.0) Blueprint renderer.
 *
 * "Best of both" converged shape — JSON-sourced 2.0 sections (capability
 * map, benchmarking, uplift, next steps, work plans, timeline) plus the
 * markdown-sourced 1.x sections restored from blueprint.md (infrastructure,
 * integration, throughput, gap register, sign-off) and the 1.x readiness
 * calculation. Target section order:
 *
 *   1. Readiness score          (1.x computeReadiness, restored)
 *   2. Engagement summary       (interpretation)
 *   3. Infrastructure           (1.x, side-by-side Polynize | Client)
 *   4. Integration              (1.x, markdown)
 *   5. Throughput               (1.x, markdown)
 *   6. Capability map           (2.0)
 *   7. Benchmarking analysis    (2.0)
 *   8. Uplift plan              (2.0)
 *   9. Next steps               (2.0)
 *  10. Team org-chart           (2.0, unified CWU org-chart)
 *  11. Gap register             (1.x, add-note + status)
 *  12. Work plan                (2.0)
 *  13. Project timeline         (2.0)
 *  14. Sign-off                 (1.x, + readiness)
 *
 * Only renders when blueprint_schema_version === '2.0'. Legacy engagements
 * use LegacyBlueprintView (unchanged).
 */

import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { loadBlueprintV2 } from '@/lib/blueprint/load-v2';
import {
  parseInfrastructure,
  parseGapRegister,
} from '@/app/console/_lib/parse-blueprint';
import { ReadinessStrip } from '@/app/console/_components/blueprint/ReadinessStrip';
import { Infrastructure } from '@/app/console/_components/blueprint/Infrastructure';
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
import {
  loadParsedMarkdown,
  findSection,
  isPopulated,
  mapPhaseForReadiness,
  syntheticReadinessBlueprint,
} from './v2-markdown';
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

function MarkdownPanel({ content }: { content: string }) {
  return (
    <div className={s.markdownPanel}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
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
  const canEdit = isTeamUser;

  // Restored 1.x sections come from modelling/blueprint.md.
  const parsedMd = await loadParsedMarkdown(slug);
  const infraSection = findSection(parsedMd, 'infrastructure');
  const infra = infraSection
    ? parseInfrastructure(infraSection.content)
    : null;
  const integrationSection = findSection(parsedMd, 'integrations');
  const throughputSection = findSection(parsedMd, 'throughput');
  const gapMdSection = findSection(parsedMd, 'gap-register');
  const gapMdParsed = gapMdSection
    ? parseGapRegister(gapMdSection.content)
    : null;

  // Readiness (1.x computeReadiness, exact formula; inputs adapted for 2.0).
  const readinessBlueprint = syntheticReadinessBlueprint(blueprint);
  const phaseLabel = phase
    ? phase.charAt(0).toUpperCase() + phase.slice(1)
    : '—';

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

        {/* 1. Readiness score (top) */}
        <ReadinessStrip
          blueprint={readinessBlueprint}
          gapsOpen={gapMdParsed?.openCount ?? 0}
          gapsBlocking={gapMdParsed?.blockingCount ?? 0}
          phase={mapPhaseForReadiness(phase)}
          subPhase={config?.engagement?.sub_phase ?? ''}
          gateNext={config?.engagement?.gate_next ?? ''}
          agentCount={capabilityMap.team.agents.length}
          unitCount={1}
          blueprintVersion="2.0"
          phaseLabel={phaseLabel}
        />

        {/* 2. Engagement summary */}
        {capabilityMap.interpretation && (
          <div className={s.intro}>{capabilityMap.interpretation}</div>
        )}

        {/* 3. Infrastructure (restored 1.x, side-by-side) */}
        {infra && (infra.polynize || infra.client) && (
          <SectionShell number="03" title="Infrastructure" id="infrastructure">
            <Infrastructure data={infra} />
          </SectionShell>
        )}

        {/* 4. Integration (restored 1.x) */}
        {integrationSection && isPopulated(integrationSection.content) && (
          <SectionShell number="04" title="Integration" id="integration">
            <MarkdownPanel content={integrationSection.content} />
          </SectionShell>
        )}

        {/* 5. Throughput (restored 1.x) */}
        {throughputSection && isPopulated(throughputSection.content) && (
          <SectionShell number="05" title="Throughput" id="throughput">
            <MarkdownPanel content={throughputSection.content} />
          </SectionShell>
        )}

        {/* 6. Capability map (2.0) */}
        <SectionShell number="06" title="Capability map" id="capability-map">
          <CapabilityMapInteractive
            map={capabilityMap}
            engagementModel={engagementModel}
            workPlanRegistry={config?.work_plan_registry ?? []}
          />
        </SectionShell>

        {/* 7. Benchmarking analysis (2.0) */}
        <SectionShell number="07" title="Benchmarking analysis" id="benchmarking">
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

        {/* 8. Uplift plan (2.0) */}
        <SectionShell number="08" title="Uplift plan" id="uplift">
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

        {/* 9. Next steps (2.0) */}
        <SectionShell number="09" title="Next steps" id="next-steps">
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

        {/* 11. Gap register (2.0 derived — reverts to 1.x in a later commit) */}
        <SectionShell number="11" title="Gap register" id="gap-register">
          <GapRegisterV2
            map={capabilityMap}
            slug={slug}
            canEdit={canEdit}
            locked={locked}
          />
        </SectionShell>

        {/* 12. Work plan (2.0) */}
        {showWorkPlans && (
          <SectionShell number="12" title="Work plans" id="work-plans">
            <WorkPlanSection
              workPlans={workPlans}
              slug={slug}
              canEdit={canEdit}
            />
          </SectionShell>
        )}

        {/* 13. Project timeline (2.0) */}
        {timeline && (
          <SectionShell number="13" title="Project timeline" id="timeline">
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
