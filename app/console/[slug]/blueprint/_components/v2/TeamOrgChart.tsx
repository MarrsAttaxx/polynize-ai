/**
 * Team org-chart (R3) — one unified hierarchical chart, replacing the 1.x
 * split tree-at-top + duplicate-cards-below layout.
 *
 * The canonical cognitive work unit (CWU) is ALWAYS three tiers:
 *   Tier 1: Human accountable lead (the human team lead)
 *   Tier 2: Team leader agent (the agent that leads the team)
 *   Tier 3: Worker agents
 *
 * Roxbury is the SINGLE grandfathered exception: provisioned before the
 * rule existed, it has no team leader agent, so it renders TWO tiers
 * (human accountable lead → worker agents) with no empty middle tier.
 *
 * Three-tier is the canonical case; two-tier is an explicit exception
 * triggered ONLY when no team leader agent is designated in the data
 * (leaderAgent === null) — not a general default.
 *
 * Sources from the v0.5 `team` field (human_owner + agents). The
 * team-leader-agent designation is a parallel website workstream; when it
 * lands, the caller passes that agent as leaderAgent and this renders the
 * full three tiers with no change here.
 *
 * Naming is deliberate and distinct: the human is the "accountable lead";
 * the agent that leads is the "team leader agent".
 */

import s from './v2-sections.module.css';

type Agent = { name: string; role: string; short_desc: string };
type HumanOwner = { name: string; role: string };

export function TeamOrgChart({
  humanOwner,
  leaderAgent,
  workerAgents,
}: {
  humanOwner: HumanOwner;
  leaderAgent: Agent | null;
  workerAgents: Agent[];
}) {
  return (
    <div className={s.orgChart}>
      {/* Tier 1 — human accountable lead */}
      <div className={s.orgTier}>
        <div className={`${s.orgCard} ${s.orgCardHuman}`}>
          <span className={s.orgCardTier}>Accountable lead · human</span>
          <span className={s.orgCardName}>{humanOwner.name}</span>
          <span className={s.orgCardRole}>{humanOwner.role}</span>
        </div>
      </div>

      <div className={s.orgConnector} aria-hidden />

      {/* Tier 2 — team leader agent (canonical CWU; absent for Roxbury) */}
      {leaderAgent && (
        <>
          <div className={s.orgTier}>
            <div className={`${s.orgCard} ${s.orgCardLeader}`}>
              <span className={s.orgCardTier}>Team leader agent</span>
              <span className={s.orgCardName}>{leaderAgent.name}</span>
              <span className={s.orgCardRole}>{leaderAgent.role}</span>
              <span className={s.orgCardDesc}>{leaderAgent.short_desc}</span>
            </div>
          </div>
          <div className={s.orgConnector} aria-hidden />
        </>
      )}

      {/* Tier 3 — worker agents */}
      {workerAgents.length > 0 && (
        <div
          className={s.orgWorkerRow}
          style={
            { ['--worker-count' as string]: workerAgents.length } as React.CSSProperties
          }
        >
          {workerAgents.map((a) => (
            <div key={a.name} className={`${s.orgCard} ${s.orgCardWorker}`}>
              <span className={s.orgCardTier}>Agent</span>
              <span className={s.orgCardName}>{a.name}</span>
              <span className={s.orgCardRole}>{a.role}</span>
              <span className={s.orgCardDesc}>{a.short_desc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
