'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CAP_GLOSS,
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
 *
 * SIMPLIFIED 10 Aug 2026 on Marrs's note. The cells used to print figures (55.0, +31%)
 * and it read as a spreadsheet a visitor had to decode before the point landed. Cells
 * now carry a single arrow, so the grid is scanned as a picture: which way is this
 * person going on this capability, and colour says how far along they are. The legend
 * moved ABOVE the grid for the same reason, since a key underneath is a key you read
 * after you have already given up.
 */

/**
 * Arrows on the extremes ONLY. A glyph in every cell put marks on all two hundred and
 * the grid went straight back to being busy, which is the thing the arrows were meant
 * to fix. Only the strongest and the weakest are marked, so the eye has somewhere to
 * land; the middle is carried by colour alone, which is all it has to say.
 *
 * It keys off BOTH axes, because they are independent: `.score` cells are filled and
 * `.uplift` cells are outlined, so "solid green" is shape AND tier, not tier alone.
 * Note tier r is currently unreachable (cellFor's floor is above scTier's r threshold),
 * so the red end of the scale in practice is o.
 */
const arrowFor = (shape: 'sc' | 'up', tier: Tier) => {
  if (shape === 'sc' && (tier === 'g' || tier === 't')) return '↗';
  if (tier === 'o' || tier === 'r') return '↘';
  return '';
};

const TIER_WORD: Record<Tier, string> = {
  g: 'strong',
  t: 'strong',
  a: 'developing',
  o: 'a gap',
  r: 'a gap',
};

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
      {/* Above the grid, not below it. A key underneath is a key you read after you have
          already decided the picture is too complicated. */}
      <div className={s.key}>
        <span className={s.keyItem}>
          <i className={`${s.keyDot} ${s.keyMint}`} />Strong
        </span>
        <span className={s.keyItem}>
          <i className={`${s.keyDot} ${s.keyAmber}`} />Developing
        </span>
        <span className={s.keyItem}>
          <i className={`${s.keyDot} ${s.keyCoral}`} />Gap
        </span>
      </div>
      <div
        className={`${s.grid} ${armed ? s.armed : ''} ${on ? s.on : ''}`}
        style={{ gridTemplateColumns }}
        role="table"
        aria-label="Example team capability matrix"
      >
        {/* Corner */}
        <div className={s.corner} style={{ gridRow: '1 / span 3', gridColumn: 1, ...delay(40) }}>
          <span className={s.allUsers}>Users</span>
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
                    aria-label={`${u.h}, ${cap}, ${scn.name}: ${TIER_WORD[tier]}. Open detail.`}
                  >
                    {arrowFor(cell.t, tier)}
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
        {CAP_GLOSS[opened.cap] && <p className={s.mGloss}>{CAP_GLOSS[opened.cap]}</p>}
        <div className={s.mWho}>{opened.handle}</div>

        <p className={s.mLead}>
          See how your people perform over time in scenarios built from the work they
          actually do.
        </p>

        <div className={s.mTrajLabel}>Attempts</div>
        <div className={s.mTraj}>
          {d.attempts.map((a, i) => (
            <div key={i} className={s.mTrajRow}>
              <span className={s.mTrajN}>{i + 1}</span>
              <span className={s.mTrajBar}>
                <i style={{ width: `${(a / peak) * 100}%` }} />
              </span>
            </div>
          ))}
        </div>

        <ul className={s.mPoints}>
          <li>Scored against the benchmark for the role, not against each other.</li>
          <li>Every response is kept, so you can see how the reading was reached.</li>
          <li>Run the map again later and watch the same cell move.</li>
        </ul>

        <p className={s.mNote}>An example cell, shown to illustrate the format.</p>
      </div>
    </div>
  );
}
