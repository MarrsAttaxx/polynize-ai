'use client';

import { useEffect, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import s from './story.module.css';

/**
 * Section reveals, driven by GSAP.
 *
 * READ THIS BEFORE CHANGING THE TRIGGER POINTS. Everything used to reveal at
 * `top 88%`, i.e. the instant an element cleared the bottom edge, and to slide in from
 * the right. Two things were wrong with that and both were reported from the page:
 * a figure would start animating while the reader was still on the paragraph above it,
 * and the slide made large display type stutter as it repainted its text-shadow halo.
 *
 * So: elements are HELD until their top crosses roughly the middle of the viewport,
 * and they arrive as a straight fade. One thought is in focus at a time and the foot of
 * the screen is empty, which is the point.
 *
 * That means content genuinely has to start hidden, which the earlier design refused to
 * do. The compromise: hiding is applied by SCRIPT, never by stylesheet. CSS still rests
 * at the finished state, so no script, a thrown error or reduced motion all leave the
 * page fully readable, and the liveness failsafe at the bottom of this file restores
 * everything if frames stop being served.
 *
 * CONTENT MUST NEVER END UP HIDDEN. Four rules enforce that, because this page has
 * shipped invisible copy twice already, each time for a different reason:
 *
 *  1. Nothing is hidden in CSS. Hiding is a gsap.set inside the context, so revert()
 *     is a complete cure.
 *  2. Reveals are fromTo with an explicit `opacity: 1` destination, never `from`. A
 *     `from` tween infers its end state at build time, so anything disturbing it
 *     mid-flight can park the element on the start values.
 *  3. An element must appear in exactly one batch. Two competing tweens plus
 *     overwrite: 'auto' is what stranded the beat lines at opacity 0.
 *  4. A bottom-of-document sweep reveals anything whose top can never reach the
 *     trigger line, which is the failure mode a late trigger point introduces: the
 *     last card and the footer sit too close to the end of the document to cross it.
 *
 * useLayoutEffect so the hidden state is applied before the browser paints, otherwise
 * everything flashes in at full opacity and then jumps back to animate.
 */

gsap.registerPlugin(ScrollTrigger);

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** Every element the reveals touch. Shared by the tweens and the watchdog below. */
const HIDDEN_SELECTOR = () =>
  `.${s.rise}, .${s.riseLate}, .${s.riseScale}, .${s.beatLine}, .${s.turnLine}, [data-fig]`;

export function StoryMotion() {
  useIsomorphicLayoutEffect(() => {
    // Reduced motion: do nothing at all, and in particular do not hide anything. Every
    // element keeps its stylesheet value, which is the finished state.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    /**
     * The context is created empty and filled inside a try/catch, which is not
     * defensive habit but a specific hole this design opens. Hiding is the FIRST thing
     * that happens; if anything after it throws, the page is left blank and the
     * liveness failsafe below cannot help, because frames are being served perfectly
     * well. revert() undoes the hiding along with everything else.
     */
    const ctx = gsap.context(() => {});
    const build = () => {
      const SPINE = `.${s.beatLine}, .${s.turnLine}`;
      const ALL = HIDDEN_SELECTOR();

      // Hold everything back. Inside the context, so ctx.revert() puts it all back.
      gsap.set(ALL, { opacity: 0 });

      /**
       * fromTo with an EXPLICIT destination, not from(). A `from` tween infers its end
       * state from whatever the element computes to at the moment the tween is built,
       * so anything that disturbs it mid-flight can leave the element parked at the
       * start values, i.e. invisible. Stating opacity: 1 outright means the only place
       * this animation can finish is visible.
       *
       * `start` is the trigger line as a share of viewport height, measured from the
       * top. Smaller number, later reveal. Nothing here goes above 72%.
       */
      const reveal = (
        selector: string,
        start: string,
        duration = 0.7,
        onEnterExtra?: (els: Element[]) => void
      ) => {
        ScrollTrigger.batch(selector, {
          start,
          once: true,
          onEnter: (els) => {
            onEnterExtra?.(els as unknown as Element[]);
            gsap.fromTo(
              els,
              { opacity: 0 },
              {
                // immediateRender belongs in the TO vars. GSAP reads it from
                // params[varsIndex], which for fromTo is this object; passing it in the
                // FROM vars is silently ignored.
                immediateRender: false,
                opacity: 1,
                duration,
                ease: 'power2.out',
                stagger: 0.07,
                overwrite: 'auto',
                force3D: true,
              }
            );
          },
        });
      };

      // Headings and body. Beat lines are excluded because they have their own cue
      // below; an element in two batches gets two competing tweens and overwrite
      // strands it hidden.
      reveal(`.${s.rise}:not(.${s.beatLine}):not(.${s.turnLine})`, 'top 62%');

      // Supporting text just behind its headline. A later trigger point rather than a
      // delay, so a reader who scrolls straight past never waits on a timer.
      reveal(`.${s.riseLate}`, 'top 58%');

      // The matrix and other large blocks want a little more warning, since their top
      // edge crosses the line while most of the element is still below the fold.
      reveal(`.${s.riseScale}`, 'top 68%', 0.8);

      // Beat lines are the spine of the page, so they get their own slower cue.
      reveal(SPINE, 'top 62%', 0.85);

      /**
       * Beat figures. The drawing itself is CSS keyframes, not a tween, because CSS
       * animations run in environments where a JS ticker does not and their base style
       * is the finished drawing, so a figure cannot strand mid-animation.
       *
       * The `.play` class is added HERE rather than from a separate IntersectionObserver
       * so it lands on exactly the frame the figure fades in. Two independent cues meant
       * the keyframes could run to completion while the element was still at opacity 0,
       * and the reader would arrive at a finished drawing having missed the animation.
       */
      reveal('[data-fig]', 'top 72%', 0.7, (els) => {
        // s.play, not 'play': CSS modules hash the name. Deleting the rule that defines
        // it once made s.rise undefined and every element rendered class="undefined",
        // which took the whole page down.
        if (s.play) els.forEach((el) => el.classList.add(s.play));
      });

      /**
       * The cost of a late trigger line: an element sitting within ~40vh of the end of
       * the document can never get its top above 62% of the viewport, so it would stay
       * hidden no matter how far you scroll. In practice that is the final CTA card.
       * When the reader reaches the bottom, reveal whatever is left.
       */
      ScrollTrigger.create({
        trigger: document.body,
        start: 'bottom bottom',
        once: true,
        onEnter: () => {
          gsap.to(ALL, { opacity: 1, duration: 0.45, overwrite: 'auto' });
          if (s.play) document.querySelectorAll('[data-fig]').forEach((el) => el.classList.add(s.play));
        },
      });
    };

    try {
      ctx.add(build);
    } catch (err) {
      // The hole this closes: hiding is the first thing build() does, so a throw
      // anywhere after it leaves the page blank while frames are served perfectly well,
      // which is exactly the case the liveness failsafe below cannot detect.
      ctx.revert();
      throw err;
    }

    /**
     * Liveness failsafe, and it is not theoretical: a reveal tween applies its start
     * state and then relies on the ticker to animate away from it. In an environment
     * where scripts run but requestAnimationFrame never fires, every reveal target is
     * left pinned at opacity 0 and the page reads as blank. Measured in this project's
     * own preview browser.
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

    /**
     * Watchdog for the one failure this design cannot otherwise survive: ScrollTrigger
     * builds its triggers without throwing, but never fires them, because scroll events
     * are not delivered. Frames are being served, so the liveness failsafe stays quiet,
     * and the reader scrolls through a blank page until the bottom sweep rescues it.
     *
     * The check is deliberately not a second animation system. It only ever reveals an
     * element that is ALREADY past its trigger line, which is a state ScrollTrigger
     * should have resolved on its own, so when everything is working this never acts.
     *
     * It reads el.style.opacity, the inline value GSAP writes, rather than
     * getComputedStyle, so polling costs no style recalculation. Each element leaves the
     * pending set once revealed, and the interval stops when the set empties.
     */
    const pending = new Set<HTMLElement>(
      Array.from(document.querySelectorAll<HTMLElement>(HIDDEN_SELECTOR()))
    );
    const watchdog = window.setInterval(() => {
      const stuck: HTMLElement[] = [];
      for (const el of pending) {
        if (el.style.opacity !== '0') {
          pending.delete(el);
          continue;
        }
        if (el.getBoundingClientRect().top < window.innerHeight * 0.55) {
          stuck.push(el);
          pending.delete(el);
        }
      }
      if (stuck.length) {
        gsap.to(stuck, { opacity: 1, duration: 0.5, overwrite: 'auto' });
        if (s.play) {
          stuck.forEach((el) => el.hasAttribute('data-fig') && el.classList.add(s.play));
        }
      }
      if (!pending.size) window.clearInterval(watchdog);
    }, 900);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(failsafe);
      window.clearInterval(watchdog);
      ctx.revert();
    };
  }, []);

  return null;
}
