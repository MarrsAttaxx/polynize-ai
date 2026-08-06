'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import s from './story.module.css';

/**
 * The plotted route: a survey chart rail that draws itself as you descend.
 *
 * Reference is Marrs's treasure-chart render: a start marker, a thick glowing dashed
 * path, terrain, a scale ruler, and an X at the destination. Rendered in brand mint on
 * our own dark ground rather than the reference's navy.
 *
 * WHY GSAP. This was hand-rolled twice, first on a raw scroll listener and then on
 * IntersectionObserver, and both were either jittery or lost the drawing effect
 * entirely. ScrollTrigger's `scrub` interpolates between frames, which is the
 * difference between a line that snaps and one that feels drawn.
 *
 * FAIL-SAFE. The faint full route is server-rendered and always visible, so the rail
 * exists with no JavaScript at all. GSAP only ever adds the bright trail on top. And
 * every text reveal uses gsap.from(), whose no-JS state is the FINAL state, so nothing
 * on this page is hidden waiting for a script.
 */

gsap.registerPlugin(ScrollTrigger);

const W = 132;
const CX = W / 2;
const AMP_MAX = 46;

/** Fixed wander table. Deterministic: a random value here is a hydration mismatch. */
const SCRIBBLE = [1, -0.86, 0.58, -1, 0.42, -0.72, 0.94, -0.34, 0.66, -0.95, 0.5, -0.62];

const decayFor = (i: number, total: number) =>
  total <= 1 ? 0 : Math.pow(Math.max(0, 1 - i / (total - 1)), 1.5);

/**
 * One segment, centreline to centreline. Amplitude scales with segment height so the
 * wander holds its character from 375px to 1920px; a quadratic deviates by half its
 * control offset, hence the 2x.
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
    d += ` Q ${(CX + swing * amp * 2).toFixed(1)} ${(y - step / 2).toFixed(1)}, ${CX} ${y.toFixed(1)}`;
  }
  return d;
}

export function StoryPath({ beatCount }: { beatCount: number }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const clipRef = useRef<SVGRectElement | null>(null);
  const wpRefs = useRef<(SVGGElement | null)[]>([]);
  const xRef = useRef<SVGGElement | null>(null);
  const [height, setHeight] = useState(0);
  const [waypoints, setWaypoints] = useState<number[]>([]);

  // Measure the section and each beat's centre.
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
    const ro = new ResizeObserver(() => {
      measure();
      ScrollTrigger.refresh();
    });
    ro.observe(section);
    (document as Document & { fonts?: FontFaceSet }).fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, [beatCount]);

  // Draw the trail, light the waypoints, plant the X.
  useEffect(() => {
    const host = hostRef.current;
    const section = host?.parentElement;
    if (!section || !height || !waypoints.length) return;

    const ctx = gsap.context(() => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (reduce) {
        gsap.set(clipRef.current, { attr: { height } });
        wpRefs.current.forEach((g) => g && g.classList.add(s.wpOn));
        gsap.set(xRef.current, { opacity: 1, scale: 1 });
        section.setAttribute('data-reached', String(waypoints.length - 1));
        return;
      }

      // The route inks in, scrubbed against scroll. scrub: 0.7 lets it lag slightly
      // behind the wheel, which is what makes it feel drawn rather than dragged.
      gsap.to(clipRef.current, {
        attr: { height },
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top 55%',
          end: 'bottom 65%',
          scrub: 0.7,
          onUpdate: (self) => {
            const travelled = self.progress * height;
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

      // The destination lands on the turn beat, not at the very bottom.
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
  }, [height, waypoints]);

  if (!height || !waypoints.length) {
    return <div className={s.rail} ref={hostRef} aria-hidden="true" />;
  }

  const nodes = [0, ...waypoints, height];
  const segCount = nodes.length - 1;
  const paths = nodes
    .slice(0, -1)
    .map((y0, i) => segmentPath(y0, nodes[i + 1], decayFor(i, segCount), i * 3));

  // Survey scale down the edge of the rail, as in the reference render.
  const ticks: { y: number; major: boolean; label?: string }[] = [];
  for (let y = 60, n = 1; y < height - 40; y += 42, n++) {
    const major = n % 5 === 0;
    ticks.push({ y, major, label: major ? String(n * 2).padStart(2, '0') : undefined });
  }

  const startY = Math.max(10, nodes[0] + 6);
  const endY = height - 8;

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
          <clipPath id="pn-route-clip">
            <rect ref={clipRef} x="0" y="0" width={W} height="0" />
          </clipPath>
        </defs>

        {/* Scale ruler */}
        <g className={s.scaleRule}>
          <line x1="10" y1={40} x2="10" y2={height - 30} />
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1="10" y1={t.y} x2={t.major ? 20 : 15} y2={t.y} />
              {t.label && (
                <text className={s.scaleNum} x="24" y={t.y + 3}>
                  {t.label}
                </text>
              )}
            </g>
          ))}
        </g>

        {/* Start marker: a surveyed point of departure */}
        <g className={s.startMark}>
          <circle cx={CX} cy={startY} r="9" />
          <circle cx={CX} cy={startY} r="3.5" className={s.startCore} />
        </g>

        {/* The road ahead. Always rendered, so the route exists with no script.
            Never add pathLength: it rescales distance-along-path and silently turns
            the dash pattern back into a solid line. */}
        {paths.map((d, i) => (
          <path key={`base-${i}`} className={s.routeSeg} d={d} />
        ))}

        {/* The trail behind you, revealed by the growing clip. */}
        <g clipPath="url(#pn-route-clip)" className={s.trailGroup}>
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

        {/* X marks the destination: the capability map, one section below. */}
        <g className={s.xMark} ref={xRef}>
          <line x1={CX - 9} y1={endY - 9} x2={CX + 9} y2={endY + 9} />
          <line x1={CX + 9} y1={endY - 9} x2={CX - 9} y2={endY + 9} />
        </g>
      </svg>
    </div>
  );
}
