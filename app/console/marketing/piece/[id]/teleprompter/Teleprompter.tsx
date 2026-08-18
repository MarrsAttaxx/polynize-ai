'use client';

/**
 * Teleprompter. A CONTINUOUS SCROLL of the whole script, flipped for beam-splitter glass.
 *
 * It used to page section by section, advanced by taps and a clicker. Marrs replaced that after
 * using it: "instead of tapped for next section, can we just make it a straight scroll, because
 * I have a mouse that I'm hiding on my desk." That is how a real prompter works, and it is
 * better for the same reason the prezie is better than a deck: he stops executing steps and
 * starts reading at his own pace, embellishing where he wants without falling out of sync with
 * a mechanism.
 *
 * What that change removed, as well as added:
 *   - the fit-down that shrank a long beat to fit one screen is GONE, and with it the whole
 *     problem it solved. Nothing has to fit any more; it scrolls.
 *   - the tap zones are gone. A stray touch on a prompter is a lost place in the script.
 *
 * Controls: the wheel (or a hidden mouse) scrolls; auto-scroll runs at an adjustable speed;
 * size and flip persist per DEVICE, because they belong to the rig and not to the piece.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import t from './teleprompter.module.css';

/** Reading distance varies with the rig, so the range is wide and the steps are coarse. */
const SIZES = [40, 52, 64, 78, 94, 112, 132] as const;
const DEFAULT_SIZE = 3;

/**
 * Auto-scroll speeds in pixels per second.
 *
 * Roughly: 30 is a slow, deliberate delivery at 78px type, 60 is a normal speaking pace, and
 * the top of the range is for scanning back to a mark rather than for reading.
 */
const SPEEDS = [12, 20, 30, 42, 60, 84, 120] as const;
const DEFAULT_SPEED = 2;

export function Teleprompter({
  title,
  sections,
  backHref,
}: {
  title: string;
  sections: string[];
  backHref: string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  /**
   * ONE AXIS: VERTICAL. Exposing both axes answered the question that could not be answered from
   * theory here, and the answer was that the rig needs the vertical flip alone: "flip is the
   * button I need, so we can take mirror off because the flip is doing the right thing."
   *
   * Which retro-diagnoses the original bug. The single `mirror` button was not missing an axis,
   * it was on the WRONG one: it had always applied scaleX, and this rig needs scaleY. That is why
   * it never worked, and why adding a second axis felt like the fix.
   *
   * Horizontal is therefore gone rather than hidden, because on set a button that does nothing
   * useful is worse than a missing one. Restoring it is a `flipH` boolean and one more term in
   * the transform, if a different rig ever needs it.
   */
  const [flipV, setFlipV] = useState(false);
  const [sizeIx, setSizeIx] = useState(DEFAULT_SIZE);
  const [speedIx, setSpeedIx] = useState(DEFAULT_SPEED);
  const [running, setRunning] = useState(false);
  const [chromeOn, setChromeOn] = useState(true);

  // Rig settings live on the DEVICE: the iPad in the hood is always flipped and the laptop
  // never is, so storing them per piece would be wrong, and not storing them at all would mean
  // setting them before every take.
  useEffect(() => {
    try {
      if (window.localStorage.getItem('pam.prompter.flipv') === '1') setFlipV(true);
      // The retired horizontal key is actively CLEARED, not merely ignored. A device that set it
      // while it existed would otherwise load a horizontal flip forever with no button left to
      // undo it, which is the one failure here that a person on set cannot work around.
      window.localStorage.removeItem('pam.prompter.mirror');
      const z = Number(window.localStorage.getItem('pam.prompter.size'));
      if (Number.isFinite(z) && z >= 0 && z < SIZES.length) setSizeIx(z);
      const v = Number(window.localStorage.getItem('pam.prompter.speed'));
      if (Number.isFinite(v) && v >= 0 && v < SPEEDS.length) setSpeedIx(v);
    } catch {
      /* private mode: defaults are fine */
    }
  }, []);
  const persist = (k: string, v: string) => {
    try {
      window.localStorage.setItem(k, v);
    } catch {
      /* nothing to do */
    }
  };
  const setFlipped = (on: boolean) => {
    setFlipV(on);
    persist('pam.prompter.flipv', on ? '1' : '0');
  };
  const setSize = (n: number) => {
    const c = Math.max(0, Math.min(SIZES.length - 1, n));
    setSizeIx(c);
    persist('pam.prompter.size', String(c));
  };
  const setSpeed = (n: number) => {
    const c = Math.max(0, Math.min(SPEEDS.length - 1, n));
    setSpeedIx(c);
    persist('pam.prompter.speed', String(c));
  };

  /**
   * AUTO-SCROLL. Accumulates fractional pixels between frames, because a readable pace is well
   * under one pixel per frame (20px/s is a third of a pixel at 60fps) and rounding that to zero
   * every frame would simply never move.
   *
   * Manual scrolling is never blocked while it runs: he can always take over with the wheel and
   * it carries on from wherever he left it, which is what makes it usable rather than a rail.
   */
  useEffect(() => {
    if (!running) return;
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    let last = 0;
    let carry = 0;
    const step = (now: number) => {
      if (last) {
        const dy = (SPEEDS[speedIx] * (now - last)) / 1000 + carry;
        const whole = Math.floor(dy);
        carry = dy - whole;
        if (whole > 0) {
          el.scrollTop += whole;
          // Stop at the end rather than spinning against the bottom for the rest of the take.
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
            setRunning(false);
            return;
          }
        }
      }
      last = now;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [running, speedIx]);

  const toTop = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const k = e.key;
      if (k === ' ' || k === 'Spacebar') {
        e.preventDefault();
        setRunning((r) => !r);
      } else if (k === '+' || k === '=') {
        e.preventDefault();
        setSize(sizeIx + 1);
      } else if (k === '-' || k === '_') {
        e.preventDefault();
        setSize(sizeIx - 1);
      } else if (k === 'ArrowUp') {
        e.preventDefault();
        setSpeed(speedIx + 1);
      } else if (k === 'ArrowDown') {
        e.preventDefault();
        setSpeed(speedIx - 1);
      } else if (k === 'f' || k === 'F') {
        e.preventDefault();
        setFlipped(!flipV);
      } else if (k === 'Home') {
        e.preventDefault();
        toTop();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sizeIx, speedIx, flipV, toTop]);

  return (
    <div className={t.root}>
      {/* THE SCROLL. The whole script in one column, so nothing has to fit and nothing is
          paged. The wheel works here with no code: it is an ordinary scroll container. */}
      <div
        className={t.scroll}
        ref={scrollRef}
        /**
         * The flip goes HERE, on the viewport-sized scroll box, not on the column inside it.
         * `.scroll` is `inset: 0`, so it pivots about the middle of the screen; the column is the
         * whole script and would pivot about a point far below the bottom of it.
         *
         * Flipping the box rather than the text also keeps the scroll direction honest without a
         * second setting. The presentation and the motion are the same rendered output, so both
         * turn together: text still travels the reading direction on the glass. `undefined` when
         * neither axis is on, so an unflipped prompter is not paying for a compositing layer.
         */
        style={
          flipV ? { transform: 'scaleY(-1)' } : undefined
        }
      >
        <div className={t.column} style={{ fontSize: `${SIZES[sizeIx]}px` }}>
          {sections.length === 0 ? (
            <p className={t.body}>No script yet.</p>
          ) : (
            sections.map((block, i) => {
              const lines = block.split('\n');
              const hasHeader = lines.length > 1;
              return (
                <section key={i} className={t.block}>
                  {hasHeader ? <div className={t.header}>{lines[0]}</div> : null}
                  <p className={t.body}>
                    {hasHeader ? lines.slice(1).join('\n') : block}
                  </p>
                </section>
              );
            })
          )}
        </div>
      </div>

      {chromeOn ? (
        <div className={t.rig}>
          <Link href={backHref} className={t.exit}>
            ✕
          </Link>
          <button
            type="button"
            className={running ? t.rigOn : ''}
            onClick={() => setRunning((r) => !r)}
            aria-label={running ? 'Stop scrolling' : 'Start scrolling'}
          >
            {running ? '❚❚' : '▶'}
          </button>
          <button type="button" onClick={() => setSpeed(speedIx - 1)} aria-label="Slower">
            slower
          </button>
          <span className={t.rigValue}>{SPEEDS[speedIx]}</span>
          <button type="button" onClick={() => setSpeed(speedIx + 1)} aria-label="Faster">
            faster
          </button>
          <button type="button" onClick={() => setSize(sizeIx - 1)} aria-label="Smaller text">
            A-
          </button>
          <button type="button" onClick={() => setSize(sizeIx + 1)} aria-label="Bigger text">
            A+
          </button>
          <button
            type="button"
            className={flipV ? t.rigOn : ''}
            onClick={() => setFlipped(!flipV)}
            aria-label="Flip top to bottom for teleprompter glass"
          >
            flip
          </button>
          <button type="button" onClick={toTop} aria-label="Back to the top">
            top
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
        Scroll with the wheel at any time, even while it is running. Space starts and stops,
        up and down set the speed, + and - the size, f flips for the glass, Home returns to the
        top.
      </div>
    </div>
  );
}
