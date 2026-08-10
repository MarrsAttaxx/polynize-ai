'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CAP_GLOSS,
  COHORT_SUMMARY,
  HOTSPOT,
  MATRIX_SCENARIOS,
  MATRIX_USERS,
  cellDetail,
  scenarioCell,
  type ScenarioState,
} from './matrix-data';
import s from './matrix.module.css';

/**
 * The capability matrix as live DOM, ported from the ATE deck.
 *
 * SIMPLIFIED DRASTICALLY on 10 Aug 2026, and the reasoning is worth keeping because the
 * instinct is to add it all back. It used to print all five capability chips above every
 * scenario and score each one per person: 200 cells, fifteen columns, a wall a visitor
 * had to decode before the argument landed. It is now ONE cell per person per scenario,
 * forty in total, and a reader gets the shape of the team in about a second.
 *
 * The capabilities did not go away. They are what each cell is a reading OF, and they
 * are listed with their explanations when a cell is opened, which is the place where a
 * reader has actually asked for the detail.
 *
 * FOUR STATES, and the fourth is the honest one:
 *   green with an up arrow    moving, and demonstrably
 *   amber with no arrow       developing, and nothing more is claimed
 *   coral with a down arrow   a gap
 *   empty                     not completed. Blank rather than zero, because an empty
 *                             cell is a fact and a zero is a claim.
 *
 * IT READS AS A HEAT MAP, which is a decision about the data rather than the styling.
 * Red is confined to one column and every other column is green and amber. A matrix with
 * gaps scattered evenly says "everyone is a bit weak everywhere", which is a shrug;
 * concentrated in one scenario it says this team cannot price work with the tool they
 * have, and that is where the money should go. The column is framed and badged so a
 * reader who looks for two seconds still leaves with the finding.
 *
 * Reveal is staggered via CSS transition-delay computed at render, so there are no
 * per-cell timers and no re-renders while it plays. Strong cells land first, which reads
 * as the map resolving rather than fading. Under prefers-reduced-motion every delay
 * collapses to zero and it is simply there.
 *
 * The figures are synthetic (see matrix-data.ts). Caption accordingly.
 */

type Opened = { handle: string; scenarioIdx: number } | null;

const STATE_CLASS: Record<ScenarioState, string> = {
  strong: s.sStrong,
  developing: s.sDeveloping,
  gap: s.sGap,
  none: s.sNone,
};

/** Colour carries how far along. The arrow carries direction, and survives colour blindness. */
const STATE_ARROW: Record<ScenarioState, string> = {
  strong: '↗',
  developing: '',
  gap: '↘',
  none: '',
};

const STATE_WORD: Record<ScenarioState, string> = {
  strong: 'strong',
  developing: 'developing',
  gap: 'a gap',
  none: 'not completed',
};

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

  const gridTemplateColumns = useMemo(
    () => `minmax(120px, 200px) repeat(${MATRIX_SCENARIOS.length}, minmax(78px, 1fr))`,
    []
  );

  const delay = (ms: number) => (reduced ? undefined : { transitionDelay: `${ms}ms` });

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

      <div className={s.scroll}>
        <div
          className={`${s.grid} ${armed ? s.armed : ''} ${on ? s.on : ''}`}
          style={{ gridTemplateColumns }}
          role="table"
          aria-label="Example team capability matrix"
        >
          <div className={s.corner} style={{ gridRow: 1, gridColumn: 1, ...delay(40) }}>
            <span className={s.allUsers}>Users</span>
            <span className={s.allSub}>{COHORT_SUMMARY}</span>
          </div>

          {/* The frame around the hotspot column. Spans the header and every user row,
              so the whole column reads as one finding rather than eight bad cells.
              gridRow is counted, not written as 1 / -1: every row here is explicit and
              -1 would resolve against a row template that does not exist. */}
          <div
            className={s.hot}
            style={{ gridColumn: 2 + HOTSPOT, gridRow: `1 / ${MATRIX_USERS.length + 2}` }}
            aria-hidden="true"
          />

          {MATRIX_SCENARIOS.map((scn, j) => (
            <div
              key={`h${j}`}
              className={`${s.scn} ${j === HOTSPOT ? s.scnHot : ''}`}
              style={{ gridRow: 1, gridColumn: 2 + j, ...delay(60 + j * 40) }}
            >
              <span className={s.scnTag}>{scn.tag}</span>
              <span className={s.scnName}>{scn.name}</span>
              {scn.flag && <span className={s.scnFlag}>{scn.flag}</span>}
            </div>
          ))}

          {MATRIX_USERS.map((u, i) => {
            const row = 2 + i;
            return (
              <div key={`r${i}`} style={{ display: 'contents' }}>
                <div
                  className={s.user}
                  style={{ gridRow: row, gridColumn: 1, ...delay(240 + i * 30) }}
                >
                  <span className={s.userHandle}>{u.h}</span>
                  <span className={s.userBar}>
                    <i style={{ width: `${Math.min(100, u.up * 1.8)}%` }} />
                  </span>
                </div>

                {MATRIX_SCENARIOS.map((scn, j) => {
                  const state = scenarioCell(i, j);
                  if (state === 'none') {
                    return (
                      <div
                        key={`c${i}-${j}`}
                        className={`${s.cell} ${s.sNone}`}
                        style={{ gridRow: row, gridColumn: 2 + j, ...delay(0) }}
                        aria-hidden="true"
                      />
                    );
                  }
                  // Strong cells land first, so the map reads as resolving.
                  const priority = state === 'strong' ? 0 : 1;
                  return (
                    <button
                      key={`c${i}-${j}`}
                      type="button"
                      className={`${s.cell} ${STATE_CLASS[state]}`}
                      style={{
                        gridRow: row,
                        gridColumn: 2 + j,
                        ...delay(420 + priority * 240 + (i * 5 + j) * 18),
                      }}
                      onClick={() => setOpened({ handle: u.h, scenarioIdx: j })}
                      aria-label={`${u.h}, ${scn.name}: ${STATE_WORD[state]}. Open detail.`}
                    >
                      {STATE_ARROW[state]}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {opened && <CellDetail opened={opened} onClose={() => setOpened(null)} />}
    </div>
  );
}

function CellDetail({ opened, onClose }: { opened: NonNullable<Opened>; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => closeRef.current?.focus(), []);
  const scn = MATRIX_SCENARIOS[opened.scenarioIdx];
  const caps = scn.caps.flat().filter((c): c is string => Boolean(c));
  const d = cellDetail(opened.handle, scn.name);
  const peak = Math.max(...d.attempts, 1);

  return (
    <div className={s.overlay} onClick={onClose} role="presentation">
      <div
        className={s.modal}
        role="dialog"
        aria-modal="true"
        aria-label={`${scn.name} detail`}
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={closeRef} type="button" className={s.close} onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className={s.mScnTag}>{scn.tag}</div>
        <h3 className={s.mCap}>{scn.name}</h3>
        <div className={s.mWho}>{opened.handle}</div>

        <p className={s.mLead}>
          See how your people perform over time in scenarios built from the work they
          actually do.
        </p>

        {/* The capability chips used to sit on the grid. This is where they went, and it
            is a better home: a reader who has opened a cell has asked what is inside it. */}
        <div className={s.mTrajLabel}>What the reading is made of</div>
        <ul className={s.mCaps}>
          {caps.map((cap) => (
            <li key={cap}>
              <span className={s.mCapName}>{cap}</span>
              {CAP_GLOSS[cap] && <span className={s.mCapGloss}>{CAP_GLOSS[cap]}</span>}
            </li>
          ))}
        </ul>

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
