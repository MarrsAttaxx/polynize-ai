'use client';

import { useEffect, useId, useRef, useState } from 'react';
import s from './story.module.css';

/**
 * The route: a plotted survey line down the left margin of the story.
 *
 * It carries the whole chaos-to-order argument in STATIC GEOMETRY, which is the
 * important design decision here. The route scribbles beside "you are lost" and runs
 * dead straight by the time the turn line asks for a map. That means the argument
 * survives a screenshot, a reduced-motion reader, a failed script, and any browser
 * where the observer never delivers. Motion is strictly additive on top.
 *
 * FAIL-SAFE BY CONSTRUCTION. Every segment is rendered visible in its "ahead" state
 * from the server. The observer only ever ADDS the travelled state. If JavaScript
 * never runs, or IntersectionObserver never fires (measured: it does not, in some
 * headless environments), the reader still sees the full plotted route. Nothing on
 * this page is hidden and then waiting on a callback to come back.
 *
 * Drawn as one path PER SEGMENT rather than a single path revealed by a mask or a
 * dashoffset. A dotted stroke already spends stroke-dasharray on the dots, so it
 * cannot also spend it on a reveal, and per-segment paths avoid an offscreen mask
 * buffer over a 4000px tall element.
 */

const W = 132; // rail width; must match .rail in story.module.css
const CX = W / 2;
const AMP_MAX = 46;

/**
 * Fixed wander table. Deterministic on purpose: the path is built during render, so a
 * Math.random here would produce a server/client hydration mismatch.
 */
const SCRIBBLE = [1, -0.86, 0.58, -1, 0.42, -0.72, 0.94, -0.34, 0.66, -0.95, 0.5, -0.62];

/** Wander decays to nothing by the final segment. */
function decayFor(i: number, total: number) {
  if (total <= 1) return 0;
  return Math.pow(Math.max(0, 1 - i / (total - 1)), 1.5);
}

/**
 * One segment, from y0 to y1, starting and ending on the centreline so joins are
 * invisible and every waypoint sits on the axis.
 *
 * Amplitude is proportional to segment height, not absolute: an absolute value looks
 * right at 400px and vanishes at the real 800px per segment. A quadratic deviates by
 * HALF its control offset, so the control point is offset by 2x the target wander.
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
  const [height, setHeight] = useState(0);
  const [waypoints, setWaypoints] = useState<number[]>([]);
  const [reached, setReached] = useState(-1);
  const uid = useId();

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
    // Fonts landing changes beat heights, so re-measure once they do.
    (document as Document & { fonts?: FontFaceSet }).fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, [beatCount]);

  // Step the travelled state forward as beats are reached. Monotonic: scrolling back
  // up never un-travels the route, which would undo the narrative.
  useEffect(() => {
    const host = hostRef.current;
    const section = host?.parentElement;
    if (!section || !waypoints.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setReached(waypoints.length - 1);
      section.setAttribute('data-reached', String(waypoints.length - 1));
      return;
    }
    const beats = Array.from(section.querySelectorAll('[data-beat]'));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = beats.indexOf(e.target);
          if (i < 0) continue;
          setReached((prev) => {
            const next = Math.max(prev, i);
            section.setAttribute('data-reached', String(next));
            return next;
          });
        }
      },
      { rootMargin: '0px 0px -45% 0px' }
    );
    beats.forEach((b) => io.observe(b));
    return () => io.disconnect();
  }, [waypoints]);

  if (!height || !waypoints.length) {
    return <div className={s.rail} ref={hostRef} aria-hidden="true" />;
  }

  // Nodes: top of section, each beat centre, bottom. Segments run between them.
  const nodes = [0, ...waypoints, height];
  const segCount = nodes.length - 1;

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
        {nodes.slice(0, -1).map((y0, i) => (
          <path
            key={`${uid}-seg-${i}`}
            /* No pathLength here. pathLength rescales every distance-along-path value,
               which silently turns a dotted stroke-dasharray back into a solid line. */
            className={`${s.routeSeg} ${i <= reached ? s.routeSegOn : ''}`}
            d={segmentPath(y0, nodes[i + 1], decayFor(i, segCount), i * 3)}
          />
        ))}

        {waypoints.map((y, i) => (
          <g key={`${uid}-wp-${i}`} className={`${s.wp} ${i <= reached ? s.wpOn : ''}`}>
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
