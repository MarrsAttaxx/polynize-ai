import type { FigureKind } from './content';
import { VENDORS, VendorLogo, type VendorName } from './VendorLogos';
import s from './story.module.css';

/**
 * One figure per beat, occupying its own band between two blocks of copy.
 *
 * STYLE: instrument panel. Mint on near black, concentric arcs with gaps, dense radial
 * graduations, segmented rings, dashed bezels, corner brackets, wireframe terrain, and
 * a bloom on the bright elements. Marrs supplied HUD reference on 10 Aug 2026 and this
 * is built to it. It is not decoration for its own sake: the argument of these four
 * beats is that you are trying to navigate without instruments, so drawing actual
 * instruments that will not give a reading is the figure doing the work of the copy.
 *
 * WHY THIS FILE LOOKS LIKE A GENERATOR AND NOT A DRAWING. The first two versions were
 * about fifteen hand-placed shapes each and read as exactly that: thin, flat, obviously
 * drawn by someone counting coordinates. Detail at this scale is a quantity problem, not
 * a craft one. A convincing bezel carries 120 graduations, four arc segments at three
 * radii and a segmented ring. Nobody draws that by hand and no design tool makes it
 * quick. You generate it. Everything below is procedural and deterministic, evaluated
 * once at module scope, so server and client agree and nothing shimmers between renders.
 *
 * BLOOM WITHOUT FILTERS. Glow is done by drawing the same path twice, a wide faint
 * stroke under a thin bright one (.hudBloom / .hudLine). An SVG blur filter over a
 * thousand-pixel group is expensive and animating inside one is worse, so drop-shadow
 * is reserved for the few elements that genuinely need to burn.
 *
 * NODE BUDGET. Anything that never animates on its own is merged into a single <path>
 * with many subpaths: a 120 tick graduation ring is one node, not a hundred and twenty.
 *
 * FAIL-SAFE BY CONSTRUCTION, which is why these are CSS keyframes and not GSAP. Every
 * element is server-rendered at its finished geometry and the stylesheet base state is a
 * complete, legible drawing. Animation exists only while `.play` is on the container. No
 * script, no observer, a stalled ticker and reduced motion all land on something drawn.
 *
 * NO NUMERALS AND NO WORDS, and this is the one place the reference is deliberately NOT
 * followed. Every HUD in the source material is covered in readouts (75%, LOADING, 93).
 * These figures sit before the product is introduced, so a number on a dial would be
 * inventing evidence for a claim the page has not earned yet. The dials carry their
 * meaning in how far the arc has filled and in nothing else.
 *
 * ON THE VENDOR MARKS: real assets now, supplied by Marrs on 10 Aug 2026, living in
 * VendorLogos.tsx. They render monochrome; the reasoning is in that file.
 */

/* ================================================================== primitives */

const f = (n: number) => n.toFixed(1);

/** Deterministic PRNG. A random value here would be a hydration mismatch. */
function rand(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Degrees, zero at the top, clockwise. Every angle in this file uses it. */
const pol = (cx: number, cy: number, r: number, deg: number) => ({
  x: cx + Math.sin((deg * Math.PI) / 180) * r,
  y: cy - Math.cos((deg * Math.PI) / 180) * r,
});

function arc(cx: number, cy: number, r: number, d0: number, d1: number) {
  const a = pol(cx, cy, r, d0);
  const b = pol(cx, cy, r, d1);
  const large = Math.abs(d1 - d0) > 180 ? 1 : 0;
  return `M ${f(a.x)} ${f(a.y)} A ${r} ${r} 0 ${large} 1 ${f(b.x)} ${f(b.y)}`;
}

/** One annular sector. The building block of every segmented ring here. */
function sector(cx: number, cy: number, r0: number, r1: number, d0: number, d1: number) {
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
function segRing(
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
function tickRing(cx: number, cy: number, r0: number, r1: number, count: number, every = 0) {
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
function graticule(w: number, h: number, step: number, inset: number) {
  const d: string[] = [];
  for (let x = inset; x <= w - inset; x += step) d.push(`M ${x} ${inset} V ${h - inset}`);
  for (let y = inset; y <= h - inset; y += step) d.push(`M ${inset} ${y} H ${w - inset}`);
  return d.join(' ');
}

/** Corner brackets. The cheapest way to make a rectangle read as a viewport. */
function brackets(x: number, y: number, w: number, h: number, len: number) {
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
function mesh(
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
function globe(cx: number, cy: number, R: number) {
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


/* ================================================================== component */

/** Where the figure sits in its band. */
type FigurePlace = 'wide' | 'right' | 'centre';

const VIEWBOX: Record<FigureKind, string> = {
  scatter: '0 0 620 580',
  ambiguity: '0 0 1000 470',
  coordinates: '0 0 1000 400',
  guess: '0 0 1000 480',
};

const PLACE: Record<FigureKind, FigurePlace> = {
  // A single object wants a frame it fills, not a wide canvas to float in.
  scatter: 'centre',
  // The route swings from the middle out to the left edge across this gap, so the
  // figure sits right of centre rather than fighting it for the same space.
  ambiguity: 'right',
  coordinates: 'wide',
  guess: 'wide',
};

const PLACE_CLASS: Record<FigurePlace, string> = {
  wide: s.figWide,
  right: s.figRight,
  centre: s.figCentre,
};

export function BeatFigure({ kind }: { kind: FigureKind }) {
  return (
    <div className={s.figBand}>
      <div
        className={`${s.figure} ${PLACE_CLASS[PLACE[kind]]}`}
        data-fig={kind}
        aria-hidden="true"
      >
        <svg viewBox={VIEWBOX[kind]} className={s.figureSvg} focusable="false">
          {kind === 'scatter' && <LoneCompass />}
          {kind === 'ambiguity' && <VendorDrift />}
          {kind === 'coordinates' && <BenchmarkBars />}
          {kind === 'guess' && <SlotMachine />}
        </svg>
      </div>
    </div>
  );
}

function Person({ x, y, sc = 1 }: { x: number; y: number; sc?: number }) {
  return (
    <g transform={`translate(${f(x)} ${f(y)}) scale(${sc.toFixed(2)})`}>
      <circle cx="0" cy="-10" r="5.6" />
      <path d="M -9 13 a 9 9.5 0 0 1 18 0" />
    </g>
  );
}

function BotBody({ x, y, sc = 1 }: { x: number; y: number; sc?: number }) {
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
function Bezel({
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

/* ================================================================== beat 1
   A compass, on its own.

   The beat says you are lost. The figure is the instrument you would reach for, and it
   will not settle: the needle hunts past the bearing it is looking for and never lands
   on it. That is the entire idea, and it did not need a landscape around it. Everything
   else that used to be in this frame was atmosphere competing with the point. */

const C1 = { cx: 310, cy: 292, r: 196 };

/** An eight-point rose, each point split light and dark down its spine. */
function rosePoints(cx: number, cy: number, long: number, short: number, count: number) {
  const out: { light: string; dark: string }[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * 360;
    const tip = pol(cx, cy, long, a);
    const l = pol(cx, cy, short, a - 180 / count);
    const rgt = pol(cx, cy, short, a + 180 / count);
    out.push({
      light: `M ${f(tip.x)} ${f(tip.y)} L ${f(l.x)} ${f(l.y)} L ${cx} ${cy} Z`,
      dark: `M ${f(tip.x)} ${f(tip.y)} L ${f(rgt.x)} ${f(rgt.y)} L ${cx} ${cy} Z`,
    });
  }
  return out;
}

const ROSE8 = rosePoints(C1.cx, C1.cy, 130, 40, 8);
const ROSE16 = rosePoints(C1.cx, C1.cy, 72, 19, 16);

function LoneCompass() {
  return (
    <g className={s.hudScene}>
      <g className={s.hudGauge}>
        <Bezel cx={C1.cx} cy={C1.cy} r={C1.r} fill={0.44} seed={3} />

        {ROSE16.map((p, i) => (
          <g key={`m${i}`}>
            <path className={s.hudRoseDim} d={p.light} />
            <path className={s.hudRoseFaint} d={p.dark} />
          </g>
        ))}
        {ROSE8.map((p, i) => (
          <g key={`r${i}`}>
            <path className={s.hudRose} d={p.light} />
            <path className={s.hudRoseDim} d={p.dark} />
          </g>
        ))}

        {/* The bearing it is looking for, and never lands on. Inside the bezel, so it
            cannot fall off the top of the frame. */}
        <g className={s.hudTarget}>
          <circle cx={C1.cx} cy={C1.cy - C1.r + 26} r={11} />
          <path
            d={`M ${C1.cx} ${C1.cy - C1.r + 5} v -15 M ${C1.cx - 20} ${C1.cy - C1.r + 26} h -15 M ${
              C1.cx + 20
            } ${C1.cy - C1.r + 26} h 15`}
          />
        </g>

        <g className={s.hudNeedle}>
          <path
            className={s.hudNeedleGlow}
            d={`M ${C1.cx} ${C1.cy - 160} L ${C1.cx + 18} ${C1.cy - 4} L ${C1.cx} ${C1.cy - 27} L ${
              C1.cx - 18
            } ${C1.cy - 4} Z`}
          />
          <path
            className={s.hudNeedleN}
            d={`M ${C1.cx} ${C1.cy - 160} L ${C1.cx + 18} ${C1.cy - 4} L ${C1.cx} ${C1.cy - 27} L ${
              C1.cx - 18
            } ${C1.cy - 4} Z`}
          />
          <path
            className={s.hudNeedleS}
            d={`M ${C1.cx} ${C1.cy + 130} L ${C1.cx - 10} ${C1.cy + 9} L ${C1.cx} ${C1.cy + 23} L ${
              C1.cx + 10
            } ${C1.cy + 9} Z`}
          />
          <circle className={s.hudNeedleS} cx={C1.cx} cy={C1.cy + 141} r="7.5" />
        </g>
        <circle className={s.hudHub} cx={C1.cx} cy={C1.cy} r="15" />
        <circle className={s.hudDot} cx={C1.cx} cy={C1.cy} r="4" />
        <path
          className={s.hudGlass}
          d={`M ${C1.cx - 130} ${C1.cy - 98} A 166 166 0 0 1 ${C1.cx + 26} ${C1.cy - 162}`}
        />
      </g>
    </g>
  );
}

/* ================================================================== beat 2
   The vendors, floating loose, with the question nobody can answer.

   Real marks now (see VendorLogos.tsx), because the beat is about a market you have
   bought into without being able to tell what any of it is doing for you, and neutral
   badges could not carry that. They drift, they never line up, and question marks sit
   among them at the same weight. */

type Floater = { name: VendorName | 'q'; x: number; y: number; size: number; i: number };

/**
 * Hand placed, not generated, and that is the point: a loop produces rows, and rows
 * read as an ordered set. This is a pile of things you have bought that do not line up
 * with each other. One of each mark, never repeated, because a duplicate reads as a
 * pattern; the question repeats instead, since that IS the recurring thing.
 */
const FLOATERS: Floater[] = [
  { name: 'openai', x: 132, y: 118, size: 96, i: 0 },
  { name: 'anthropic', x: 336, y: 74, size: 80, i: 1 },
  { name: 'q', x: 476, y: 178, size: 76, i: 2 },
  { name: 'gemini', x: 606, y: 88, size: 88, i: 3 },
  { name: 'claude', x: 842, y: 132, size: 92, i: 4 },
  { name: 'q', x: 246, y: 262, size: 64, i: 5 },
  { name: 'copilot', x: 432, y: 322, size: 104, i: 6 },
  { name: 'q', x: 694, y: 258, size: 82, i: 7 },
  { name: 'grok', x: 148, y: 366, size: 84, i: 8 },
  { name: 'q', x: 906, y: 306, size: 70, i: 9 },
  { name: 'openclaw', x: 616, y: 392, size: 78, i: 10 },
  { name: 'q', x: 800, y: 404, size: 58, i: 11 },
];

function VendorDrift() {
  return (
    <g className={s.hudScene}>
      {FLOATERS.map((fl) => (
        <g key={fl.i} className={s.hudFloat} style={{ ['--i' as string]: fl.i }}>
          {fl.name === 'q' ? (
            <text
              className={s.hudQuery}
              x={f(fl.x)}
              y={f(fl.y + fl.size * 0.36)}
              style={{ fontSize: `${(fl.size * 1.05).toFixed(0)}px` }}
            >
              ?
            </text>
          ) : (
            <g className={s.hudVendor}>
              <VendorLogo name={fl.name} x={fl.x} y={fl.y} size={fl.size} />
            </g>
          )}
        </g>
      ))}
    </g>
  );
}

/* ================================================================== beat 3
   Readouts climbing towards a benchmark, and never getting there.

   The bars breathe and the benchmark drifts, which is the honest picture: neither your
   capability nor the standard it is measured against holds still. The compass that used
   to sit beside this moved to beat 1, where being lost is the actual subject.

   HOW THE BLOCKS WORK, because it is not obvious and it is easy to break: each bar is a
   SOLID rect that scales on Y, and the block separations are static background-coloured
   rules drawn across the whole chart on top. Scaling a stack of drawn blocks stretches
   them; scaling a solid bar behind fixed rules does not. */

const BAR_COUNT = 14;
const BAR_BASE = 316;
const BAR_TARGET = 76;
const BARS = Array.from({ length: BAR_COUNT }, (_, i) => {
  const r = rand(4400 + i);
  return {
    i,
    x: 62 + i * 64,
    // Capped so that h * the 1.14 breathe peak still clears the benchmark. A bar that
    // grows past the line while breathing argues the opposite of the copy.
    h: 50 + r() * 118,
    /** Every bar breathes on its own clock, so the field never pulses in unison. */
    // Faster than the first pass, which read as idling rather than as live readings.
    dur: 1.5 + r() * 1.1,
    delay: r() * 1.6,
  };
});

const BLOCK_RULES = (() => {
  const d: string[] = [];
  for (let y = BAR_BASE - 14; y > BAR_TARGET - 40; y -= 15) d.push(`M 30 ${y} H 970`);
  return d.join(' ');
})();

const CHART_GRID = (() => {
  const d: string[] = [];
  for (let y = BAR_BASE - 52; y > BAR_TARGET; y -= 52) d.push(`M 40 ${y} H 962`);
  return d.join(' ');
})();

function BenchmarkBars() {
  return (
    <g className={s.hudScene}>
      <path className={s.hudGrid} d={CHART_GRID} />

      {/* The headroom each bar is not using. Static, and outside the breathing group, so
          it can never scale up past the benchmark. */}
      {BARS.map((b) => (
        <rect
          key={`g${b.i}`}
          className={s.hudBarDim}
          x={b.x - 20}
          y={BAR_TARGET + 14}
          width="40"
          height={BAR_BASE - BAR_TARGET - 14}
          rx="2"
        />
      ))}

      {BARS.map((b) => (
        <g
          key={b.i}
          className={s.hudBreathe}
          style={{
            ['--i' as string]: b.i,
            ['--dur' as string]: `${b.dur.toFixed(2)}s`,
            ['--delay' as string]: `${b.delay.toFixed(2)}s`,
          }}
        >
          <rect className={s.hudBarLit} x={b.x - 20} y={BAR_BASE - b.h} width="40" height={b.h} rx="2" />
        </g>
      ))}

      {/* The separations, painted in the page colour over the top of the bars. */}
      <path className={s.hudBlockRule} d={BLOCK_RULES} />
      <path className={s.hudAxis} d={`M 40 ${BAR_BASE} H 962`} />

      {/* One person per column, so a reader knows what a bar is a reading OF. */}
      <g className={s.hudHuman}>
        {BARS.map((b) => (
          <Person key={`p${b.i}`} x={b.x} y={BAR_BASE + 46} sc={1.2} />
        ))}
      </g>

      {/* The benchmark. It drifts, because the standard moves too. */}
      <g className={s.hudTargetDrift}>
        <path className={s.hudBloom} d={`M 40 ${BAR_TARGET} H 962`} />
        <path className={s.hudTargetLine} d={`M 40 ${BAR_TARGET} H 962`} />
        <path className={s.hudTargetCap} d={`M 40 ${BAR_TARGET - 11} v 22 M 962 ${BAR_TARGET - 11} v 22`} />
      </g>
    </g>
  );
}

/* ================================================================== beat 4
   A slot machine.

   The copy says every investment decision is a guess. Three reels turning and never
   stopping is that sentence with nothing left to interpret: vendors, agents and people
   going past, and you commit the budget to whatever happens to be in the window.

   The reels loop seamlessly because each one renders its symbol list TWICE and travels
   exactly one list length. Change the list and the travel distance follows it, so do
   not hard code the translate.
*/

type Symb = VendorName | 'bot' | 'human' | 'query';

const REEL_SYMBOLS: Symb[][] = [
  ['openai', 'bot', 'gemini', 'human', 'claude', 'query', 'grok', 'bot'],
  ['human', 'anthropic', 'query', 'copilot', 'bot', 'openclaw', 'human', 'gemini'],
  ['query', 'grok', 'human', 'openai', 'bot', 'claude', 'copilot', 'query'],
];

const CELL_H = 112;
const WIN = { y: 70, h: 340, w: 236 };
const REEL_X = [240, 500, 760];
/** Each reel turns at its own speed. Three identical reels read as one moving object. */
const REEL_DUR = ['5.4s', '3.9s', '6.7s'];

function ReelSymbol({ kind, y }: { kind: Symb; y: number }) {
  if (kind === 'query') {
    return (
      <text className={s.hudQuery} x="0" y={y + 22} style={{ fontSize: '64px' }}>
        ?
      </text>
    );
  }
  if (kind === 'bot') {
    return (
      <g className={s.hudBot}>
        <BotBody x={0} y={y} sc={2.5} />
      </g>
    );
  }
  if (kind === 'human') {
    return (
      <g className={s.hudHuman}>
        <Person x={0} y={y} sc={2.5} />
      </g>
    );
  }
  return (
    <g className={s.hudVendor}>
      <VendorLogo name={kind} x={0} y={y} size={66} />
    </g>
  );
}

function SlotMachine() {
  const travel = REEL_SYMBOLS[0].length * CELL_H;
  return (
    <g className={s.hudScene}>
      <defs>
        <clipPath id="pn-reel-clip">
          <rect x={0} y={WIN.y} width={WIN.w} height={WIN.h} />
        </clipPath>
      </defs>

      {REEL_X.map((rx, r) => (
        <g key={r} transform={`translate(${rx - WIN.w / 2} 0)`}>
          <rect className={s.hudDisc} x={0} y={WIN.y} width={WIN.w} height={WIN.h} rx="8" />
          <g clipPath="url(#pn-reel-clip)">
            {/* The centring lives on THIS group, which never animates. Putting it on the
                animated group loses it: a CSS transform from a keyframe replaces the SVG
                transform attribute outright, so the symbols snapped to x = 0 the moment
                the reel started turning. */}
            <g transform={`translate(${WIN.w / 2} 0)`}>
              <g
                className={s.hudReel}
                style={{ ['--travel' as string]: `${-travel}px`, ['--dur' as string]: REEL_DUR[r] }}
              >
                {[0, 1].map((pass) =>
                  REEL_SYMBOLS[r].map((sym, i) => (
                    <ReelSymbol
                      key={`${pass}-${i}`}
                      kind={sym}
                      y={WIN.y + 48 + (pass * REEL_SYMBOLS[r].length + i) * CELL_H}
                    />
                  ))
                )}
              </g>
            </g>
          </g>
          <rect className={s.hudReelFrame} x={0} y={WIN.y} width={WIN.w} height={WIN.h} rx="8" />
        </g>
      ))}

      {/* The payline. Whatever is sitting on it when you stop is what you funded. */}
      <path className={s.hudBloom} d={`M 96 ${WIN.y + WIN.h / 2} H 904`} />
      <path className={s.hudPayline} d={`M 96 ${WIN.y + WIN.h / 2} H 904`} />
      <path
        className={s.hudTargetCap}
        d={`M 96 ${WIN.y + WIN.h / 2 - 14} v 28 M 904 ${WIN.y + WIN.h / 2 - 14} v 28`}
      />
    </g>
  );
}
