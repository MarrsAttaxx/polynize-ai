'use client';

import { useEffect, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import s from './story.module.css';

/**
 * Section reveals, driven by GSAP.
 *
 * Replaces a CSS @supports (animation-timeline: view()) block, which meant roughly one
 * visitor in six saw a completely static page. GSAP works everywhere, so the motion is
 * now something every reader actually gets.
 *
 * WHY gsap.from AND NOT gsap.to. `from` tweens declare where the element comes FROM and
 * leave the element's own stylesheet value as the destination. So if this script never
 * loads, never runs, or throws, every element simply sits at its final state: visible.
 * Nothing on this page is hidden by CSS waiting for a callback to rescue it. That was a
 * real bug here once and it is not coming back.
 *
 * useLayoutEffect so the from-state is applied before the browser paints, otherwise
 * anything already in view flashes in at full opacity and then jumps back to animate.
 */

gsap.registerPlugin(ScrollTrigger);

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function StoryMotion() {
  useIsomorphicLayoutEffect(() => {
    // Reduced motion: do nothing at all. Every element keeps its stylesheet value,
    // which is the finished state, so the page is complete and still.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = gsap.context(() => {
      const reveal = (selector: string, vars: gsap.TweenVars, start = 'top 88%') => {
        ScrollTrigger.batch(selector, {
          start,
          once: true,
          onEnter: (els) =>
            gsap.from(els, {
              duration: 0.68,
              ease: 'power3.out',
              stagger: 0.08,
              overwrite: 'auto',
              ...vars,
            }),
        });
      };

      // Headings and body land first, supporting text just behind them.
      reveal(`.${s.rise}`, { y: 26, opacity: 0 });
      reveal(`.${s.riseLate}`, { y: 20, opacity: 0, delay: 0.12 });
      // Figures get a touch of scale so they read as arriving rather than fading.
      reveal(`.${s.riseScale}`, { y: 30, opacity: 0, scale: 0.975, duration: 0.8 }, 'top 90%');

      // Beat lines are the spine of the page, so they get their own slower, later cue.
      ScrollTrigger.batch(`.${s.beatLine}, .${s.turnLine}`, {
        start: 'top 78%',
        once: true,
        onEnter: (els) =>
          gsap.from(els, {
            y: 34,
            opacity: 0,
            duration: 0.82,
            ease: 'power3.out',
            overwrite: 'auto',
          }),
      });
    });

    /**
     * Liveness failsafe, and it is not theoretical: gsap.from applies its start state
     * immediately and then relies on the ticker to animate away from it. In an
     * environment where scripts run but requestAnimationFrame never fires, every
     * reveal target is left pinned at opacity 0 and the page reads as blank. Measured
     * in this project's own preview browser.
     *
     * So: if no frame has been served shortly after mount, tear the whole context down.
     * revert() restores the original styles, which is the fully visible page.
     */
    let ticked = false;
    const raf = requestAnimationFrame(() => {
      ticked = true;
    });
    const failsafe = window.setTimeout(() => {
      if (!ticked) ctx.revert();
    }, 1200);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(failsafe);
      ctx.revert();
    };
  }, []);

  return null;
}
