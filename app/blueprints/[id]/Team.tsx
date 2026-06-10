import type { BlueprintPayload } from '@/lib/blueprint/load';
import s from './blueprint.module.css';
import { firstNameOf } from './util';

export function Team({ payload }: { payload: BlueprintPayload }) {
  const { answers, data } = payload;
  const firstName = firstNameOf(answers.name);
  const agents = data.team.agents;

  return (
    <section className={s.page} data-screen-label="Page 03 · Team">
      <div className={s.pageHead}>
        <div className={s.pageNum}>02 / 03</div>
        <div className={s.eyebrow}>§ your team</div>
        <h2 className={s.pageTitle}>
          One human.
          <br />
          <span className={s.mint}>{agents.length}</span> agents. One bottleneck
          <span className={s.mint}>.</span>
        </h2>
        <p className={s.pageLede}>
          This is the team we&apos;d build to cover the mint and amber capabilities on your map.
          Human-sounding names because you&apos;ll be working with them like colleagues. Each agent
          owns a specific slice of the bottleneck so the pipeline keeps moving without anyone chasing
          anyone.
        </p>
      </div>

      {/* Human owner — coral-accent dossier card */}
      <div className={s.dossierHumanRow}>
        <article className={`${s.dossierCard} ${s.dossierCardHuman}`}>
          <div className={`${s.dossierAvatar} ${s.dossierAvatarHuman}`}>
            <PersonIcon className={s.dossierIcon} />
          </div>
          <div className={s.dossierName}>
            {firstName} <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>(you)</span>
          </div>
          <div className={s.dossierRole}>{data.team.human_owner.role}</div>
          <p className={s.dossierDesc}>
            The team is shaped around you. You hold the strategic decisions, the high-stakes
            calls, and any exceptions outside the standard pattern. The agents below take the
            structured execution off your team&apos;s plate and bring you the work that needs your
            judgment, pre-chewed.
          </p>
        </article>
      </div>

      {/* Connector branch between human and the agent dossier row */}
      <TeamBranchSvg agentCount={agents.length} />

      {/* Agent dossier row */}
      <div
        className={s.dossierAgentRow}
        style={{ ['--agent-count' as string]: agents.length }}
      >
        {agents.map((a, i) => (
          <article key={`${a.name}-${i}`} className={s.dossierCard}>
            <div className={s.dossierBadge}>A{String(i + 1).padStart(2, '0')}</div>
            <div className={s.dossierAvatar}>
              <PersonIcon className={s.dossierIcon} />
            </div>
            <div className={s.dossierName}>{a.name}</div>
            <div className={s.dossierRole}>{a.role}</div>
            <p className={s.dossierDesc}>{a.short_desc}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function PersonIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
    </svg>
  );
}

function TeamBranchSvg({ agentCount }: { agentCount: number }) {
  const n = Math.max(1, Math.min(5, agentCount));
  const legXs = Array.from({ length: n }, (_, i) => ((i + 0.5) / n) * 100);
  const leftX = legXs[0];
  const rightX = legXs[legXs.length - 1];
  return (
    <svg
      className={s.dossierBranch}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
      role="presentation"
    >
      <line
        x1={50}
        y1={0}
        x2={50}
        y2={12}
        stroke="currentColor"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
      />
      {n > 1 && (
        <line
          x1={leftX}
          y1={12}
          x2={rightX}
          y2={12}
          stroke="currentColor"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
        />
      )}
      {legXs.map((x) => (
        <line
          key={x}
          x1={x}
          y1={12}
          x2={x}
          y2={100}
          stroke="currentColor"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
