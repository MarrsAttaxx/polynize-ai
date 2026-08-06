'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  COHORT_SUMMARY,
  MATRIX_SCENARIOS,
  MATRIX_USERS,
  cellDetail,
  cellFor,
  scTier,
  upTier,
  type Tier,
} from './matrix-data';
import s from './matrix.module.css';

/**
 * The capability matrix as live DOM, ported from the ATE deck.
 *
 * Replaces the 538KB screenshot that used to sit here. Three things that buys us:
 * it reflows on a phone instead of being crushed to unreadable texture, it picks up
 * brand tokens so the coming rebrand flows through, and cells can be opened.
 *
 * Reveal is staggered via CSS transition-delay computed at render, so there are no
 * per-cell timers and no re-renders while it plays. Strong cells land first, which
 * is how the deck does it and it reads as the map resolving rather than fading.
 * Under prefers-reduced-motion every delay collapses to zero and it is simply there.
 *
 * The numbers are synthetic (see matrix-data.ts). Caption accordingly.
 */

type Opened = { handle: string; cap: string; scenario: string; scenarioName: string } | null;

export function CapabilityMatrix() {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [on, setOn] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [opened, setOpened] = useState<Opened>(null);

  const [armed, setArmed] = useState(false);

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
      { threshold: 0.12 }
    );
    io.observe(el);
    // Safety net. Some environments never deliver an observer callback at all, and a
    // matrix that stays hidden waiting for one is a blank page, so reveal regardless.
    const failsafe = window.setTimeout(() => setOn(true), 2000);
    return () => {
      io.disconnect();
      window.clearTimeout(failsafe);
    };
  }, []);

  // Escape closes the detail panel.
  useEffect(() => {
    if (!opened) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpened(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [opened]);

  const nScn = MATRIX_SCENARIOS.length;

  // 1 label column, then 3 columns per scenario with a spacer between groups.
  const gridTemplateColumns = useMemo(
    () =>
      `minmax(112px, 168px) ` +
      MATRIX_SCENARIOS.map((_, j) => `repeat(3, minmax(46px, 1fr))${j < nScn - 1 ? ' 14px' : ''}`).join(' '),
    [nScn]
  );

  const delay = (ms: number) => (reduced ? undefined : { transitionDelay: `${ms}ms` });

  let headerIdx = 0;

  return (
    <div className={s.wrap} ref={wrapRef}>
      <div
        className={`${s.grid} ${armed ? s.armed : ''} ${on ? s.on : ''}`}
        style={{ gridTemplateColumns }}
        role="table"
        aria-label="Example team capability matrix"
      >
        {/* Corner */}
        <div className={s.corner} style={{ gridRow: '1 / span 3', gridColumn: 1, ...delay(40) }}>
          <span className={s.allUsers}>All users</span>
          <span className={s.allSub}>{COHORT_SUMMARY}</span>
        </div>

        {/* Scenario headers and capability chips */}
        {MATRIX_SCENARIOS.map((scn, j) => {
          const base = 2 + j * 4;
          const head = (
            <div
              key={`h${j}`}
              className={s.scn}
              style={{ gridRow: 1, gridColumn: `${base} / span 3`, ...delay(60 + headerIdx++ * 24) }}
            >
              <span className={s.scnTag}>{scn.tag}</span>
              <span className={s.scnName}>{scn.name}</span>
            </div>
          );
          const chips = scn.caps.flatMap((row, rw) =>
            row.map((cap, c) =>
              cap ? (
                <div
                  key={`c${j}-${rw}-${c}`}
                  className={`${s.cap} ${s[scn.cat]}`}
                  style={{ gridRow: 2 + rw, gridColumn: base + c, ...delay(140 + headerIdx++ * 12) }}
                >
                  {cap}
                </div>
              ) : null
            )
          );
          return [head, ...chips];
        })}

        {/* Users and their cells */}
        {MATRIX_USERS.map((u, i) => {
          const rowTop = 4 + i * 2;
          const nodes = [
            <div
              key={`u${i}`}
              className={s.user}
              style={{ gridRow: `${rowTop} / span 2`, gridColumn: 1, ...delay(240 + i * 26) }}
            >
              <span className={s.userHandle}>{u.h}</span>
              <span className={s.userBar}>
                <i style={{ width: `${Math.min(100, u.up * 1.8)}%` }} />
              </span>
            </div>,
          ];

          MATRIX_SCENARIOS.forEach((scn, j) => {
            const base = 2 + j * 4;
            scn.caps.forEach((row, rw) => {
              row.forEach((cap, c) => {
                const key = `m${i}-${j}-${rw}-${c}`;
                if (!cap) {
                  nodes.push(
                    <div
                      key={key}
                      className={`${s.cell} ${s.empty}`}
                      style={{ gridRow: rowTop + rw, gridColumn: base + c, ...delay(0) }}
                      aria-hidden="true"
                    />
                  );
                  return;
                }
                const cell = cellFor(i, j, rw, c);
                const tier: Tier = cell.t === 'sc' ? scTier(cell.v) : upTier(cell.v);
                // Strong cells land first so the map reads as resolving.
                const priority = tier === 'g' || tier === 't' ? 0 : 1;
                const order = i * 6 + j * 2 + rw + c;
                nodes.push(
                  <button
                    key={key}
                    type="button"
                    className={`${s.cell} ${cell.t === 'sc' ? s.score : s.uplift} ${s[`t_${tier}`]}`}
                    style={{
                      gridRow: rowTop + rw,
                      gridColumn: base + c,
                      ...delay(420 + priority * 260 + order * 7),
                    }}
                    onClick={() =>
                      setOpened({ handle: u.h, cap, scenario: scn.tag, scenarioName: scn.name })
                    }
                    aria-label={`${u.h}, ${cap}, ${scn.name}: ${
                      cell.t === 'sc' ? `score ${cell.v}` : `uplift ${cell.v} percent`
                    }. Open detail.`}
                  >
                    {cell.t === 'sc' ? cell.v.toFixed(1) : `↗ +${cell.v}%`}
                  </button>
                );
              });
            });
          });

          return nodes;
        })}
      </div>

      {opened && <CellDetail opened={opened} onClose={() => setOpened(null)} />}
    </div>
  );
}

function CellDetail({ opened, onClose }: { opened: NonNullable<Opened>; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => closeRef.current?.focus(), []);
  const d = cellDetail(opened.handle, opened.cap);
  const peak = Math.max(...d.attempts, 1);

  return (
    <div className={s.overlay} onClick={onClose} role="presentation">
      <div
        className={s.modal}
        role="dialog"
        aria-modal="true"
        aria-label={`${opened.cap} detail`}
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={closeRef} type="button" className={s.close} onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className={s.mScnTag}>{opened.scenario}</div>
        <div className={s.mScnName}>{opened.scenarioName}</div>
        <h3 className={s.mCap}>{opened.cap}</h3>
        <div className={s.mWho}>{opened.handle}</div>

        <div className={s.mStats}>
          <Stat label="CQ" value={String(d.cq)} accent />
          <Stat label="Rank" value={`${d.rank} of 44`} />
          <Stat label="Percentile" value={`${d.percentile}%`} />
          <Stat label="Time" value={d.time} />
        </div>

        <div className={s.mTrajLabel}>Attempts</div>
        <div className={s.mTraj}>
          {d.attempts.map((a, i) => (
            <div key={i} className={s.mTrajRow}>
              <span className={s.mTrajN}>{i + 1}</span>
              <span className={s.mTrajBar}>
                <i style={{ width: `${(a / peak) * 100}%` }} />
              </span>
              <span className={s.mTrajV}>{a}</span>
            </div>
          ))}
        </div>

        <p className={s.mNote}>Example data, shown to illustrate the format.</p>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={s.stat}>
      <span className={s.statLabel}>{label}</span>
      <span className={`${s.statValue} ${accent ? s.statAccent : ''}`}>{value}</span>
    </div>
  );
}
