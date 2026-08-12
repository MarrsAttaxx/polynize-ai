'use client';

import { useRef, useState } from 'react';
import s from './story.module.css';

/**
 * The hero video, with our own play mark over the poster.
 *
 * WHY NOT JUST `controls`. A native paused video draws a small grey chrome play button
 * whose size and shape are the browser's decision, not ours, and it is the first thing a
 * visitor looks at on this page. This replaces it with one large white mark in the site's
 * own line-art vocabulary: a thin ring and a triangle, the same drawing language as the
 * beat figures.
 *
 * Controls are OFF until first play and native from then on. That way there is exactly
 * one play affordance on screen at a time, and once the video is running the visitor gets
 * the full scrubber rather than something we have half-rebuilt. The overlay does not come
 * back on pause: fighting the native UI for the same job is how you end up with two play
 * buttons again.
 *
 * It is a real <button>, so it is keyboard reachable and announced. The poster underneath
 * is the video's own poster attribute; this element only draws the mark and the scrim.
 */
export function HeroVideo({
  src,
  poster,
  label,
}: {
  src: string;
  poster: string;
  label: string;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [started, setStarted] = useState(false);

  function play() {
    const v = ref.current;
    if (!v) return;
    setStarted(true);
    // If the browser refuses the play (rare without sound restrictions, but possible),
    // the native controls are already on by then, so the visitor is not stranded.
    void v.play().catch(() => {});
  }

  return (
    <div className={s.videoWrap}>
      <video
        ref={ref}
        className={s.video}
        controls={started}
        preload="metadata"
        poster={poster}
        playsInline
      >
        <source src={src} type="video/mp4" />
      </video>

      {!started && (
        <button type="button" className={s.playBtn} onClick={play} aria-label={label}>
          <span className={s.playMark} aria-hidden="true">
            {/* Triangle only. The ring came off (Marrs, 12 Aug 2026) and the triangle
                doubled to carry the frame on its own.

                The corners are rounded by stroking the path in the same white as its fill
                with a round line-join, which offsets the outline outwards by half the
                stroke. That is why the drawn points are inset from the visual bounds:
                the 10px stroke inflates 27,20 → 73,76 back out to roughly 22,15 → 78,81. */}
            <svg viewBox="0 0 96 96" width="96" height="96">
              <path
                d="M27 20 L73 48 L27 76 Z"
                fill="#fff"
                stroke="#fff"
                strokeWidth="10"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}
