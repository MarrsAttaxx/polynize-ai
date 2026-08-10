'use client';

import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import s from './story.module.css';

/**
 * Starts the beat figures when they reach the focus zone. That is now the whole job.
 *
 * WHAT USED TO BE HERE, and why it went. This file held a reveal system that set every
 * heading, paragraph, card and figure to opacity 0 and faded them in as their top
 * crossed the middle of the viewport. It went through three versions and each one had
 * the same flaw in a different costume: content below the fold was genuinely absent, so
 * there were stretches of the scroll where the page looked like it had ended. Marrs
 * called it on 10 Aug 2026 and he was right.
 *
 * FocusVeil replaces it. Everything is on the page from the moment it enters the
 * viewport, blurred and dimmed toward the bottom and sharpening as it rises to the
 * middle. Same instruction to the eye, without the lie that there is nothing there.
 *
 * The whole apparatus that reveal system needed went with it: the hiding gsap.set, the
 * four separate batches, the bottom-of-document sweep, the liveness failsafe and the
 * stuck-element watchdog. All of it existed to make sure hidden content could not stay
 * hidden. Nothing hides now, so none of it has anything to guard.
 *
 * DO NOT REINTRODUCE OPACITY HOLDING HERE without reading the veil first. It is the
 * mistake this page has made three times.
 */

gsap.registerPlugin(ScrollTrigger);

export function StoryMotion() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // The class is what runs the CSS keyframes inside each figure. Nothing is hidden
    // waiting for it: a figure that never receives it is a complete static drawing.
    if (!s.play) return;

    const ctx = gsap.context(() => {
      ScrollTrigger.batch('[data-fig]', {
        // Slightly before the middle, so the animation is already running as the figure
        // comes into focus rather than finishing while it is still blurred.
        start: 'top 80%',
        once: true,
        onEnter: (els) => els.forEach((el) => el.classList.add(s.play)),
      });
    });

    return () => ctx.revert();
  }, []);

  return null;
}
