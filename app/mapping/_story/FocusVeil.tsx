'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import s from './story.module.css';

/**
 * Depth of field for the page.
 *
 * The bottom half of the viewport is progressively blurred and dimmed, sharpening as
 * content rises to the middle. It replaces the reveal system that used to hold content
 * at opacity 0 until it crossed the centre line, and it exists because of a specific
 * complaint (Marrs, 10 Aug 2026): holding things invisible left stretches of the scroll
 * where the page appeared to have nothing below it. Everything is present now. It is
 * just out of focus until you get to it, which is the same instruction the reveal was
 * giving without the lie that there is nothing there.
 *
 * PROGRESSIVE, NOT A SINGLE BLURRED PANE. One backdrop-filter with a gradient mask
 * cross fades a blurred copy over a sharp one, and the transition band ghosts visibly.
 * Four stacked layers, each blurring harder over a narrower band, ramp the radius
 * itself. That is the whole reason for the nested divs.
 *
 * IT MUST GET OUT OF THE WAY AT BOTH ENDS, and both are real failures rather than
 * polish. At the top, the hero's primary CTA sits inside the bottom half of the first
 * screen, so a veil that is on at scroll 0 blurs the button you most want pressed. At
 * the bottom, the last screenful IS the final CTA and the footer, and a veil that stays
 * on leaves them permanently out of focus with no scroll left to fix it.
 *
 * FAIL-SAFE: base opacity is 0 and only script raises it. No script, a thrown error or
 * a dead ticker all leave the page completely sharp, which is a perfectly good page.
 * That is the opposite posture from the old reveal system, which failed to blank.
 */

gsap.registerPlugin(ScrollTrigger);

export function FocusVeil() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // A blur that changes under you is exactly the kind of effect reduced motion is
    // asking to be spared. The page is complete without it.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    /**
     * Both ends are measured against the viewport rather than fixed pixels, so the
     * numbers hold on a laptop and on a tall monitor.
     *
     * The engage DELAY is not padding. The hero's primary CTA sits about 560px down,
     * which is inside the veil band at scroll 0, so a ramp that starts immediately puts
     * a soft blur on the button you most want pressed for the first stretch of the
     * scroll. Waiting until the button has cleared the band costs nothing and fixes it.
     */
    const apply = () => {
      const h = window.innerHeight;
      const y = window.scrollY;
      const max = Math.max(0, ScrollTrigger.maxScroll(window));
      const engage = (y - h * 0.16) / (h * 0.4);
      const release = (max - y) / (h * 0.75);
      const v = Math.max(0, Math.min(1, engage, release));
      gsap.set(el, { opacity: v });
    };

    const ctx = gsap.context(() => {
      ScrollTrigger.create({ start: 0, end: 'max', onUpdate: apply, onRefresh: apply });
      // The page is normally at scroll 0 on load, where onUpdate has not fired yet.
      apply();
    });

    return () => ctx.revert();
  }, []);

  return (
    <div className={s.veil} ref={ref} aria-hidden="true">
      <div className={`${s.veilLayer} ${s.veilL1}`} />
      <div className={`${s.veilLayer} ${s.veilL2}`} />
      <div className={`${s.veilLayer} ${s.veilL3}`} />
      <div className={`${s.veilLayer} ${s.veilL4}`} />
      <div className={s.veilScrim} />
    </div>
  );
}
