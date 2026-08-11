'use client';

import { useEffect, useRef, useState } from 'react';
import { TEAMS, TEAM_BY_ID, type MapCap, type TeamId } from './capability-map-data';
import s from './capability-map.module.css';

/**
 * The capability map, as the result section of /capability-mapping.
 *
 * IT STARTS EMPTY, and that is the point. A map sitting there fully drawn is a
 * screenshot: a reader glances at it, decides it is a product shot, and scrolls. So the
 * section opens on one glowing button, and the reader picks their own team out of an org
 * chart and watches it get mapped. The same information, but they asked for it, which is
 * the difference between showing somebody a map and showing somebody THEIR map.
 *
 * The flow: button → org chart modal → pick a team → a beat of modelling → the map for
 * that team, with a pulsing "map a different team" where the legend used to be.
 *
 * THE LEGEND IS GONE (Marrs, 10 Aug 2026). Three columns headed HUMAN, HYBRID and
 * AGENTIC do not need a key underneath telling you that mint means agentic. That space
 * is worth more as the control that changes the map.
 *
 * Anatomy ported from app/blueprint/BlueprintDoc.tsx rather than imported from it. That
 * component is welded into a 700 line client page and typed to SalesBlueprint, so
 * importing it would drag the blueprint data layer onto a marketing page. The anatomy
 * matches on purpose, because a visitor who books a call should recognise the thing they
 * are handed.
 *
 * The human lane is drawn with exactly the same weight as the other two. The point of the
 * map is finding where judgment must stay, not only where execution can be offloaded, and
 * a map that treated human as leftovers would argue the opposite.
 *
 * The example is illustrative. Nothing here is a client's real map.
 */

const LANES = ['human', 'hybrid', 'agentic'] as const;
type Lane = (typeof LANES)[number];

const LANE_CLASS: Record<Lane, string> = { human: s.lHuman, hybrid: s.lHybrid, agentic: s.lAgentic };

/**
 * The blurred placeholder behind "click to reveal".
 *
 * It mirrors the ANATOMY of the real map exactly (lane header, cluster bands, one lit lane
 * per row, same 92px lane columns) and carries none of its content. That distinction is
 * the whole point: a reader should recognise the object they are about to be handed, and
 * should not be able to believe there is real data being withheld from them behind the
 * blur, because there is not. `lit` is the lane index, fixed so nothing shimmers between
 * renders.
 */
type GhostItem = { kind: 'cluster'; w: number } | { kind: 'row'; w: number; lit: 0 | 1 | 2 };

const GHOST: GhostItem[] = [
  { kind: 'cluster', w: 30 },
  { kind: 'row', w: 62, lit: 2 },
  { kind: 'row', w: 74, lit: 0 },
  { kind: 'row', w: 55, lit: 1 },
  { kind: 'cluster', w: 24 },
  { kind: 'row', w: 68, lit: 2 },
  { kind: 'row', w: 51, lit: 1 },
  { kind: 'row', w: 79, lit: 0 },
  { kind: 'cluster', w: 34 },
  { kind: 'row', w: 58, lit: 2 },
  { kind: 'row', w: 71, lit: 1 },
  { kind: 'row', w: 64, lit: 2 },
];
const GHOST_LANE = [s.lHuman, s.lHybrid, s.lAgentic] as const;

/** How long the modelling beat runs. Long enough to read, short enough not to annoy. */
const THINK_MS = 1250;

export function CapabilityMapExample() {
  const [teamId, setTeamId] = useState<TeamId | null>(null);
  const [picking, setPicking] = useState(false);
  const [thinking, setThinking] = useState<TeamId | null>(null);
  const [reduced, setReduced] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const returnFocus = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  // Escape closes whichever layer is on top.
  useEffect(() => {
    if (!picking && !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (open) setOpen(null);
      else if (picking && !thinking) closePicker();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picking, open, thinking]);

  function openPicker(e: React.MouseEvent<HTMLButtonElement>) {
    returnFocus.current = e.currentTarget;
    setPicking(true);
  }

  function closePicker() {
    setPicking(false);
    // Send focus back to the control that opened the modal, not to the top of the page.
    returnFocus.current?.focus();
  }

  function choose(id: TeamId) {
    setThinking(id);
    window.setTimeout(
      () => {
        setThinking(null);
        setPicking(false);
        setTeamId(id);
        setOpen(null);
      },
      reduced ? 0 : THINK_MS
    );
  }

  const team = teamId ? TEAM_BY_ID[teamId] : null;

  return (
    <div className={s.wrap}>
      {!team ? (
        /**
         * A blurred map you click through, not a button.
         *
         * It was a mint "Map a team" pill, which sat two inches from the page's real CTA
         * and read as a second attempt at the same ask (Marrs, 11 Aug 2026). This is the
         * opposite move: show the shape of the thing, withhold the detail, and make the
         * click feel like uncovering rather than submitting.
         *
         * The blurred rows are deliberately SCHEMATIC. No names, no numbers, no readable
         * text, so nothing here can be mistaken for real data being hidden from you.
         */
        <button
          type="button"
          className={`${s.reveal} ${reduced ? '' : s.revealBreathe}`}
          onClick={openPicker}
          aria-label="Reveal your capability map"
        >
          <span className={s.revealGhost} aria-hidden="true">
            {/* The lane header, in the lane colours, so the object is recognisable
                through the blur before a single word of it can be read. */}
            <span className={s.ghostHead}>
              <i />
              <i className={s.lHuman} />
              <i className={s.lHybrid} />
              <i className={s.lAgentic} />
            </span>
            {GHOST.map((g, r) =>
              g.kind === 'cluster' ? (
                <span key={r} className={s.ghostCluster}>
                  <i style={{ width: `${g.w}%` }} />
                </span>
              ) : (
                <span key={r} className={s.ghostRow}>
                  <i className={s.ghostLabel} style={{ width: `${g.w}%` }} />
                  {[0, 1, 2].map((c) => (
                    <i
                      key={c}
                      className={`${s.ghostCell} ${c === g.lit ? GHOST_LANE[c] : ''}`}
                    />
                  ))}
                </span>
              )
            )}
          </span>
          <span className={s.revealOverlay}>
            <span className={s.revealLabel}>Click to reveal your map</span>
            <span className={s.revealNote}>Pick a team and watch it get mapped</span>
          </span>
        </button>
      ) : (
        <>
          {/* Where the legend used to be. The control earns the space; a key does not. */}
          <div className={s.controls}>
            <button
              type="button"
              className={`${s.swapCta} ${reduced ? '' : s.pulseSoft}`}
              onClick={openPicker}
            >
              Map a different team
            </button>
          </div>

          <div className={s.map}>
            <div className={s.mapHead}>
              <span className={s.mapTeam}>{team.name}</span>
              <span className={s.mapTeamNote}>{team.note}</span>
            </div>

            <div className={s.head}>
              <span className={`${s.hCell} ${s.hFirst}`}>Capability</span>
              <span className={`${s.hCell} ${s.hHuman}`}>Human</span>
              <span className={`${s.hCell} ${s.hHybrid}`}>Hybrid</span>
              <span className={`${s.hCell} ${s.hAgentic}`}>Agentic</span>
            </div>

            {team.clusters.map((cl) => (
              <div key={cl.name}>
                <div className={s.cluster}>
                  <span className={s.clusterName}>{cl.name}</span>
                  <span className={s.clusterNote}>{cl.note}</span>
                </div>
                {cl.caps.map((c, i) => (
                  <Row
                    key={c.id}
                    cap={c}
                    isOpen={open === c.id}
                    delay={reduced ? undefined : i * 45}
                    onToggle={() => setOpen(open === c.id ? null : c.id)}
                  />
                ))}
              </div>
            ))}

            <div className={s.foot}>{countLine(team.clusters.flatMap((c) => c.caps))}</div>
          </div>
        </>
      )}

      {picking && (
        <TeamPicker
          thinking={thinking}
          reduced={reduced}
          onChoose={choose}
          onClose={closePicker}
        />
      )}
    </div>
  );
}

function countLine(caps: MapCap[]) {
  const n = caps.reduce(
    (acc, c) => ({ ...acc, [c.lane]: acc[c.lane] + 1 }),
    { human: 0, hybrid: 0, agentic: 0 } as Record<Lane, number>
  );
  return `${n.human} human · ${n.hybrid} hybrid · ${n.agentic} agentic. An illustrative map, generalised for a business of this shape.`;
}

/**
 * One glyph per function. Line art at a single weight, drawn from the same vocabulary as
 * the beat figures, so the modal belongs to the page rather than importing an icon set.
 */
function TeamGlyph({ id }: { id: TeamId }) {
  const c = 'currentColor';
  const common = { fill: 'none', stroke: c, strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const paths: Record<TeamId, React.ReactNode> = {
    // A crown of decisions: three peaks on a base.
    leadership: <path {...common} d="M3 17h18M4 17l1.5-8 4 4L12 6l2.5 7 4-4L20 17" />,
    // A rising line that lands on a target.
    sales: <path {...common} d="M3 18l6-6 4 3 5-7M15 8h3v3" />,
    // Broadcast: a horn and two waves.
    marketing: <path {...common} d="M4 10v4l7 3V7l-7 3zM15 9a4 4 0 010 6M18 7a7 7 0 010 10" />,
    // Ledger and coin.
    finance: <path {...common} d="M5 4h9l5 5v11H5zM14 4v5h5M9 15h6M9 12h3" />,
    // A cycle. A gear turns to mush at 22px; two arcs and two arrowheads do not.
    operations: <path {...common} d="M3.5 12a8.5 8.5 0 0114.6-5.9M18.5 3v3.6H15M20.5 12a8.5 8.5 0 01-14.6 5.9M5.5 21v-3.6H9" />,
    // Two figures.
    people: <path {...common} d="M9 11a3 3 0 100-6 3 3 0 000 6M3 20a6 6 0 0112 0M16 5.5a3 3 0 010 5.5M17 20a6 6 0 00-2-4.3" />,
    // A block being built out of blocks.
    product: <path {...common} d="M4 8l8-4 8 4-8 4zM4 8v8l8 4 8-4V8M12 12v8" />,
  };
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      {paths[id]}
    </svg>
  );
}

/* ------------------------------------------------------------------ the picker */

/**
 * A generic org chart. Leadership across the top, the functions beneath it.
 *
 * BUILT FROM HTML BUTTONS, NOT SVG, and deliberately: every box is a real control, so it
 * is reachable by keyboard and announced properly. The connector lines are CSS
 * pseudo-elements, which cost nothing and cannot trap focus the way an SVG hit area can.
 */
function TeamPicker({
  thinking,
  reduced,
  onChoose,
  onClose,
}: {
  thinking: TeamId | null;
  reduced: boolean;
  onChoose: (id: TeamId) => void;
  onClose: () => void;
}) {
  const firstRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => firstRef.current?.focus(), []);

  const lead = TEAMS.find((t) => t.tier === 'lead');
  const functions = TEAMS.filter((t) => t.tier === 'function');
  const busy = TEAMS.find((t) => t.id === thinking);

  return (
    <div className={s.overlay} onClick={thinking ? undefined : onClose} role="presentation">
      <div
        className={s.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Choose a team to map"
        aria-busy={Boolean(thinking)}
        onClick={(e) => e.stopPropagation()}
      >
        {!thinking && (
          <button type="button" className={s.close} onClick={onClose} aria-label="Close">
            ×
          </button>
        )}

        {busy ? (
          <div className={s.thinking}>
            <span className={`${s.spinner} ${reduced ? s.spinnerStill : ''}`} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <p className={s.thinkingLine}>Modelling {busy.name}</p>
            <p className={s.thinkingNote}>
              Breaking the work into capabilities and allocating each one.
            </p>
          </div>
        ) : (
          <>
            <div className={s.pickHead}>
              <span className={s.pickEyebrow}>The organisation</span>
              <h3 className={s.pickTitle}>Which team should we map?</h3>
            </div>

            <div className={s.org}>
              {lead && (
                <button
                  type="button"
                  ref={firstRef}
                  className={`${s.orgBox} ${s.orgLead}`}
                  onClick={() => onChoose(lead.id)}
                >
                  <span className={s.orgIcon} aria-hidden="true">
                    <TeamGlyph id={lead.id} />
                  </span>
                  <span className={s.orgName}>{lead.name}</span>
                </button>
              )}
              <div className={s.orgBus} aria-hidden="true" />
              <div className={s.orgRow}>
                {functions.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`${s.orgBox} ${s.orgTeam}`}
                    onClick={() => onChoose(t.id)}
                  >
                    <span className={s.orgIcon} aria-hidden="true">
                      <TeamGlyph id={t.id} />
                    </span>
                    <span className={s.orgName}>{t.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <p className={s.pickFoot}>Indicative only</p>
          </>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- one row */

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
    <div
      className={`${s.capWrap} ${LANE_CLASS[cap.lane]}`}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
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
