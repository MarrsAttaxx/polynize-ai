'use client';

import { useEffect, useRef, useState } from 'react';
import s from './home.module.css';

type Allocation = 'human' | 'hybrid' | 'agent';

/** Sequenced move for each capability, mirroring the blueprint's Transformation tab. */
type Move = 'train' | 'deploy' | 'hold';

type Row = { fn: string; alloc: Allocation; move: Move };

const ROWS: Row[] = [
  { fn: 'Initial deal sourcing & qualification', alloc: 'agent', move: 'deploy' },
  { fn: 'Market sizing & trend analysis', alloc: 'agent', move: 'deploy' },
  { fn: 'Comparable transaction research', alloc: 'agent', move: 'hold' },
  { fn: 'Financial modelling first-pass', alloc: 'hybrid', move: 'deploy' },
  { fn: 'Competitive landscape mapping', alloc: 'agent', move: 'deploy' },
  { fn: 'Legal document review & flagging', alloc: 'hybrid', move: 'train' },
  { fn: 'Compliance & regulatory verification', alloc: 'agent', move: 'hold' },
  { fn: 'Risk assessment & synthesis', alloc: 'hybrid', move: 'deploy' },
  { fn: 'Investment thesis & recommendation', alloc: 'human', move: 'train' },
  { fn: 'Final valuation & pricing decision', alloc: 'human', move: 'train' },
];

const MOVE_CLASS: Record<Move, string> = {
  train: 'dcMoveTrain',
  deploy: 'dcMoveDeploy',
  hold: 'dcMoveHold',
};

const PCT = { human: 20, hybrid: 30, agent: 50 } as const;

const META = {
  bottleneck: 'Investment research & due diligence',
  business: 'Boutique investment advisory, 8 people',
  outcome: 'Recommendations in days, with partner time spent on judgment',
};

/**
 * Sample capability map shown on the homepage. Mirrors the BOTTLENECK
 * dataset from design_handoff/designs/Homepage_v2.html.
 *
 * Rows reveal one at a time after the section enters the viewport. Once all
 * rows are lit, owners and totals fade in.
 */
export function CapabilityMapPreview() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [revealCount, setRevealCount] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          io.disconnect();
          let i = 0;
          const iv = setInterval(() => {
            i++;
            setRevealCount(i);
            if (i >= ROWS.length) clearInterval(iv);
          }, 140);
          return;
        }
      },
      { threshold: 0.18 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className={s.dcMap} ref={ref}>
      <div className={s.dcMapFrame}>
        <div className={s.dcMapStrip} />

        {/* Deliberately not attributed to a named customer: the moves and totals
            below are illustrative, so they must not read as a real client's data. */}
        <div className={s.dcMapIdent}>
          <div className={s.dcMapIdentText}>Sample capability blueprint.</div>
        </div>

        <div className={s.dcMapMeta}>
          <div>
            <div className={s.dcMapMetaK}>Bottleneck</div>
            <div className={s.dcMapMetaV}>{META.bottleneck}</div>
          </div>
          <div>
            <div className={s.dcMapMetaK}>Business</div>
            <div className={s.dcMapMetaV}>{META.business}</div>
          </div>
          <div>
            <div className={s.dcMapMetaK}>What good looks like</div>
            <div className={s.dcMapMetaV}>{META.outcome}</div>
          </div>
        </div>

        <div className={s.dcMapTable}>
          <div className={s.dcMapThead}>
            <div className={s.dcMapThFn}>Capability</div>
            <div className={s.dcMapTh}>
              <span className={`${s.dot} ${s.dotCoral}`} />
              Human
            </div>
            <div className={s.dcMapTh}>
              <span className={`${s.dot} ${s.dotAmber}`} />
              Hybrid
            </div>
            <div className={s.dcMapTh}>
              <span className={`${s.dot} ${s.dotMint}`} />
              Agent
            </div>
            <div className={s.dcMapThMeta}>Next move</div>
          </div>

          {ROWS.map((r, i) => {
            const on = i < revealCount;
            return (
              <div key={i} className={`${s.dcMapTr} ${on ? s.dcMapTrOn : ''}`} role="row">
                <div className={s.dcMapFn}>
                  <span className={s.dcMapRownum}>{String(i + 1).padStart(2, '0')}</span>
                  {r.fn}
                </div>
                <Cell active={r.alloc === 'human' && on} tone="coral" />
                <Cell active={r.alloc === 'hybrid' && on} tone="amber" />
                <Cell active={r.alloc === 'agent' && on} tone="mint" />
                <div className={`${s.dcMapOwner} ${on ? s.dcMapOwnerOn : ''}`}>
                  <span className={`${s.dcMove} ${s[MOVE_CLASS[r.move]]}`}>{r.move}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className={s.dcMapFoot}>
          <div className={s.dcMapTotals}>
            <Total tone="coral" pct={PCT.human} label="human led" />
            <Total tone="amber" pct={PCT.hybrid} label="hybrid" />
            <Total tone="mint" pct={PCT.agent} label="agent run" />
          </div>
          <div className={s.dcMapFootNote}>
            Sample blueprint. Allocations and moves are illustrative. Yours will map your own
            capabilities.
          </div>
        </div>
      </div>
    </div>
  );
}

function Cell({ active, tone }: { active: boolean; tone: 'coral' | 'amber' | 'mint' }) {
  const toneClass = tone === 'coral' ? s.dcCoral : tone === 'amber' ? s.dcAmber : s.dcMint;
  return (
    <div className={`${s.dcMapCell} ${active ? `${s.dcMapCellOn} ${toneClass}` : ''}`} />
  );
}

function Total({
  tone,
  pct,
  label,
}: {
  tone: 'coral' | 'amber' | 'mint';
  pct: number;
  label: string;
}) {
  const toneClass =
    tone === 'coral' ? s.dcTotalCoral : tone === 'amber' ? s.dcTotalAmber : s.dcTotalMint;
  return (
    <div className={`${s.dcTotal} ${toneClass}`}>
      <div className={s.dcTotalNum}>
        {pct}
        <span>%</span>
      </div>
      <div className={s.dcTotalLabel}>{label}</div>
    </div>
  );
}
