'use client';

import { useEffect, useRef } from 'react';
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
 * IT MUST GET OUT OF THE WAY AT THREE POINTS, and each is a real failure rather than
 * polish. At the top, the hero's primary CTA sits inside the bottom half of the first
 * screen, so a veil that is on at scroll 0 blurs the button you most want pressed. At
 * the bottom, the last screenful IS the final CTA and the footer, and a veil that stays
 * on leaves them permanently out of focus with no scroll left to fix it.
 *
 * And in the middle, at the RESULT. The veil earns its keep through the story, where the
 * job is holding one thought in focus at a time. The matrix and the capability map are
 * the opposite kind of object: things you read across, scan, hover and open. Softening
 * their lower half fights the reader (Marrs, 10 Aug 2026). So the veil fades out as the
 * result comes up and stays off for the rest of the page, which is all reference
 * material from that point on.
 *
 * NEVER FADE THE WRAPPER. Per Filter Effects, an ancestor with opacity < 1 establishes
 * a Backdrop Root, so a descendant's backdrop-filter can only see content INSIDE that
 * root, which here is nothing. The first version ramped this element's opacity and the
 * blur therefore did not exist for the entire ramp, appearing only if the value landed
 * on exactly 1. Reported by Marrs ("scroll from the top and the blur never shows, but
 * refresh halfway down and it works") and reproduced in the browser: wrapper at 1
 * blurs, wrapper at 0.85 does not. Opacity on the SAME element as the backdrop-filter
 * is fine, which is why the strength now rides a custom property that each layer
 * applies to itself.
 *
 * FAIL-SAFE: --veil-k defaults to 0 in the stylesheet and only script raises it. No
 * script, a thrown error or a dead ticker all leave the page completely sharp, which is
 * a perfectly good page. That is the opposite posture from the old reveal system, which
 * failed to blank.
 */

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
      const max = Math.max(0, document.documentElement.scrollHeight - h);
      const engage = (y - h * 0.16) / (h * 0.4);
      const release = (max - y) / (h * 0.75);

      /**
       * Query every frame rather than caching the node, because the result section is
       * rendered by whichever page mounted this and can arrive after the first paint.
       * It is one selector against a small document; caching it is a correctness risk
       * for no measurable gain.
       */
      const stop = document.querySelector('[data-veil-stop]');
      let arrive = 1;
      if (stop) {
        // Fades out over the half screen before the result reaches the middle, and
        // stays at 0 once its top has gone past, so everything below is sharp.
        arrive = (stop.getBoundingClientRect().top - h * 0.5) / (h * 0.5);
      }

      const v = Math.max(0, Math.min(1, engage, release, arrive));
      el.style.setProperty('--veil-k', v.toFixed(3));
    };

    /**
     * A plain listener rather than a ScrollTrigger. This needs the raw scroll position
     * on every frame and nothing else, so a trigger with a start, an end and a progress
     * is machinery that can only go wrong: a degenerate range measured before layout
     * settles would stop firing entirely.
     */
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        apply();
      });
    };

    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
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
