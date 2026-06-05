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
import {
  loadBlueprintV2,
  deriveProgressPct,
  SPRINT_STAGE_LABELS,
} from '@/lib/blueprint/load-v2';
import {
  computeModellingReadiness,
  analysisCompleteness,
} from '@/lib/blueprint/readiness';
import {
  parseInfrastructure,
  parseGapRegister,
} from '@/app/console/_lib/parse-blueprint';
import { ReadinessStrip } from '@/app/console/_components/blueprint/ReadinessStrip';
import { Infrastructure } from '@/app/console/_components/blueprint/Infrastructure';
import { GapRegister } from '@/app/console/_components/blueprint/GapRegister';
import { QuestionsForPolynize } from '@/app/console/_components/blueprint/QuestionsForPolynize';
import { readQuestions } from '@/lib/blueprint/questions-io';
import { RefreshButton } from './RefreshButton';
import { CapabilityMapInteractive } from './_components/v2/CapabilityMapInteractive';
import { BenchmarkingAnalysis } from './_components/v2/BenchmarkingAnalysis';
import { UpliftPlan } from './_components/v2/UpliftPlan';
import { NextSteps } from './_components/v2/NextSteps';
import { TeamOrgChart } from './_components/v2/TeamOrgChart';
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
  viewerEmail,
}: {
  slug: string;
  isTeamUser: boolean;
  actorEmail: string | null;
  /** Signed-in viewer's email, any scope (team OR client). Drives the
   *  client-writable Questions section's authoring + edit-own gating. */
  viewerEmail: string | null;
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
  const questionsDoc = await readQuestions(slug);
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
  const signOffSection = findSection(parsedMd, 'sign-off');
  const gapMdSection = findSection(parsedMd, 'gap-register');
  const gapMdParsed = gapMdSection
    ? parseGapRegister(gapMdSection.content)
    : null;

  // Readiness (1.x computeReadiness, exact formula; inputs adapted for 2.0).
  const readinessBlueprint = syntheticReadinessBlueprint(blueprint);
  const phaseLabel = phase
    ? phase.charAt(0).toUpperCase() + phase.slice(1)
    : '—';

  // Team org-chart (R3). `team.team_leader` (optional, v0.5 schema) names
  // the agent that leads the team. When present and it matches an agent,
  // that agent becomes tier 2 and the canonical 3-tier CWU renders; when
  // absent (Roxbury, grandfathered) leaderAgent is null → two tiers
  // (human owner → workers).
  const team = capabilityMap.team;
  const leaderName = team.team_leader;
  const leaderAgent = leaderName
    ? team.agents.find((a) => a.name === leaderName) ?? null
    : null;
  const workerAgents = leaderAgent
    ? team.agents.filter((a) => a.name !== leaderAgent.name)
    : team.agents;

  // Readiness MEANS "how complete is the work of the CURRENT phase," and it
  // re-scopes per phase:
  //  - Build / Operate (a work plan is in flight) → the active work plan's
  //    sprint-stage completion (deriveProgressPct over the 8-stage stepper).
  //  - Modelling / earlier → how complete the Modelling blueprint is
  //    (the 1.x computeReadiness, via ReadinessStrip's default path).
  const inBuildPhase = phase === 'building' || phase === 'operate';
  const activeWorkPlan =
    workPlans.find(
      (w) => w.plan.status === 'in_progress' || w.plan.status === 'operate'
    )?.plan ?? null;

  let completionPercentOverride: number | undefined;
  let subtextOverride: string | undefined;
  if (inBuildPhase && activeWorkPlan) {
    // Weighted stage progress (deriveProgressPct), so the subtext names the
    // current stage rather than a raw stage count, which would imply equal
    // weighting and contradict the number.
    completionPercentOverride = Math.round(deriveProgressPct(activeWorkPlan));
    const stageLabel = activeWorkPlan.current_stage
      ? SPRINT_STAGE_LABELS[activeWorkPlan.current_stage]
      : 'complete';
    subtextOverride = `${activeWorkPlan.title} · ${stageLabel}`;
  } else if (phase === 'modelling') {
    // Modelling readiness = total modelling work done (C3): ~80% analysis
    // completeness (avg of the capability completeness meters) + ~20% last
    // mile (critical blockers resolved). Same shared calc the dashboard uses,
    // so the two surfaces never diverge.
    const completenessValues = capabilityMap.capabilities.map(
      (c) => c.completeness
    );
    const blockersTotal = gapMdParsed?.blockingCount ?? 0;
    const blockersResolved = gapMdParsed?.blockingResolved ?? 0;
    completionPercentOverride = computeModellingReadiness({
      completenessValues,
      blockersTotal,
      blockersResolved,
    });
    const analysisPct = Math.round(
      analysisCompleteness(completenessValues) * 100
    );
    const blockersOpen = Math.max(0, blockersTotal - blockersResolved);
    subtextOverride = `${analysisPct}% analysis mapped · ${blockersOpen} critical blocker${
      blockersOpen === 1 ? '' : 's'
    } open`;
  }

  // Readiness props, reused at the top (R1) and in the sign-off (R5).
  const readinessProps = {
    blueprint: readinessBlueprint,
    gapsOpen: gapMdParsed?.openCount ?? 0,
    gapsBlocking: gapMdParsed?.blockingCount ?? 0,
    phase: mapPhaseForReadiness(phase),
    subPhase: config?.engagement?.sub_phase ?? '',
    gateNext: config?.engagement?.gate_next ?? '',
    agentCount: capabilityMap.team.agents.length,
    unitCount: 1,
    blueprintVersion: '2.0',
    phaseLabel,
    completionPercentOverride,
    subtextOverride,
  };

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
        <ReadinessStrip {...readinessProps} />

        {/* 2. Engagement summary */}
        {capabilityMap.interpretation && (
          <div className={s.intro}>{capabilityMap.interpretation}</div>
        )}

        {/* 3. Capability map (2.0) */}
        <SectionShell number="03" title="Capability map" id="capability-map">
          <CapabilityMapInteractive
            map={capabilityMap}
            engagementModel={engagementModel}
            workPlanRegistry={config?.work_plan_registry ?? []}
          />
        </SectionShell>

        {/* 4. Benchmarking analysis (2.0) */}
        <SectionShell number="04" title="Benchmarking analysis" id="benchmarking">
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

        {/* 5. Uplift plan (2.0) */}
        <SectionShell number="05" title="Uplift plan" id="uplift">
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

        {/* 6. Next steps (2.0) */}
        <SectionShell number="06" title="Next steps" id="next-steps">
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

        {/* 7. Team org-chart (proposed CWU; sits after the analysis it
            follows from, not pinned at the top — it can change through
            Modelling). Three-tier canonical; Roxbury renders two tiers. */}
        <SectionShell number="07" title="Team org-chart" id="team">
          <TeamOrgChart
            humanOwner={team.human_owner}
            leaderAgent={leaderAgent}
            workerAgents={workerAgents}
          />
        </SectionShell>

        {/* 8. Infrastructure (restored 1.x, side-by-side) */}
        {infra && (infra.polynize || infra.client) && (
          <SectionShell number="08" title="Infrastructure" id="infrastructure">
            <Infrastructure data={infra} />
          </SectionShell>
        )}

        {/* 9. Integration (restored 1.x) */}
        {integrationSection && isPopulated(integrationSection.content) && (
          <SectionShell number="09" title="Integration" id="integration">
            <MarkdownPanel content={integrationSection.content} />
          </SectionShell>
        )}

        {/* 10. Throughput (restored 1.x) */}
        {throughputSection && isPopulated(throughputSection.content) && (
          <SectionShell number="10" title="Throughput" id="throughput">
            <MarkdownPanel content={throughputSection.content} />
          </SectionShell>
        )}

        {/* 11. Gap register (1.x: add-note + status, from blueprint.md).
            canEdit is gated on team scope AND unlock — when locked the
            table renders read-only (the endpoint also returns 423). */}
        <SectionShell number="11" title="Gap register" id="gap-register">
          {gapMdParsed ? (
            <GapRegister
              data={gapMdParsed}
              slug={slug}
              canEdit={canEdit && !locked}
            />
          ) : (
            <p className={v2s.placeholder}>
              Gap register pending. Outstanding questions are logged here
              during Modelling.
            </p>
          )}
        </SectionShell>

        {/* 12. Questions for Polynize — the ONE client-writable section.
            Client scope can add questions + edit their own open ones; team
            scope sets status and answers. Sits directly under the gap
            register, same visual language. */}
        <SectionShell
          number="12"
          title="Questions for Polynize"
          id="questions"
        >
          <QuestionsForPolynize
            questions={questionsDoc.questions}
            slug={slug}
            isTeam={isTeamUser}
            viewerEmail={viewerEmail}
          />
        </SectionShell>

        {/* 13. Work plan (2.0) */}
        {showWorkPlans && (
          <SectionShell number="13" title="Work plans" id="work-plans">
            <WorkPlanSection
              workPlans={workPlans}
              slug={slug}
              canEdit={canEdit}
            />
          </SectionShell>
        )}

        {/* 14. Project timeline (2.0) */}
        {timeline && (
          <SectionShell number="14" title="Project timeline" id="timeline">
            <ProjectTimeline
              slug={slug}
              timeline={timeline}
              canEdit={isTeamUser}
            />
          </SectionShell>
        )}

        {/* 15. Sign-off (restored 1.x) + readiness score. The full SoW
            client-sign-off flow (readiness 100% → sign-off → SoW acceptance
            → phase transition) is a separate piece; this restores the 1.x
            sign-off section and shows the readiness score here too. */}
        <SectionShell number="15" title="Sign-off" id="sign-off">
          <ReadinessStrip {...readinessProps} />
          {signOffSection && isPopulated(signOffSection.content) ? (
            <div style={{ marginTop: 18 }}>
              <MarkdownPanel content={signOffSection.content} />
            </div>
          ) : (
            <p className={v2s.placeholder} style={{ marginTop: 18 }}>
              Sign-off pending. The blueprint must reach readiness before
              client sign-off.
            </p>
          )}
          {isTeamUser && (
            <div className={v2s.sowCta}>
              <div className={v2s.sowCtaText}>
                <div className={v2s.sowCtaTitle}>Statement of Works</div>
                <div className={v2s.sowCtaHint}>
                  Merge this Blueprint into the SoW and Service Agreement
                  (Annexure A), ready to complete and send.
                </div>
              </div>
              <Link href={`/console/${slug}/sow`} className={v2s.sowCtaBtn}>
                Generate Statement of Works →
              </Link>
            </div>
          )}
        </SectionShell>
      </div>
    </>
  );
}
