/**
 * Capability Map renderer (Stage 2, spec §9.3).
 *
 * Lifted from the polynize.ai visual spec, rendered in the Console
 * Tactile palette. Per cluster (stacked sections):
 *   - cluster header (name + type)
 *   - 5-column grid: 2fr label + 1fr x 3 lanes (HUMAN / HYBRID / AGENTIC) +
 *     a completeness meter column (low / mid / full fill + label)
 *   - filled cell = the allocated lane, with the §9.1 glow recipe
 *   - completeness treatments per §9.4 on the lit cell; the meter column
 *     states it explicitly. Risk (failure_cost) lives in the modal only.
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

/**
 * Completeness meter (its own column). Communicates "how complete is the
 * data we have on this capability" at a glance: a low / mid / full meter plus
 * a label. The underlying STUB / PARTIAL / COMPLETE values are unchanged;
 * this is a display mapping only. GHOST (a placeholder row not yet mapped)
 * reads as an empty meter.
 */
const COMPLETENESS_DISPLAY: Record<
  Cap['completeness'],
  { level: number; label: string }
> = {
  COMPLETE: { level: 3, label: 'Fully mapped' },
  PARTIAL: { level: 2, label: 'Partly mapped' },
  STUB: { level: 1, label: 'Needs detail' },
  GHOST: { level: 0, label: 'Ghost' },
};

function CompletenessMeter({ cap }: { cap: Cap }) {
  const d = COMPLETENESS_DISPLAY[cap.completeness] ?? {
    level: 0,
    label: cap.completeness,
  };
  return (
    <div
      className={`${s.meterCell} ${
        cap.completeness === 'GHOST' ? s.meterCellGhost : ''
      }`}
      title={`Completeness: ${cap.completeness}`}
    >
      <div className={s.meterTrack} aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`${s.meterPip} ${i < d.level ? s.meterPipOn : ''}`}
          />
        ))}
      </div>
      <span className={s.meterLabel}>{d.label}</span>
    </div>
  );
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
          </span>
        </div>
        <div className={cellClass('Human', cap)} aria-hidden />
        <div className={cellClass('Hybrid', cap)} aria-hidden />
        <div className={cellClass('Agent', cap)} aria-hidden />
        <CompletenessMeter cap={cap} />
      </div>
      {/* R2: the always-open inline detail block was removed. All capability
          detail (work shape, reason, edge cases, evidence, handoff, gaps) and
          risk (failure_cost) lives in the click-to-open CapabilityModal. Rows
          stay clean: id, name, allocation cells, and the completeness meter. */}
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
                <div className={s.gridHFn}>completeness</div>
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
