/**
 * The instrument-panel kit: primitives every beat figure is generated from.
 *
 * Split out of BeatFigure.tsx when /mapping stopped being the only page using it. The
 * style notes that used to live here now sit in figures-ai.tsx and figures-work.tsx,
 * because they are about what the figures ARGUE; this file is only about how they are
 * drawn.
 *
 * Everything is deterministic and evaluated at module scope, so server and client agree
 * and nothing shimmers between renders. Anything that never animates on its own is
 * merged into a single <path> with many subpaths: a 120 tick graduation ring is one
 * node, not a hundred and twenty.
 *
 * BLOOM WITHOUT FILTERS. Glow is the same path drawn twice, a wide faint stroke under a
 * thin bright one (.hudBloom / .hudLine). An SVG blur over a thousand-pixel group is
 * expensive and animating inside one is worse, so drop-shadow is reserved for the few
 * elements that must actually burn.
 */

import s from './story.module.css';

export const f = (n: number) => n.toFixed(1);

/** Deterministic PRNG. A random value here would be a hydration mismatch. */
export function rand(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Degrees, zero at the top, clockwise. Every angle in this file uses it. */
export const pol = (cx: number, cy: number, r: number, deg: number) => ({
  x: cx + Math.sin((deg * Math.PI) / 180) * r,
  y: cy - Math.cos((deg * Math.PI) / 180) * r,
});

export function arc(cx: number, cy: number, r: number, d0: number, d1: number) {
  const a = pol(cx, cy, r, d0);
  const b = pol(cx, cy, r, d1);
  const large = Math.abs(d1 - d0) > 180 ? 1 : 0;
  return `M ${f(a.x)} ${f(a.y)} A ${r} ${r} 0 ${large} 1 ${f(b.x)} ${f(b.y)}`;
}

/** One annular sector. The building block of every segmented ring here. */
export function sector(cx: number, cy: number, r0: number, r1: number, d0: number, d1: number) {
  const a0 = pol(cx, cy, r1, d0);
  const a1 = pol(cx, cy, r1, d1);
  const b1 = pol(cx, cy, r0, d1);
  const b0 = pol(cx, cy, r0, d0);
  const large = Math.abs(d1 - d0) > 180 ? 1 : 0;
  return (
    `M ${f(a0.x)} ${f(a0.y)} A ${r1} ${r1} 0 ${large} 1 ${f(a1.x)} ${f(a1.y)}` +
    ` L ${f(b1.x)} ${f(b1.y)} A ${r0} ${r0} 0 ${large} 0 ${f(b0.x)} ${f(b0.y)} Z`
  );
}

/** A ring of separated blocks, as one path. `from`/`to` fill only part of it. */
export function segRing(
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  count: number,
  gap: number,
  from = 0,
  to = count
) {
  const step = 360 / count;
  const d: string[] = [];
  for (let i = from; i < to; i++) {
    d.push(sector(cx, cy, r0, r1, i * step + gap / 2, (i + 1) * step - gap / 2));
  }
  return d.join(' ');
}

/** Radial graduations, as one path. `every` gives the long ones. */
export function tickRing(cx: number, cy: number, r0: number, r1: number, count: number, every = 0) {
  const d: string[] = [];
  for (let i = 0; i < count; i++) {
    if (every && i % every !== 0) continue;
    const a = (i * 360) / count;
    const p = pol(cx, cy, r0, a);
    const q = pol(cx, cy, r1, a);
    d.push(`M ${f(p.x)} ${f(p.y)} L ${f(q.x)} ${f(q.y)}`);
  }
  return d.join(' ');
}

/** One path holding a whole background grid. */
export function graticule(w: number, h: number, step: number, inset: number) {
  const d: string[] = [];
  for (let x = inset; x <= w - inset; x += step) d.push(`M ${x} ${inset} V ${h - inset}`);
  for (let y = inset; y <= h - inset; y += step) d.push(`M ${inset} ${y} H ${w - inset}`);
  return d.join(' ');
}

/** Corner brackets. The cheapest way to make a rectangle read as a viewport. */
export function brackets(x: number, y: number, w: number, h: number, len: number) {
  return [
    `M ${x} ${y + len} V ${y} H ${x + len}`,
    `M ${x + w - len} ${y} H ${x + w} V ${y + len}`,
    `M ${x + w} ${y + h - len} V ${y + h} H ${x + w - len}`,
    `M ${x + len} ${y + h} H ${x} V ${y + h - len}`,
  ].join(' ');
}

/**
 * A perspective wireframe surface. Rows recede toward the top and narrow as they go,
 * and a pair of out-of-phase sines gives it terrain rather than a flat plane.
 */
export function mesh(
  cx: number,
  top: number,
  w: number,
  h: number,
  cols: number,
  rows: number,
  seed: number,
  amp = 20
) {
  const r = rand(seed);
  const ph = [r() * 6.283, r() * 6.283];
  const pt = (i: number, j: number) => {
    const t = j / rows;
    const persp = 0.3 + t * 0.7;
    const x = cx + (i / cols - 0.5) * w * persp;
    const wave =
      (Math.sin((i / cols) * 6.5 + ph[0]) * Math.cos(t * 3.4 + ph[1]) +
        Math.sin((i / cols) * 2.1 + ph[1]) * 0.6) *
      amp *
      persp;
    return { x, y: top + Math.pow(t, 1.4) * h - wave };
  };
  const d: string[] = [];
  for (let j = 0; j <= rows; j++) {
    let seg = '';
    for (let i = 0; i <= cols; i++) {
      const p = pt(i, j);
      seg += `${i ? ' L ' : 'M '}${f(p.x)} ${f(p.y)}`;
    }
    d.push(seg);
  }
  for (let i = 0; i <= cols; i++) {
    let seg = '';
    for (let j = 0; j <= rows; j++) {
      const p = pt(i, j);
      seg += `${j ? ' L ' : 'M '}${f(p.x)} ${f(p.y)}`;
    }
    d.push(seg);
  }
  return d.join(' ');
}

/** A wireframe globe, as one path: five latitudes and five meridians. */
export function globe(cx: number, cy: number, R: number) {
  const d: string[] = [`M ${cx - R} ${cy} A ${R} ${R} 0 1 0 ${cx + R} ${cy} A ${R} ${R} 0 1 0 ${cx - R} ${cy}`];
  for (const t of [-0.66, -0.34, 0, 0.34, 0.66]) {
    const dy = R * t;
    const rx = Math.sqrt(Math.max(0, R * R - dy * dy));
    const ry = Math.max(2, rx * 0.26);
    d.push(
      `M ${f(cx - rx)} ${f(cy + dy)} A ${f(rx)} ${f(ry)} 0 1 0 ${f(cx + rx)} ${f(cy + dy)}` +
        ` A ${f(rx)} ${f(ry)} 0 1 0 ${f(cx - rx)} ${f(cy + dy)}`
    );
  }
  for (const w of [R, R * 0.62, R * 0.26]) {
    d.push(
      `M ${cx} ${f(cy - R)} A ${f(w)} ${R} 0 1 0 ${cx} ${f(cy + R)}` +
        ` A ${f(w)} ${R} 0 1 0 ${cx} ${f(cy - R)}`
    );
  }
  return d.join(' ');
}

export function Person({ x, y, sc = 1 }: { x: number; y: number; sc?: number }) {
  return (
    <g transform={`translate(${f(x)} ${f(y)}) scale(${sc.toFixed(2)})`}>
      <circle cx="0" cy="-10" r="5.6" />
      <path d="M -9 13 a 9 9.5 0 0 1 18 0" />
    </g>
  );
}

export function BotBody({ x, y, sc = 1 }: { x: number; y: number; sc?: number }) {
  return (
    <g transform={`translate(${f(x)} ${f(y)}) scale(${sc.toFixed(2)})`}>
      <rect x="-8.5" y="-8.5" width="17" height="15" rx="3.5" />
      <circle className={s.hudDot} cx="-3.6" cy="-1.8" r="1.8" />
      <circle className={s.hudDot} cx="3.6" cy="-1.8" r="1.8" />
      <path d="M 0 -8.5 v -5.5 M -12 -2 h -3 M 12 -2 h 3 M -5 6.5 v 4.5 M 5 6.5 v 4.5" />
    </g>
  );
}

/**
 * A bezel. Every dial in this file is one of these plus something in the middle, which
 * is what keeps the figures reading as one instrument family.
 */
export function Bezel({
  cx,
  cy,
  r,
  fill = 0.62,
  seed = 1,
  dense = true,
}: {
  cx: number;
  cy: number;
  r: number;
  /** How far round the live arc has travelled, 0 to 1. Never 1: nothing completes. */
  fill?: number;
  seed?: number;
  dense?: boolean;
}) {
  const rr = rand(seed);
  const segs = dense ? 36 : 20;
  const to = Math.max(2, Math.round(segs * fill));
  const gapStart = 40 + rr() * 60;
  return (
    <g>
      <circle className={s.hudDisc} cx={cx} cy={cy} r={r * 0.82} />
      {dense && <path className={s.hudTickFine} d={tickRing(cx, cy, r * 0.86, r * 0.98, 120)} />}
      <path className={s.hudTick} d={tickRing(cx, cy, r * 0.84, r * 1.0, 120, 10)} />
      <path className={s.hudSegDim} d={segRing(cx, cy, r * 1.05, r * 1.16, segs, 3.4)} />
      <path className={s.hudBloom} d={segRing(cx, cy, r * 1.05, r * 1.16, segs, 3.4, 0, to)} />
      <path className={s.hudSeg} d={segRing(cx, cy, r * 1.05, r * 1.16, segs, 3.4, 0, to)} />
      <circle className={s.hudRingThin} cx={cx} cy={cy} r={r * 1.01} />
      <path className={s.hudBloom} d={arc(cx, cy, r * 1.26, gapStart, gapStart + 140)} />
      <path className={s.hudLine} d={arc(cx, cy, r * 1.26, gapStart, gapStart + 140)} />
      <path className={s.hudLineDim} d={arc(cx, cy, r * 1.26, gapStart + 168, gapStart + 300)} />
      <circle className={s.hudRingDash} cx={cx} cy={cy} r={r * 1.36} />
    </g>
  );
}
