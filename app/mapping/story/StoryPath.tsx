'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import s from './story.module.css';

/**
 * The plotted route: a full-width expedition line that draws itself as you descend.
 *
 * It is no longer a margin rail. The route now crosses the sheet, swinging out to the
 * left edge and back, so it reads as a journey over ground rather than a progress bar.
 * It passes BEHIND the copy (rail is z-index 0, .beat is z-index 1), which is exactly
 * how a route behaves on a chart.
 *
 * Chaos to order is in the geometry: early legs carry extra jittered waypoints so the
 * line genuinely scribbles, and the jitter decays to nothing by the turn, where the
 * route runs clean into the X. That survives a screenshot, reduced motion and a failed
 * script, because it is drawn, not animated.
 *
 * FAIL-SAFE: the faint full route is server-rendered and always visible. GSAP only ever
 * adds the bright trail on top by growing a clip rectangle.
 */

gsap.registerPlugin(ScrollTrigger);

/**
 * Where the route sits horizontally at each waypoint, as a fraction of sheet width.
 * Deliberately wanders left and back rather than tracking one margin. Index 0 is the
 * start above beat 1; the last entry is the destination.
 */
const X_STOPS = [0.3, 0.08, 0.44, 0.13, 0.36, 0.5];

/** Fixed wander table. Deterministic: a random value here is a hydration mismatch. */
const SCRIBBLE = [1, -0.86, 0.58, -1, 0.42, -0.72, 0.94, -0.34, 0.66, -0.95, 0.5, -0.62];

const decayFor = (i: number, total: number) =>
  total <= 1 ? 0 : Math.pow(Math.max(0, 1 - i / (total - 1)), 1.4);

type Pt = { x: number; y: number };

/** Smooth cubic spline through the points (Catmull-Rom converted to Bezier). */
function splinePath(pts: Pt[]) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

/**
 * Build the whole route. Between each pair of stops we drop extra jittered points; how
 * many, and how far off course, is governed by the decay. Early legs get a genuine
 * search pattern, the last leg gets none.
 */
function buildRoute(width: number, stops: Pt[]) {
  const legs = stops.length - 1;
  const pts: Pt[] = [stops[0]];
  for (let i = 0; i < legs; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    const decay = decayFor(i, legs);
    const extra = Math.round(decay * 4);
    for (let k = 1; k <= extra; k++) {
      const t = k / (extra + 1);
      const swing = SCRIBBLE[(i * 3 + k) % SCRIBBLE.length];
      pts.push({
        x: a.x + (b.x - a.x) * t + swing * decay * width * 0.075,
        y: a.y + (b.y - a.y) * t,
      });
    }
    pts.push(b);
  }
  return pts;
}

export function StoryPath({ beatCount }: { beatCount: number }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const clipRef = useRef<SVGRectElement | null>(null);
  const wpRefs = useRef<(SVGGElement | null)[]>([]);
  const xRef = useRef<SVGGElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [waypoints, setWaypoints] = useState<number[]>([]);

  useEffect(() => {
    const host = hostRef.current;
    const section = host?.parentElement;
    if (!host || !section) return;

    const measure = () => {
      const secTop = section.getBoundingClientRect().top + window.scrollY;
      setBox({ w: host.clientWidth, h: section.offsetHeight });
      const beats = Array.from(section.querySelectorAll('[data-beat]')) as HTMLElement[];
      setWaypoints(
        beats.map((b) => {
          const r = b.getBoundingClientRect();
          return r.top + window.scrollY - secTop + r.height / 2;
        })
      );
    };

    measure();
    const ro = new ResizeObserver(() => {
      measure();
      ScrollTrigger.refresh();
    });
    ro.observe(section);
    (document as Document & { fonts?: FontFaceSet }).fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, [beatCount]);

  useEffect(() => {
    const host = hostRef.current;
    const section = host?.parentElement;
    if (!section || !box.h || !waypoints.length) return;

    const ctx = gsap.context(() => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.set(clipRef.current, { attr: { height: box.h } });
        wpRefs.current.forEach((g) => g && g.classList.add(s.wpOn));
        gsap.set(xRef.current, { opacity: 1, scale: 1 });
        section.setAttribute('data-reached', String(waypoints.length - 1));
        return;
      }

      gsap.to(clipRef.current, {
        attr: { height: box.h },
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top 55%',
          end: 'bottom 65%',
          scrub: 0.7,
          onUpdate: (self) => {
            const travelled = self.progress * box.h;
            let reached = -1;
            waypoints.forEach((y, i) => {
              const on = y <= travelled;
              wpRefs.current[i]?.classList.toggle(s.wpOn, on);
              if (on) reached = i;
            });
            section.setAttribute('data-reached', String(reached));
          },
        },
      });

      gsap.fromTo(
        xRef.current,
        { opacity: 0, scale: 0.4, transformOrigin: 'center' },
        {
          opacity: 1,
          scale: 1,
          duration: 0.5,
          ease: 'back.out(2)',
          scrollTrigger: { trigger: section, start: 'bottom 78%', toggleActions: 'play none none reverse' },
        }
      );
    }, hostRef);

    return () => ctx.revert();
  }, [box, waypoints]);

  if (!box.w || !box.h || !waypoints.length) {
    return <div className={s.rail} ref={hostRef} aria-hidden="true" />;
  }

  const { w, h } = box;
  // Narrow screens get a tighter swing, or the route would leave the sheet.
  const spread = w < 760 ? 0.55 : 1;
  const centre = 0.5;
  const xAt = (i: number) => w * (centre + (X_STOPS[i % X_STOPS.length] - centre) * spread);

  const stops: Pt[] = [
    { x: xAt(0), y: 0 },
    ...waypoints.map((y, i) => ({ x: xAt(i + 1), y })),
    { x: w * centre, y: h },
  ];
  const d = splinePath(buildRoute(w, stops));

  const ticks: { y: number; major: boolean; label?: string }[] = [];
  for (let y = 60, n = 1; y < h - 40; y += 42, n++) {
    const major = n % 5 === 0;
    ticks.push({ y, major, label: major ? String(n * 2).padStart(2, '0') : undefined });
  }

  const start = stops[0];
  const end = stops[stops.length - 1];

  return (
    <div className={s.rail} ref={hostRef} aria-hidden="true">
      <svg
        className={s.railSvg}
        viewBox={`0 0 ${w} ${h}`}
        width={w}
        height={h}
        preserveAspectRatio="xMidYMin meet"
        focusable="false"
      >
        <defs>
          <clipPath id="pn-route-clip">
            <rect ref={clipRef} x="0" y="0" width={w} height="0" />
          </clipPath>
        </defs>

        <g className={s.scaleRule}>
          <line x1="14" y1={40} x2="14" y2={h - 30} />
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1="14" y1={t.y} x2={t.major ? 24 : 19} y2={t.y} />
              {t.label && (
                <text className={s.scaleNum} x="28" y={t.y + 3}>
                  {t.label}
                </text>
              )}
            </g>
          ))}
        </g>

        <g className={s.startMark}>
          <circle cx={start.x} cy={start.y + 10} r="9" />
          <circle cx={start.x} cy={start.y + 10} r="3.5" className={s.startCore} />
        </g>

        {/* The road ahead. Always rendered, so the route exists with no script.
            Never add pathLength: it rescales distance-along-path and silently turns
            the dash pattern back into a solid line. */}
        <path className={s.routeSeg} d={d} />

        {/* The trail behind you, revealed by the growing clip. */}
        <g clipPath="url(#pn-route-clip)" className={s.trailGroup}>
          <path className={s.routeTrail} d={d} />
        </g>

        {waypoints.map((y, i) => {
          const x = xAt(i + 1);
          return (
            <g
              key={`wp-${i}`}
              className={s.wp}
              ref={(el) => {
                wpRefs.current[i] = el;
              }}
            >
              <circle className={s.wpHalo} cx={x} cy={y} r={12} />
              <circle className={s.wpDot} cx={x} cy={y} r={4.5} />
              <text className={s.wpNum} x={x + 20} y={y + 3}>
                {String(i + 1).padStart(2, '0')}
              </text>
            </g>
          );
        })}

        <g className={s.xMark} ref={xRef}>
          <line x1={end.x - 10} y1={end.y - 18} x2={end.x + 10} y2={end.y + 2} />
          <line x1={end.x + 10} y1={end.y - 18} x2={end.x - 10} y2={end.y + 2} />
        </g>
      </svg>
    </div>
  );
}
