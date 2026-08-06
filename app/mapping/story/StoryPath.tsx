'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import s from './story.module.css';

/**
 * The plotted route: a full-width expedition line that draws itself as you descend.
 *
 * Reads as departure point, four numbered checkpoints, then X. The X sits on the turn
 * beat ("you cannot go where you need to go without a map"), so the destination is
 * reached exactly as the copy asks for one and the next section answers it with the
 * real map. Arriving at any checkpoint is an event: the marker pops and a ring rides
 * out from it.
 *
 * It crosses the sheet, swinging out to the left edge and back, and passes BEHIND the
 * copy (rail is z-index 0, .beat is z-index 1), which is how a route behaves on a chart.
 *
 * Chaos to order is in the geometry: early legs carry extra jittered points so the line
 * genuinely searches, decaying to nothing by the turn. That survives a screenshot,
 * reduced motion and a failed script, because it is drawn, not animated.
 *
 * FAIL-SAFE: the faint full route is server-rendered and always visible. GSAP only ever
 * adds the bright trail on top by growing a clip rectangle.
 */

gsap.registerPlugin(ScrollTrigger);

/** Where the route sits horizontally at each stop, as a fraction of sheet width. */
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

/** Extra jittered points between stops, heaviest on the first leg, none on the last. */
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
  const rippleRefs = useRef<(SVGCircleElement | null)[]>([]);
  const firedRef = useRef<Set<number>>(new Set());
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [waypoints, setWaypoints] = useState<number[]>([]);

  useEffect(() => {
    const host = hostRef.current;
    const section = host?.parentElement;
    if (!host || !section) return;

    /**
     * Bail out of the state update when nothing actually moved. Returning a fresh
     * object or array every tick made the deps of the drawing effect change on every
     * observer callback, so it reverted and rebuilt its GSAP context in a loop, and the
     * ScrollTrigger.refresh() that came with it disturbed every other trigger.
     */
    const measure = () => {
      const secTop = section.getBoundingClientRect().top + window.scrollY;
      const w = host.clientWidth;
      const h = section.offsetHeight;
      setBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));

      const beats = Array.from(section.querySelectorAll('[data-beat]')) as HTMLElement[];
      const ys = beats.map((b) => {
        const r = b.getBoundingClientRect();
        return r.top + window.scrollY - secTop + r.height / 2;
      });
      setWaypoints((prev) =>
        prev.length === ys.length && prev.every((v, i) => Math.abs(v - ys[i]) < 1) ? prev : ys
      );
    };

    measure();
    let t = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        measure();
        ScrollTrigger.refresh();
      }, 120);
    });
    ro.observe(section);
    (document as Document & { fonts?: FontFaceSet }).fonts?.ready.then(measure).catch(() => {});
    return () => {
      window.clearTimeout(t);
      ro.disconnect();
    };
  }, [beatCount]);

  useEffect(() => {
    const host = hostRef.current;
    const section = host?.parentElement;
    if (!section || !box.h || !waypoints.length) return;

    const ctx = gsap.context(() => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.set(clipRef.current, { attr: { height: box.h } });
        wpRefs.current.forEach((g) => g && g.classList.add(s.wpOn));
        section.setAttribute('data-reached', String(waypoints.length - 1));
        return;
      }

      /** Arriving at a checkpoint is an event: the marker pops, a ring rides out. */
      const arrive = (i: number) => {
        if (firedRef.current.has(i)) return;
        firedRef.current.add(i);
        const g = wpRefs.current[i];
        const ring = rippleRefs.current[i];
        if (g) {
          gsap.fromTo(
            g,
            { scale: 0.7, transformOrigin: '50% 50%' },
            { scale: 1, duration: 0.55, ease: 'back.out(3)' }
          );
        }
        if (ring) {
          gsap.fromTo(
            ring,
            { attr: { r: 12 }, opacity: 0.8 },
            { attr: { r: 62 }, opacity: 0, duration: 1.1, ease: 'power2.out' }
          );
        }
      };

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
            // Checkpoints plus the destination X, which is below the final beat.
            const marks = [...waypoints.slice(0, -1), box.h - 96];
            marks.forEach((y, i) => {
              const on = y <= travelled;
              wpRefs.current[i]?.classList.toggle(s.wpOn, on);
              if (on) {
                reached = i;
                arrive(i);
              }
            });
            section.setAttribute('data-reached', String(reached));
          },
        },
      });
    }, hostRef);

    return () => ctx.revert();
  }, [box.w, box.h, waypoints]);

  if (!box.w || !box.h || !waypoints.length) {
    return <div className={s.rail} ref={hostRef} aria-hidden="true" />;
  }

  const { w, h } = box;
  const spread = w < 760 ? 0.55 : 1;
  const centre = 0.5;
  const xAt = (i: number) => w * (centre + (X_STOPS[i % X_STOPS.length] - centre) * spread);

  /**
   * Departure point, a numbered checkpoint on each beat EXCEPT the turn, then the X.
   * The X is deliberately not on the turn line: it sits in the gap below it, between
   * the copy and the next section, because that gap is the arrival moment and it needs
   * its own room to land.
   */
  const checkpoints = waypoints.slice(0, -1);
  const destination: Pt = { x: xAt(waypoints.length), y: h - 96 };
  const stops: Pt[] = [
    { x: xAt(0), y: 0 },
    ...checkpoints.map((y, i) => ({ x: xAt(i + 1), y })),
    destination,
  ];
  const d = splinePath(buildRoute(w, stops));

  const ticks: { y: number; major: boolean; label?: string }[] = [];
  for (let y = 60, n = 1; y < h - 40; y += 42, n++) {
    const major = n % 5 === 0;
    ticks.push({ y, major, label: major ? String(n * 2).padStart(2, '0') : undefined });
  }

  const start = stops[0];

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

        {/* Departure point */}
        <g className={s.startMark}>
          <circle cx={start.x} cy={start.y + 20} r="18" />
          <circle cx={start.x} cy={start.y + 20} r="7" className={s.startCore} />
        </g>

        {/* The road ahead. Always rendered, so the route exists with no script.
            Never add pathLength: it rescales distance-along-path and silently turns
            the dash pattern back into a solid line. */}
        <path className={s.routeSeg} d={d} />

        {/* The trail behind you, revealed by the growing clip. */}
        <g clipPath="url(#pn-route-clip)" className={s.trailGroup}>
          <path className={s.routeTrail} d={d} />
        </g>

        {checkpoints.map((y, i) => {
          const x = xAt(i + 1);
          return (
            <g
              key={`wp-${i}`}
              className={s.wp}
              ref={(el) => {
                wpRefs.current[i] = el;
              }}
            >
              <circle
                className={s.wpRipple}
                cx={x}
                cy={y}
                r={12}
                ref={(el) => {
                  rippleRefs.current[i] = el;
                }}
              />
              <circle className={s.wpHalo} cx={x} cy={y} r={24} />
              <circle className={s.wpDot} cx={x} cy={y} r={9} />
              <text className={s.wpNum} x={x + 36} y={y + 5}>
                {String(i + 1).padStart(2, '0')}
              </text>
            </g>
          );
        })}

        {/* The landing. Below the turn line, in the gap before the map. */}
        <g
          className={s.wp}
          ref={(el) => {
            wpRefs.current[checkpoints.length] = el;
          }}
        >
          <circle
            className={s.wpRipple}
            cx={destination.x}
            cy={destination.y}
            r={12}
            ref={(el) => {
              rippleRefs.current[checkpoints.length] = el;
            }}
          />
          <circle className={s.xHalo} cx={destination.x} cy={destination.y} r={30} />
          <g className={s.xGlyph}>
            <line x1={destination.x - 20} y1={destination.y - 20} x2={destination.x + 20} y2={destination.y + 20} />
            <line x1={destination.x + 20} y1={destination.y - 20} x2={destination.x - 20} y2={destination.y + 20} />
          </g>
        </g>

      </svg>
    </div>
  );
}
