import type { BlueprintPayload } from '@/lib/blueprint/load';
import s from './blueprint.module.css';
import { firstNameOf } from './util';

export function Heatmap({ payload }: { payload: BlueprintPayload }) {
  const { answers, data } = payload;
  const firstName = firstNameOf(answers.name);
  const p = data.percentages;

  return (
    <section className={s.page} data-screen-label="Page 02 · Capability Map">
      <div className={s.pageHead}>
        <div className={s.pageNum}>01 / 03</div>
        <div className={s.eyebrow}>§ your capability map</div>
        <h2 className={s.pageTitle}>
          Your bottleneck,
          <br />
          mapped<span className={s.mint}>.</span>
        </h2>
        <p className={s.pageLede}>{data.interpretation}</p>
      </div>

      <div className={s.summaryRow}>
        <Stat label="Human-led" v={p.human} color="var(--coral)" />
        <Stat label="Hybrid" v={p.hybrid} color="var(--amber)" />
        <Stat label="Agent-exec" v={p.agent} color="var(--mint)" />
        <div className={s.leverageBadge}>
          <div className={s.eyebrow}>§ leverage</div>
          <div className={s.leverageVal}>{data.leverage_estimate}</div>
        </div>
      </div>

      <div className={s.grid}>
        <div className={s.gridHead}>
          <div className={s.gridHFn}>capability</div>
          <div className={s.gridH} style={{ color: 'var(--coral)' }}>
            HUMAN
          </div>
          <div className={s.gridH} style={{ color: 'var(--amber)' }}>
            HYBRID
          </div>
          <div className={s.gridH} style={{ color: 'var(--mint)' }}>
            AGENT
          </div>
        </div>
        {data.capabilities.map((cap, i) => (
          <div
            key={i}
            className={s.gridRow}
            role="row"
            aria-label={`${cap.label}: allocated to ${cap.allocation}`}
          >
            <div className={s.gridFn}>
              <div>{cap.label}</div>
              <div className={s.gridFnDetail}>{cap.detail}</div>
            </div>
            {(['human', 'hybrid', 'agent'] as const).map((c) => {
              const on = cap.allocation === c;
              const toneClass =
                c === 'human' ? s.gridCellHuman : c === 'hybrid' ? s.gridCellHybrid : s.gridCellAgent;
              return (
                <div
                  key={c}
                  className={`${s.gridCell} ${on ? toneClass : ''}`}
                  role="cell"
                  aria-hidden="true"
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className={s.read}>
        <div className={s.eyebrow}>§ how to read this</div>
        <p>
          {firstName}, the capabilities in <span className={s.amber}>hybrid</span> or{' '}
          <span className={s.mint}>agent</span> rows are the work we can systematically lift off the
          team, starting with a Map engagement. The <span className={s.coral}>human</span> rows
          stay with you and your team, sharper and with better context.
        </p>
        <p>{data.leverage_rationale}</p>
      </div>
    </section>
  );
}

function Stat({ label, v, color }: { label: string; v: number; color: string }) {
  return (
    <div className={s.statBlockItem}>
      <div className={s.statTop}>
        <span>{label}</span>
        <span style={{ color, fontFamily: 'monospace' }}>{v}%</span>
      </div>
      <div className={s.statBar}>
        <div
          style={{
            width: `${v}%`,
            background: color,
            boxShadow: `0 1px 0 rgba(255,255,255,0.4) inset, 0 -1px 0 rgba(0,0,0,0.25) inset, 0 0 12px ${color}`,
          }}
        />
      </div>
    </div>
  );
}
