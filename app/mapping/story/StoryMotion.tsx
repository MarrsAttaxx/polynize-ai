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
 * CONTENT MUST NEVER END UP HIDDEN. Three separate rules enforce that, because this
 * page has now shipped invisible copy twice and each time for a different reason:
 *
 *  1. Nothing is hidden in CSS. The stylesheet state is the FINISHED state, so no
 *     script, no GSAP, or a thrown error all leave the page fully readable.
 *  2. Reveals are fromTo with an explicit `opacity: 1` destination, never `from`. A
 *     `from` tween infers its end state at build time, so anything disturbing it
 *     mid-flight can park the element on the start values.
 *  3. An element must appear in exactly one batch. Two competing tweens plus
 *     overwrite: 'auto' is what stranded the beat lines at opacity 0.
 *
 * useLayoutEffect so the start state is applied before the browser paints, otherwise
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
      /**
       * fromTo with an EXPLICIT destination, not from(). A `from` tween infers its end
       * state from whatever the element computes to at the moment the tween is built,
       * so anything that disturbs it mid-flight can leave the element parked at the
       * start values, i.e. invisible. Stating opacity: 1 outright means the only place
       * this animation can finish is visible.
       */
      const reveal = (
        selector: string,
        from: gsap.TweenVars,
        start = 'top 88%',
        duration = 0.68
      ) => {
        ScrollTrigger.batch(selector, {
          start,
          once: true,
          onEnter: (els) =>
            gsap.fromTo(
              els,
              from,
              {
                // immediateRender belongs in the TO vars. GSAP reads it from
                // params[varsIndex], which for fromTo is this object; passing it in the
                // FROM vars is silently ignored, which is why a liveness failsafe had
                // to be invented to rescue elements stuck at their start state.
                immediateRender: false,
                opacity: 1,
                x: 0,
                y: 0,
                scale: 1,
                duration,
                ease: 'power2.out',
                stagger: 0.07,
                overwrite: 'auto',
                force3D: true,
              }
            ),
        });
      };

      // Headings and body land first.
      // Beat lines are excluded because they have their own cue below; an element in
      // two batches gets two competing tweens and overwrite strands it hidden.
      reveal(`.${s.rise}:not(.${s.beatLine}):not(.${s.turnLine})`, { x: 34, opacity: 0 });

      // Supporting text just behind its headline. Achieved with a later trigger point
      // rather than a delay, so a reader who scrolls straight past never waits on a
      // timer to see the words.
      reveal(`.${s.riseLate}`, { x: 28, opacity: 0 }, 'top 84%');

      // Figures get a touch of scale so they read as arriving rather than fading.
      reveal(`.${s.riseScale}`, { y: 26, opacity: 0, scale: 0.978 }, 'top 90%', 0.8);

      // Beat lines are the spine of the page, so they get their own slower cue.
      reveal(`.${s.beatLine}, .${s.turnLine}`, { x: 56, opacity: 0 }, 'top 82%', 0.9);
    });

    /**
     * Beat figures are CSS keyframes, not tweens, so all they need is the class. That
     * is deliberate: CSS animations run in environments where a JS-driven ticker does
     * not, and their base style is the finished drawing, so a figure cannot end up
     * stranded mid-animation. This observer only ever ADDS the class.
     */
    const figures = Array.from(document.querySelectorAll('[data-fig]'));
    const figIo = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          // s.play, not 'play': CSS modules hash the name. Deleting the rule that
          // defines it once made s.rise undefined and every element rendered
          // class="undefined", which took the whole page down.
          if (s.play) e.target.classList.add(s.play);
          figIo.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -18% 0px' }
    );
    figures.forEach((f) => figIo.observe(f));

    /**
     * Liveness failsafe, and it is not theoretical: a reveal tween applies its start
     * state and then relies on the ticker to animate away from it. In an
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
      figIo.disconnect();
      cancelAnimationFrame(raf);
      window.clearTimeout(failsafe);
      ctx.revert();
    };
  }, []);

  return null;
}
