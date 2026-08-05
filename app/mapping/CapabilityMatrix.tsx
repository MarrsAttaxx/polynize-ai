'use client';

import { useEffect, useRef, useState } from 'react';
import s from './mapping.module.css';

/**
 * The capability matrix: the hero asset. Workflows across the top, capability
 * down the side, each cell coloured by how well the team demonstrates that
 * capability in that part of the work. The gaps read red, which is the whole
 * point of the picture (see the podcast cut: "you can actually see the pain").
 *
 * Illustrative sample data (a go to market team), not a real client map. Cells
 * reveal one at a time once the matrix scrolls into view.
 */

// 0 = gap (coral), 1 = developing (amber), 2 = strong (mint)
type Level = 0 | 1 | 2;

const WORKFLOWS = ['Prospecting', 'Discovery', 'Framing value', 'Proposal', 'Negotiation', 'Close', 'Handover'];

const CAPABILITIES: { label: string; row: Level[] }[] = [
  { label: 'Reading the buyer', row: [2, 2, 1, 1, 0, 1, 2] },
  { label: 'Commercial judgement', row: [1, 1, 2, 2, 0, 0, 1] },
  { label: 'Handling objections', row: [1, 0, 0, 1, 0, 1, 2] },
  { label: 'Telling the story', row: [2, 2, 2, 1, 1, 2, 2] },
  { label: 'Using the tools', row: [0, 0, 1, 1, 2, 2, 1] },
  { label: 'Following through', row: [1, 1, 1, 0, 1, 2, 0] },
];

const TOTAL_CELLS = CAPABILITIES.length * WORKFLOWS.length;
const LEVEL_CLASS = ['lvGap', 'lvDev', 'lvStrong'] as const;

export function CapabilityMatrix() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          io.disconnect();
          let i = 0;
          const iv = setInterval(() => {
            i += 3; // reveal a few cells per tick so a 42-cell grid fills quickly
            setRevealed(i);
            if (i >= TOTAL_CELLS) clearInterval(iv);
          }, 45);
          return;
        }
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  let cellIndex = -1;

  return (
    <div className={s.matrixFrame} ref={ref}>
      <div className={s.matrixHead}>
        <span className={s.matrixEyebrow}>Team capability map</span>
        <div className={s.matrixLegend} aria-hidden="true">
          <span className={s.legItem}><i className={`${s.legDot} ${s.lvStrong}`} />Strong</span>
          <span className={s.legItem}><i className={`${s.legDot} ${s.lvDev}`} />Developing</span>
          <span className={s.legItem}><i className={`${s.legDot} ${s.lvGap}`} />Gap</span>
        </div>
      </div>

      <div className={s.matrixScroll}>
        {/* Flat grid so headers, row labels and cells all align to the same tracks. */}
        <div className={s.matrixGrid} style={{ ['--cols' as string]: WORKFLOWS.length }} role="grid">
          <div className={s.matrixCorner} aria-hidden="true" />
          {WORKFLOWS.map((w) => (
            <div key={w} className={s.matrixColHead}>{w}</div>
          ))}

          {CAPABILITIES.map((cap) => (
            <div key={cap.label} className={s.matrixRowContents} role="row">
              <div className={s.matrixRowHead}>{cap.label}</div>
              {cap.row.map((lvl, c) => {
                cellIndex++;
                const on = cellIndex < revealed;
                return (
                  <div
                    key={c}
                    className={`${s.matrixCell} ${on ? s[LEVEL_CLASS[lvl]] : ''} ${on ? s.cellOn : ''}`}
                    role="gridcell"
                    aria-label={`${cap.label}, ${WORKFLOWS[c]}: ${['gap', 'developing', 'strong'][lvl]}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
