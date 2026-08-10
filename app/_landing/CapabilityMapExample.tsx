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
        <div className={s.empty}>
          <button
            type="button"
            className={`${s.bigCta} ${reduced ? '' : s.pulse}`}
            onClick={openPicker}
          >
            Map a team
          </button>
          <p className={s.emptyNote}>
            Pick any team in a business like yours and see the map it produces.
          </p>
        </div>
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
              <p className={s.pickNote}>
                A business of this shape has these functions. Pick one and we will map it.
              </p>
            </div>

            <div className={s.org}>
              {lead && (
                <button
                  type="button"
                  ref={firstRef}
                  className={`${s.orgBox} ${s.orgLead}`}
                  onClick={() => onChoose(lead.id)}
                >
                  <span className={s.orgName}>{lead.name}</span>
                  <span className={s.orgNote}>{lead.note}</span>
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
                    <span className={s.orgName}>{t.name}</span>
                    <span className={s.orgNote}>{t.note}</span>
                  </button>
                ))}
              </div>
            </div>

            <p className={s.pickFoot}>
              A real engagement maps your own teams, from your own material. This is a
              generalised example.
            </p>
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
