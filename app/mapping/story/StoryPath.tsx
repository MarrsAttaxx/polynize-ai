'use client';

import { useEffect, useRef, useState } from 'react';
import s from './story.module.css';

/**
 * The route.
 *
 * The turn line promises "you cannot go where you need to go without a map", so the
 * story section is drawn as a journey: a dashed route meandering down the left rail
 * with a waypoint at each beat, and a mint trail that fills in behind you as you
 * scroll. It lands you at the real capability map.
 *
 * Deliberately restrained. This is a margin rail, not a background image, and it is
 * hidden entirely below 1000px where there is no room for it. Purely decorative, so
 * it is aria-hidden and carries no information the copy does not already give.
 *
 * Progress is written straight to the DOM inside a rAF from a scroll listener rather
 * than through React state, so scrolling never triggers a re-render. Under
 * prefers-reduced-motion the trail is simply drawn complete and the listener never
 * attaches.
 */

const W = 100; // viewBox width; the rail is narrow and fixed
const AMP = 26; // how far the route wanders off centre

function buildRoute(height: number, segments: number) {
  const seg = height / segments;
  let d = `M ${W / 2} 0`;
  for (let k = 1; k <= segments; k++) {
    const y = k * seg;
    const ctrlX = W / 2 + (k % 2 === 1 ? AMP : -AMP);
    d += ` Q ${ctrlX} ${y - seg / 2}, ${W / 2} ${y}`;
  }
  return d;
}

export function StoryPath({ beatCount }: { beatCount: number }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const trailRef = useRef<SVGPathElement | null>(null);
  const dotsRef = useRef<(SVGGElement | null)[]>([]);
  const [height, setHeight] = useState(0);
  const [waypoints, setWaypoints] = useState<number[]>([]);

  // Measure the story section and where each beat sits inside it.
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
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [beatCount]);

  // Drive the trail from scroll position.
  useEffect(() => {
    if (!height || !waypoints.length) return;
    const host = hostRef.current;
    const section = host?.parentElement;
    const trail = trailRef.current;
    if (!host || !section || !trail) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      trail.style.strokeDashoffset = '0';
      dotsRef.current.forEach((g) => g?.classList.add(s.wpOn));
      return;
    }

    // Called straight from the scroll handler rather than through rAF. It is one
    // rect read and a handful of class toggles, and dropping rAF removes a
    // dependency that some environments never fire.
    const update = () => {
      const r = section.getBoundingClientRect();
      // 0 when the section top reaches the middle of the viewport, 1 at its bottom.
      const mid = window.innerHeight * 0.5;
      const p = Math.max(0, Math.min(1, (mid - r.top) / Math.max(1, r.height)));
      trail.style.strokeDashoffset = String(1 - p);
      const travelled = p * height;
      dotsRef.current.forEach((g, i) => {
        if (!g) return;
        g.classList.toggle(s.wpOn, waypoints[i] <= travelled);
      });
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [height, waypoints]);

  if (!height) return <div className={s.rail} ref={hostRef} aria-hidden="true" />;

  const d = buildRoute(height, Math.max(4, beatCount));

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
        {/* The route not yet travelled */}
        <path className={s.routeBase} d={d} pathLength={1} />
        {/* The trail behind you */}
        <path
          className={s.routeTrail}
          d={d}
          pathLength={1}
          ref={trailRef}
          strokeDasharray={1}
          strokeDashoffset={1}
        />
        {waypoints.map((y, i) => (
          <g
            key={i}
            className={s.wp}
            ref={(el) => {
              dotsRef.current[i] = el;
            }}
          >
            <circle className={s.wpHalo} cx={W / 2} cy={y} r={11} />
            <circle className={s.wpDot} cx={W / 2} cy={y} r={4} />
            <text className={s.wpNum} x={W / 2 + 20} y={y + 3}>
              {String(i + 1).padStart(2, '0')}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
