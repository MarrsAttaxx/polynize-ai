/**
 * Capability Map renderer (Stage 2, spec §9.3).
 *
 * Lifted from the polynize.ai visual spec, rendered in the Console
 * Tactile palette. Per cluster (stacked sections):
 *   - cluster header (name + type)
 *   - 4-column grid: 2fr label + 1fr x 3 lanes (HUMAN / HYBRID / AGENTIC)
 *   - filled cell = the allocated lane, with the §9.1 glow recipe
 *   - completeness treatments per §9.4
 *   - all capability detail inline by default (transparency, §9.3)
 *
 * The column header for the data value 'Agent' reads "AGENTIC".
 *
 * L6 ships this as a pure server component with no expansion (inline
 * detail always visible). L8 layers a click-to-open glance modal on top
 * via the optional onSelect plumbing exposed by the client wrapper.
 */

import type { CapabilityMapV05 } from '@/lib/blueprint/load-v2';
import s from './v2-sections.module.css';

type Cap = CapabilityMapV05['capabilities'][number];
type Cluster = CapabilityMapV05['clusters'][number];

const ALLOC_BRAND: Record<'Human' | 'Hybrid' | 'Agent', string> = {
  Human: 'var(--bp-coral)',
  Hybrid: 'var(--bp-amber)',
  Agent: 'var(--bp-mint)',
};

export function PercentageSummaryBar({ map }: { map: CapabilityMapV05 }) {
  const p = map.allocation_summary.percentages;
  return (
    <div className={s.summaryRow}>
      <StatBar label="HUMAN" pct={p.human} color="var(--bp-coral)" />
      <StatBar label="HYBRID" pct={p.hybrid} color="var(--bp-amber)" />
      <StatBar label="AGENTIC" pct={p.agent} color="var(--bp-mint)" />
      <div className={s.leverageBadge}>
        <span className={s.eyebrow}>§ leverage</span>
        <span className={s.leverageVal}>{map.leverage_estimate}</span>
      </div>
    </div>
  );
}

function StatBar({
  label,
  pct,
  color,
}: {
  label: string;
  pct: number;
  color: string;
}) {
  return (
    <div className={s.statItem}>
      <div className={s.statTop}>
        <span>{label}</span>
        <span className={s.statPct} style={{ color }}>
          {pct}%
        </span>
      </div>
      <div className={s.statTrack}>
        <div
          className={s.statFill}
          style={{
            width: `${pct}%`,
            background: color,
            boxShadow: `0 0 12px ${color}`,
          }}
        />
      </div>
    </div>
  );
}

function cellClass(
  lane: 'Human' | 'Hybrid' | 'Agent',
  cap: Cap
): string {
  if (cap.allocation !== lane) return s.cell;
  const toneClass =
    lane === 'Human'
      ? s.cellHuman
      : lane === 'Hybrid'
        ? s.cellHybrid
        : s.cellAgent;
  let completeness = '';
  if (cap.completeness === 'STUB') completeness = ` ${s.cellStub}`;
  else if (cap.completeness === 'GHOST') completeness = ` ${s.cellGhost}`;
  return `${s.cell} ${toneClass}${completeness}`;
}

function CompletenessTag({ cap }: { cap: Cap }) {
  if (cap.completeness === 'COMPLETE') return null;
  const cls =
    cap.completeness === 'PARTIAL'
      ? `${s.tag} ${s.tagPartial}`
      : cap.completeness === 'STUB'
        ? `${s.tag} ${s.tagStub}`
        : `${s.tag} ${s.tagGhost}`;
  return <span className={cls}>{cap.completeness}</span>;
}

function RiskTag({ cap }: { cap: Cap }) {
  if (cap.failure_cost === 'N/A') return null;
  const cls =
    cap.failure_cost === 'High'
      ? `${s.riskTag} ${s.riskHigh}`
      : cap.failure_cost === 'Medium'
        ? `${s.riskTag} ${s.riskMedium}`
        : `${s.riskTag} ${s.riskLow}`;
  return <span className={cls}>risk: {cap.failure_cost.toLowerCase()}</span>;
}

export function CapabilityRowView({
  cap,
  onSelect,
}: {
  cap: Cap;
  onSelect?: (capId: string) => void;
}) {
  const clickable = typeof onSelect === 'function';
  return (
    <div className={s.capRow} id={`cap-${cap.id}`}>
      <div
        className={`${s.capRowGrid} ${clickable ? s.capRowClickable : ''}`}
        {...(clickable
          ? {
              role: 'button' as const,
              tabIndex: 0,
              onClick: () => onSelect(cap.id),
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(cap.id);
                }
              },
            }
          : {})}
      >
        <div className={s.capLabel}>
          <span className={s.capName}>
            <span className={s.capId}>{cap.id}</span>
            <span className={cap.completeness === 'GHOST' ? s.capNameGhost : ''}>
              {cap.name}
            </span>
            <CompletenessTag cap={cap} />
            <RiskTag cap={cap} />
          </span>
        </div>
        <div className={cellClass('Human', cap)} aria-hidden />
        <div className={cellClass('Hybrid', cap)} aria-hidden />
        <div className={cellClass('Agent', cap)} aria-hidden />
      </div>
      {/* R2: the always-open inline detail block was removed. All capability
          detail (work shape, reason, edge cases, evidence, handoff, gaps)
          lives in the click-to-open CapabilityModal. Rows stay clean:
          id, name, completeness + risk tags, allocation cells. */}
    </div>
  );
}

export function CapabilityMap({
  map,
  onSelect,
}: {
  map: CapabilityMapV05;
  onSelect?: (capId: string) => void;
}) {
  const clusters = [...map.clusters].sort((a, b) => a.order - b.order);
  const byCluster = (cluster: Cluster) =>
    map.capabilities.filter((c) => c.cluster_id === cluster.id);

  return (
    <div>
      <PercentageSummaryBar map={map} />
      {clusters.map((cluster) => {
        const rows = byCluster(cluster);
        if (rows.length === 0) return null;
        return (
          <div key={cluster.id} className={s.cluster}>
            <div className={s.clusterHead}>
              <h3 className={s.clusterName}>
                {cluster.id} · {cluster.name}
              </h3>
              <span className={s.clusterType}>{cluster.cluster_type}</span>
            </div>
            <div className={s.grid}>
              <div className={s.gridHead}>
                <div className={s.gridHFn}>capability</div>
                <div className={s.gridH} style={{ color: ALLOC_BRAND.Human }}>
                  HUMAN
                </div>
                <div className={s.gridH} style={{ color: ALLOC_BRAND.Hybrid }}>
                  HYBRID
                </div>
                <div className={s.gridH} style={{ color: ALLOC_BRAND.Agent }}>
                  AGENTIC
                </div>
              </div>
              {rows.map((cap) => (
                <CapabilityRowView key={cap.id} cap={cap} onSelect={onSelect} />
              ))}
            </div>
          </div>
        );
      })}
      {map.allocation_summary.notes && (
        <p className={s.capDetail} style={{ marginTop: 12 }}>
          {map.allocation_summary.notes}
        </p>
      )}
    </div>
  );
}
