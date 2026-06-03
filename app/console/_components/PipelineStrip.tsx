/**
 * Pipeline birds-eye (Level 1) — spec §11.3 / §10.2.
 *
 * [JUDGMENT CALL — v1] One horizontal status row per engagement showing
 * phase, active work plan, % complete, and RAG. The "who's where at a
 * glance" view. Reads from work_plan_registry + work plan statuses
 * (already on ClientCardData). Avik refines the exact format later.
 *
 * % derivation: the engagement's readiness, computed by the SAME shared calc
 * the Blueprint page uses (data.readiness, loaded live per engagement). This
 * is what keeps the dashboard number and the Blueprint number identical. The
 * coarse registry/phase mapping below is only a fallback when readiness could
 * not be computed (data.readiness == null).
 */

import type { ClientCardData } from '../_lib/load-clients';
import s from './client-card.module.css';

function coarseProgress(data: ClientCardData): number {
  const reg = data.workPlanRegistry;
  if (reg.length === 0) {
    // No work plans: progress tracks the engagement phase coarsely.
    switch (data.engagementPhase) {
      case 'marketing':
        return 0;
      case 'mapping':
        return 15;
      case 'modelling':
        return 40;
      case 'building':
        return 60;
      case 'operate':
        return 100;
      default:
        return 0;
    }
  }
  // Average each work plan's coarse status weight.
  const weight = (status: string): number => {
    switch (status) {
      case 'not_started':
        return 0;
      case 'in_progress':
        return 50;
      case 'operate':
        return 90;
      case 'archived':
        return 100;
      default:
        return 0;
    }
  };
  const sum = reg.reduce((acc, w) => acc + weight(w.status), 0);
  return Math.round(sum / reg.length);
}

export function PipelineStrip({ engagements }: { engagements: ClientCardData[] }) {
  if (engagements.length === 0) return null;

  return (
    <div className={s.pipeline}>
      <div className={s.pipelineHead}>
        <span className={s.pipelineEyebrow}>§ pipeline</span>
        <span className={s.pipelineNote}>across all engagements</span>
      </div>
      <div className={s.pipelineRows}>
        {engagements.map((e) => {
          const pct = e.readiness ?? coarseProgress(e);
          const active = e.workPlanRegistry.find(
            (w) => w.status === 'in_progress' || w.status === 'operate'
          );
          const phase = (e.engagementPhase ?? e.phase ?? 'unknown').toUpperCase();
          return (
            <a
              key={e.slug}
              href={`/console/${e.slug}/blueprint`}
              className={s.pipelineRow}
            >
              <span
                className={`${s.pipelineRag} ${s[`status_${e.status.rag}`]}`}
                aria-label={`Status: ${e.status.rag}`}
              />
              <span className={s.pipelineName}>{e.name}</span>
              <span className={s.pipelinePhase}>{phase}</span>
              <span className={s.pipelineWp}>
                {active ? active.title : '—'}
              </span>
              <span className={s.pipelineBarTrack}>
                <span
                  className={s.pipelineBarFill}
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className={s.pipelinePct}>{pct}%</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
