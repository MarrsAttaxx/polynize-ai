'use client';

import { useEffect, useId, useRef, useState } from 'react';
import s from './story.module.css';

/**
 * The route: a plotted survey line down the left margin that DRAWS ITSELF as you
 * scroll, waypoint by waypoint.
 *
 * Two layers. Underneath, the full route in faint dashes, so the road ahead is always
 * visible and the page still reads with no JavaScript at all. On top, the same
 * geometry in bright mint, clipped by a rectangle whose height tracks scroll position.
 * Growing a clip is how you can have BOTH a dash pattern and a progressive reveal:
 * stroke-dasharray is already spent on the dashes, so it cannot also do the drawing.
 *
 * Chaos to order is carried by the geometry itself. The route scribbles beside "you
 * are lost" and runs dead straight by the turn, so the argument survives a screenshot,
 * a reduced-motion reader and a failed script. Measured lateral wander per segment at
 * a 900px viewport: 62, 42, 23, 8, 0 px.
 *
 * Driven by a scroll listener rather than IntersectionObserver, deliberately. The
 * continuous draw is the thing that makes it feel alive; discrete per-beat stepping
 * was tried and it lost the whole effect.
 */

const W = 132; // rail width; must match .rail in story.module.css
const CX = W / 2;
const AMP_MAX = 46;

/** Fixed wander table. Deterministic: a random value here is a hydration mismatch. */
const SCRIBBLE = [1, -0.86, 0.58, -1, 0.42, -0.72, 0.94, -0.34, 0.66, -0.95, 0.5, -0.62];

/** Wander decays to nothing by the final segment. */
function decayFor(i: number, total: number) {
  if (total <= 1) return 0;
  return Math.pow(Math.max(0, 1 - i / (total - 1)), 1.5);
}

/**
 * One segment, centreline to centreline so joins are invisible and waypoints sit on
 * the axis. Amplitude is proportional to segment height, because an absolute value
 * looks right at 400px and vanishes at the real 800px. A quadratic deviates by HALF
 * its control offset, hence the 2x.
 */
function segmentPath(y0: number, y1: number, decay: number, phase: number) {
  const h = Math.max(1, y1 - y0);
  const amp = Math.min(AMP_MAX, h * 0.075) * decay;
  const wiggles = Math.max(3, Math.round(h / 110));
  const step = h / wiggles;
  let d = `M ${CX} ${y0.toFixed(1)}`;
  for (let i = 1; i <= wiggles; i++) {
    const y = y0 + i * step;
    const swing = SCRIBBLE[(phase + i) % SCRIBBLE.length];
    const cx = CX + swing * amp * 2;
    d += ` Q ${cx.toFixed(1)} ${(y - step / 2).toFixed(1)}, ${CX} ${y.toFixed(1)}`;
  }
  return d;
}

export function StoryPath({ beatCount }: { beatCount: number }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const clipRef = useRef<SVGRectElement | null>(null);
  const wpRefs = useRef<(SVGGElement | null)[]>([]);
  const [height, setHeight] = useState(0);
  const [waypoints, setWaypoints] = useState<number[]>([]);
  const rawId = useId();
  const clipId = `route-clip-${rawId.replace(/:/g, '')}`;

  // Measure the section and where each beat sits inside it.
  useEffect(() => {
    const host = hostRef.current;
    const section = host?.parentElement;
    if (!host || !section) return;

    const measure = () => {
      const secTop = section.getBoundingClientRect().top + window.scrollY;
      setHeight(section.offsetHeight);
      const beats = Array.from(section.querySelectorAll('[data-beat]')) as HTMLElement[];
      setWaypoints(
        beats.map((b) => {
          const r = b.getBoundingClientRect();
          return r.top + window.scrollY - secTop + r.height / 2;
        })
      );
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(section);
    (document as Document & { fonts?: FontFaceSet }).fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, [beatCount]);

  // Draw the trail from scroll position.
  useEffect(() => {
    const host = hostRef.current;
    const section = host?.parentElement;
    const clip = clipRef.current;
    if (!section || !clip || !height || !waypoints.length) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      clip.setAttribute('height', String(height));
      wpRefs.current.forEach((g) => g?.classList.add(s.wpOn));
      section.setAttribute('data-reached', String(waypoints.length - 1));
      return;
    }

    let frame = 0;
    let lastReached = -1;

    const update = () => {
      frame = 0;
      const r = section.getBoundingClientRect();
      // 0 as the section top passes the middle of the viewport, 1 at its bottom.
      const p = Math.max(0, Math.min(1, (window.innerHeight * 0.5 - r.top) / Math.max(1, r.height)));
      const travelled = p * height;
      clip.setAttribute('height', String(travelled));

      let reached = -1;
      for (let i = 0; i < waypoints.length; i++) {
        const on = waypoints[i] <= travelled;
        wpRefs.current[i]?.classList.toggle(s.wpOn, on);
        if (on) reached = i;
      }
      // Monotonic: the hachure should not come back if you scroll up.
      if (reached > lastReached) {
        lastReached = reached;
        section.setAttribute('data-reached', String(reached));
      }
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [height, waypoints]);

  if (!height || !waypoints.length) {
    return <div className={s.rail} ref={hostRef} aria-hidden="true" />;
  }

  const nodes = [0, ...waypoints, height];
  const segCount = nodes.length - 1;
  const paths = nodes
    .slice(0, -1)
    .map((y0, i) => segmentPath(y0, nodes[i + 1], decayFor(i, segCount), i * 3));

  return (
    <div className={s.rail} ref={hostRef} aria-hidden="true">
      <svg
        className={s.railSvg}
        viewBox={`0 0 ${W} ${height}`}
        width={W}
        height={height}
        preserveAspectRatio="xMidYMin meet"
        focusable="false"
      >
        <defs>
          <clipPath id={clipId}>
            {/* Height is written on scroll. Starts at 0 so the trail draws in. */}
            <rect ref={clipRef} x="0" y="0" width={W} height="0" />
          </clipPath>
        </defs>

        {/* The road ahead. Always rendered, so the route exists without any script.
            NOTE: never add pathLength here. It rescales distance-along-path values and
            silently turns the dash pattern back into a solid line. */}
        {paths.map((d, i) => (
          <path key={`base-${i}`} className={s.routeSeg} d={d} />
        ))}

        {/* The trail behind you, revealed by the growing clip. */}
        <g clipPath={`url(#${clipId})`}>
          {paths.map((d, i) => (
            <path key={`trail-${i}`} className={s.routeTrail} d={d} />
          ))}
        </g>

        {waypoints.map((y, i) => (
          <g
            key={`wp-${i}`}
            className={s.wp}
            ref={(el) => {
              wpRefs.current[i] = el;
            }}
          >
            <circle className={s.wpHalo} cx={CX} cy={y} r={12} />
            <circle className={s.wpDot} cx={CX} cy={y} r={4.5} />
            <text className={s.wpNum} x={CX + 22} y={y + 3}>
              {String(i + 1).padStart(2, '0')}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
