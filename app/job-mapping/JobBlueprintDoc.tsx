'use client';

import { useState } from 'react';
import type { JobBlueprint, JobCapability } from '@/lib/agents/job-blueprint-schema';
import s from './job-mapping.module.css';

/**
 * The job blueprint, rendered.
 *
 * Shared by two callers on purpose: the inline result on /job-mapping for the visitor who
 * waited, and /job-mapping/<id> for the one who came back from the email. One component
 * means the emailed link cannot drift from what they were shown.
 *
 * THE LANE COLOURS ARE THE SITE'S CONTRACT. coral = human, amber = hybrid, mint = agent,
 * the same three as the capability map on /capability-mapping and the blueprint. The brief
 * asked for four things (AI, agentic, human, hybrid) and this is three lanes plus the
 * `mechanism` line on every row, which is where "AI drafts it, you approve" and "runs
 * without you" become visibly different jobs inside one lane.
 */

const LANES = ['human', 'hybrid', 'agent'] as const;
type Lane = (typeof LANES)[number];

const LANE_LABEL: Record<Lane, string> = { human: 'Human', hybrid: 'Hybrid', agent: 'Agentic' };
const LANE_CLASS: Record<Lane, string> = { human: s.lHuman, hybrid: s.lHybrid, agent: s.lAgentic };

export function JobBlueprintDoc({ blueprint }: { blueprint: JobBlueprint }) {
  const caps = blueprint.capabilities;
  const clusters = groupByCluster(caps);
  const counts = LANES.map((lane) => ({
    lane,
    n: caps.filter((c) => c.allocation === lane).length,
    share: Math.round(
      caps.filter((c) => c.allocation === lane).reduce((a, c) => a + (c.time_share || 0), 0)
    ),
  }));

  return (
    <div className={s.doc}>
      <header className={s.docHead}>
        <div className={s.eyebrow}>Your job map</div>
        <h1 className={s.docTitle}>{blueprint.role_title}</h1>
        {blueprint.role_summary && <p className={s.docLead}>{blueprint.role_summary}</p>}
        {(blueprint.function || blueprint.seniority) && (
          <div className={s.docMeta}>
            {[blueprint.function, blueprint.seniority].filter(Boolean).join(' · ')}
          </div>
        )}
      </header>

      {/* The split, before the table. A reader wants the shape of the answer before the
          detail of it, and three numbers is the shape. */}
      <div className={s.split}>
        {counts.map(({ lane, n, share }) => (
          <div key={lane} className={`${s.splitCell} ${LANE_CLASS[lane]}`}>
            <div className={s.splitN}>{n}</div>
            <div className={s.splitLane}>{LANE_LABEL[lane]}</div>
            {share > 0 && <div className={s.splitShare}>about {share}% of the role</div>}
          </div>
        ))}
      </div>

      <div className={s.exposure}>
        <span className={`${s.expBadge} ${s[`exp_${blueprint.exposure.level}`]}`}>
          {blueprint.exposure.level} exposure
        </span>
        {blueprint.exposure.line && <p className={s.expLine}>{blueprint.exposure.line}</p>}
      </div>

      {/* The map. */}
      <section className={s.mapWrap}>
        <div className={s.mapHead}>
          <div className={s.mapHeadCap}>Capability</div>
          {LANES.map((lane) => (
            <div key={lane} className={`${s.mapHeadLane} ${LANE_CLASS[lane]}`}>
              {LANE_LABEL[lane]}
            </div>
          ))}
        </div>

        {clusters.map(([cluster, rows]) => (
          <div key={cluster}>
            <div className={s.cluster}>{cluster}</div>
            {rows.map((cap) => (
              <Row key={cap.id || cap.name} cap={cap} />
            ))}
          </div>
        ))}
        <p className={s.mapFoot}>
          Percentages are estimates read from the job description, not measurements.
        </p>
      </section>

      {/* Lane summaries. */}
      <section className={s.lanes}>
        {LANES.map((lane) =>
          blueprint.lane_summary[lane] ? (
            <div key={lane} className={`${s.laneCard} ${LANE_CLASS[lane]}`}>
              <div className={s.laneCardTitle}>{LANE_LABEL[lane]}</div>
              <p>{blueprint.lane_summary[lane]}</p>
            </div>
          ) : null
        )}
      </section>

      {blueprint.keep_human.length > 0 && (
        <section className={s.block}>
          <h2 className={s.blockTitle}>What has to stay human</h2>
          <ul className={`${s.list} ${s.listHuman}`}>
            {blueprint.keep_human.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </section>
      )}

      {blueprint.learn_next.length > 0 && (
        <section className={s.block}>
          <h2 className={s.blockTitle}>What to learn next</h2>
          <ul className={`${s.list} ${s.listAgentic}`}>
            {blueprint.learn_next.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </section>
      )}

      {blueprint.what_changes && (
        <section className={s.block}>
          <h2 className={s.blockTitle}>What changes for you</h2>
          <p className={s.blockBody}>{blueprint.what_changes}</p>
        </section>
      )}
    </div>
  );
}

/** One capability. The lane cells are the heat map; the body opens on click. */
function Row({ cap }: { cap: JobCapability }) {
  const [open, setOpen] = useState(false);
  const hasBody = Boolean(cap.detail || cap.reasoning || cap.tasks.length);

  return (
    <div className={s.rowWrap}>
      <button
        type="button"
        className={s.row}
        onClick={() => hasBody && setOpen((v) => !v)}
        aria-expanded={hasBody ? open : undefined}
        disabled={!hasBody}
      >
        <span className={s.rowCap}>
          {hasBody && <span className={s.rowChev} aria-hidden="true">{open ? '−' : '+'}</span>}
          <span>
            <span className={s.rowName}>{cap.name}</span>
            {cap.mechanism && <span className={s.rowMech}>{cap.mechanism}</span>}
          </span>
        </span>
        {LANES.map((lane) => (
          <span
            key={lane}
            className={`${s.cell} ${cap.allocation === lane ? `${s.cellOn} ${LANE_CLASS[lane]}` : ''}`}
          >
            {cap.allocation === lane && cap.time_share > 0 ? `${Math.round(cap.time_share)}%` : ''}
          </span>
        ))}
      </button>

      {open && (
        <div className={s.rowBody}>
          {cap.detail && <p>{cap.detail}</p>}
          {cap.tasks.length > 0 && (
            <ul className={s.taskList}>
              {cap.tasks.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          )}
          {cap.reasoning && (
            <p className={s.why}>
              <span className={s.whyLabel}>Why this lane</span>
              {cap.reasoning}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Clusters in first-appearance order, so the model's own ordering of the role survives. */
function groupByCluster(caps: JobCapability[]): [string, JobCapability[]][] {
  const out = new Map<string, JobCapability[]>();
  for (const c of caps) {
    const key = c.cluster || 'Capabilities';
    const list = out.get(key);
    if (list) list.push(c);
    else out.set(key, [c]);
  }
  return [...out.entries()];
}
