'use client';

/**
 * Teleprompter (T3). Full-screen, chrome-less, one section at a time. Advance
 * section-by-section (not scrolling) so the talent can do several takes of a
 * section then move on. Driven by:
 *   - a remote / clicker or keyboard: → · ↓ · space · PageDown = next; ← · ↑ ·
 *     PageUp = prev (a Bluetooth presenter sends these keys);
 *   - tap zones: right half = next, left half = prev (iPad touch).
 *
 * MIRRORED, SIZED AND CENTRED (2026-08-05, Marrs). He reads it off beam-splitter glass, which
 * reverses the image, so the text must be flipped horizontally or it is unreadable on set.
 * That is a setting rather than a default because the same page is also read straight off a
 * laptop while writing. Both it and the text size persist per device in localStorage: they are
 * properties of the RIG, not of the piece, and nobody wants to set them again every take.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import t from './teleprompter.module.css';

const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Spacebar']);
const PREV_KEYS = new Set(['ArrowLeft', 'ArrowUp', 'PageUp']);

/** Reading distance varies with the rig, so the range is wide and the steps are coarse. */
const SIZES = [40, 52, 64, 78, 94, 112, 132] as const;
const DEFAULT_SIZE = 3;

export function Teleprompter({
  title,
  sections,
  backHref,
}: {
  title: string;
  sections: string[];
  backHref: string;
}) {
  const total = sections.length;
  const [i, setI] = useState(0);
  const [mirror, setMirror] = useState(false);
  const [sizeIx, setSizeIx] = useState(DEFAULT_SIZE);
  const [chromeOn, setChromeOn] = useState(true);

  // Rig settings live on the DEVICE. The iPad in the teleprompter is always mirrored; the
  // laptop never is. Storing them per piece would be wrong and storing them not at all would
  // mean setting them before every take.
  useEffect(() => {
    try {
      const m = window.localStorage.getItem('pam.prompter.mirror');
      const z = window.localStorage.getItem('pam.prompter.size');
      if (m === '1') setMirror(true);
      const n = Number(z);
      if (Number.isFinite(n) && n >= 0 && n < SIZES.length) setSizeIx(n);
    } catch {
      /* private mode: defaults are fine */
    }
  }, []);
  const persist = (key: string, value: string) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* nothing to do */
    }
  };
  const setMirrored = (on: boolean) => {
    setMirror(on);
    persist('pam.prompter.mirror', on ? '1' : '0');
  };
  const setSize = (n: number) => {
    const clamped = Math.max(0, Math.min(SIZES.length - 1, n));
    setSizeIx(clamped);
    persist('pam.prompter.size', String(clamped));
  };

  const next = useCallback(() => setI((n) => Math.min(n + 1, total - 1)), [total]);
  const prev = useCallback(() => setI((n) => Math.max(n - 1, 0)), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (NEXT_KEYS.has(e.key)) {
        e.preventDefault();
        next();
      } else if (PREV_KEYS.has(e.key)) {
        e.preventDefault();
        prev();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setSize(sizeIx + 1);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setSize(sizeIx - 1);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setMirrored(!mirror);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, sizeIx, mirror]);

  /**
   * FIT DOWN, never up. The chosen size is a MAXIMUM: a short beat shows at it, and a long one
   * shrinks until it fits. His beats run to two paragraphs, which at teleprompter size does not
   * fit an iPad, and the alternative failure is words being cut off the bottom mid-take, which
   * is far worse than a slightly smaller screenful. Measured after paint, on every change of
   * section or size.
   */
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [fitted, setFitted] = useState<number | null>(null);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let size: number = SIZES[sizeIx];
    el.style.fontSize = `${size}px`;
    // 94% of the viewport: a teleprompter needs air at the edges or it reads as cramped.
    const room = window.innerHeight * 0.94;
    let guard = 0;
    while (el.scrollHeight > room && size > 18 && guard++ < 40) {
      size = Math.floor(size * 0.94);
      el.style.fontSize = `${size}px`;
    }
    setFitted(size);
  }, [i, sizeIx, sections]);

  const block = sections[i] ?? '';
  const lines = block.split('\n');
  const hasHeader = lines.length > 1;
  const header = hasHeader ? lines[0] : '';
  const body = hasHeader ? lines.slice(1).join('\n') : block;

  return (
    <div className={t.root}>
      <div className={t.topbar}>
        <Link href={backHref} className={t.exit}>
          ✕ Exit
        </Link>
        <span className={t.title}>{title}</span>
        <span className={t.counter}>
          {total ? i + 1 : 0} / {total}
        </span>
      </div>

      {/* Tap zones sit behind the (non-interactive) stage so a tap anywhere
          advances: left half = prev, right half = next. */}
      <button
        type="button"
        className={`${t.zone} ${t.zoneLeft}`}
        onClick={prev}
        aria-label="Previous section"
      />
      <button
        type="button"
        className={`${t.zone} ${t.zoneRight}`}
        onClick={next}
        aria-label="Next section"
      />

      {/* MIRRORED here and nowhere else: only the words are flipped, so the controls and the
          counter stay readable to the operator standing beside the rig. */}
      <div
        ref={stageRef}
        className={`${t.stage} ${mirror ? t.mirrored : ''}`}
        style={{ fontSize: `${SIZES[sizeIx]}px` }}
      >
        {header && <div className={t.header}>{header}</div>}
        <div className={t.body}>{body || 'No script yet.'}</div>
      </div>

      {/* The rig controls. Hidden with one tap, because on a beam splitter anything bright is
          a reflection in the shot. */}
      {chromeOn ? (
        <div className={t.rig}>
          <button type="button" onClick={() => setSize(sizeIx - 1)} aria-label="Smaller text">
            A-
          </button>
          <span className={t.rigValue}>
            {fitted && fitted < SIZES[sizeIx] ? `${fitted}*` : SIZES[sizeIx]}
          </span>
          <button type="button" onClick={() => setSize(sizeIx + 1)} aria-label="Bigger text">
            A+
          </button>
          <button
            type="button"
            className={mirror ? t.rigOn : ''}
            onClick={() => setMirrored(!mirror)}
            aria-label="Mirror for teleprompter glass"
          >
            mirror
          </button>
          <button type="button" onClick={() => setChromeOn(false)} aria-label="Hide the controls">
            hide
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={t.rigShow}
          onClick={() => setChromeOn(true)}
          aria-label="Show the controls"
        >
          ⋯
        </button>
      )}

      <div className={t.hint} hidden={!chromeOn}>
        Tap right / left, or use a remote (arrows · space · page up/down). Keys: + and - size,
        m mirrors. A starred size means this beat was shrunk to fit rather than cut off.
      </div>
    </div>
  );
}
