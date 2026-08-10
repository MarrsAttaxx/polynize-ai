'use client';

import { useEffect, useRef, useState } from 'react';
import { MAP_CLUSTERS, type MapCap } from './capability-map-data';
import s from './capability-map.module.css';

/**
 * The capability map, as the result section of /capability-mapping.
 *
 * Ported from the visual in app/blueprint/BlueprintDoc.tsx rather than imported from
 * it. That component is welded into a 700 line client page and typed to SalesBlueprint,
 * so importing it would drag the whole blueprint data layer onto a marketing page. The
 * anatomy is the same on purpose, because a visitor who books a call should recognise
 * the thing they are handed.
 *
 * WHAT IT ARGUES, and why it is not the matrix. The matrix on /mapping answers "what can
 * my people do". This answers a different question: "which parts of this work are human,
 * which are agentic, and which are both". The human lane is drawn with exactly the same
 * weight as the other two. The point of the map is finding where judgment must stay, not
 * only where execution can be offloaded, and a map that treated the human column as
 * leftovers would argue the opposite.
 *
 * REVEAL. Rows light in sequence via CSS transition-delay computed at render, so there
 * are no per-row timers and no re-renders while it plays. It is armed only on the
 * client, so the server-rendered markup is never hidden, and a failsafe lights
 * everything after two seconds in case the observer never fires. Under reduced motion
 * it is simply there.
 *
 * The example is illustrative. Nothing here is a client's real map.
 */

const LANES = ['human', 'hybrid', 'agentic'] as const;
type Lane = (typeof LANES)[number];

const LANE_CLASS: Record<Lane, string> = { human: s.lHuman, hybrid: s.lHybrid, agentic: s.lAgentic };

export function CapabilityMapExample() {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [armed, setArmed] = useState(false);
  const [on, setOn] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const el = wrapRef.current;
    if (!el) return;
    if (mq.matches) {
      setOn(true);
      return;
    }
    // Arm only now, on the client, so the server-rendered markup is never hidden.
    setArmed(true);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setOn(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.1 }
    );
    io.observe(el);
    // Some environments never deliver an observer callback at all, and a map that stays
    // hidden waiting for one is a blank section. Light it regardless.
    const failsafe = window.setTimeout(() => setOn(true), 2000);
    return () => {
      io.disconnect();
      window.clearTimeout(failsafe);
    };
  }, []);

  const counts = MAP_CLUSTERS.flatMap((cl) => cl.caps).reduce(
    (acc, c) => ({ ...acc, [c.lane]: acc[c.lane] + 1 }),
    { human: 0, hybrid: 0, agentic: 0 } as Record<Lane, number>
  );

  let row = -1;

  return (
    <div className={s.wrap} ref={wrapRef}>
      <div className={s.key}>
        <span className={s.keyItem}>
          <i className={`${s.keyDot} ${s.kHuman}`} />Human
        </span>
        <span className={s.keyItem}>
          <i className={`${s.keyDot} ${s.kHybrid}`} />Hybrid
        </span>
        <span className={s.keyItem}>
          <i className={`${s.keyDot} ${s.kAgentic}`} />Agentic
        </span>
      </div>

      <div className={`${s.map} ${armed ? s.armed : ''} ${on ? s.on : ''}`}>
        <div className={s.head}>
          <span className={`${s.hCell} ${s.hFirst}`}>Capability</span>
          <span className={`${s.hCell} ${s.hHuman}`}>Human</span>
          <span className={`${s.hCell} ${s.hHybrid}`}>Hybrid</span>
          <span className={`${s.hCell} ${s.hAgentic}`}>Agentic</span>
        </div>

        {MAP_CLUSTERS.map((cl) => (
          <div key={cl.name}>
            <div className={s.cluster}>
              <span className={s.clusterName}>{cl.name}</span>
              <span className={s.clusterNote}>{cl.note}</span>
            </div>
            {cl.caps.map((cap) => {
              row++;
              const isOpen = open === cap.id;
              return (
                <Row
                  key={cap.id}
                  cap={cap}
                  isOpen={isOpen}
                  delay={reduced ? undefined : 120 + row * 55}
                  onToggle={() => setOpen(isOpen ? null : cap.id)}
                />
              );
            })}
          </div>
        ))}

        <div className={s.foot}>
          <b>{counts.human}</b> human · <b>{counts.hybrid}</b> hybrid · <b>{counts.agentic}</b>{' '}
          agentic. An illustrative map of one bottleneck.
        </div>
      </div>
    </div>
  );
}

function Row({
  cap,
  isOpen,
  delay,
  onToggle,
}: {
  cap: MapCap;
  isOpen: boolean;
  delay?: number;
  onToggle: () => void;
}) {
  return (
    <div className={`${s.capWrap} ${LANE_CLASS[cap.lane]}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      <button type="button" className={s.row} onClick={onToggle} aria-expanded={isOpen}>
        <span className={s.rowLabel}>
          <span className={`${s.chev} ${isOpen ? s.chevOpen : ''}`} aria-hidden="true">
            ⌄
          </span>
          <span className={s.rowId}>{cap.id}</span>
          <span className={s.rowName}>{cap.name}</span>
        </span>
        {LANES.map((lane) => (
          <span
            key={lane}
            className={`${s.cell} ${cap.lane === lane ? s.lit : ''} ${LANE_CLASS[lane]}`}
            aria-hidden="true"
          />
        ))}
        <span className={s.srOnly}>allocated to {cap.lane}</span>
      </button>
      {isOpen && (
        <div className={s.detail}>
          <p className={s.detailLine}>{cap.detail}</p>
          <ul className={s.tasks}>
            {cap.tasks.map((t) => (
              <li key={t}>
                <span className={s.plus}>+</span>
                {t}
              </li>
            ))}
          </ul>
          <div className={s.why}>
            <span className={s.whyLabel}>Why this lane</span>
            {cap.why}
          </div>
        </div>
      )}
    </div>
  );
}
