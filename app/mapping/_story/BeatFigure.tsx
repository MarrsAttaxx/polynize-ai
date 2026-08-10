import type { FigureKind } from './content';
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
 * ON THE VENDOR MARKS: beats 1 and 4 use neutral badges rather than real OpenAI /
 * Anthropic / Gemini / Copilot logos. Drawing third-party trademarks from memory would
 * be both inaccurate and a real trademark exposure on a commercial page. They are one
 * component (`VendorMark`) so real assets can drop in once that call is made.
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

/** Where the figure sits in its band. Beat 2 goes right, to balance the route. */
type FigurePlace = 'wide' | 'right';

const VIEWBOX: Record<FigureKind, string> = {
  scatter: '0 0 1000 570',
  ambiguity: '0 0 1000 500',
  coordinates: '0 0 1000 500',
  guess: '0 0 1000 520',
};

const PLACE: Record<FigureKind, FigurePlace> = {
  scatter: 'wide',
  // The route swings from the middle out to the left edge across this gap, so the
  // figure sits right of centre rather than fighting it for the same space.
  ambiguity: 'right',
  coordinates: 'wide',
  guess: 'wide',
};

export function BeatFigure({ kind }: { kind: FigureKind }) {
  return (
    <div className={s.figBand}>
      <div
        className={`${s.figure} ${PLACE[kind] === 'right' ? s.figRight : s.figWide}`}
        data-fig={kind}
        aria-hidden="true"
      >
        <svg viewBox={VIEWBOX[kind]} className={s.figureSvg} focusable="false">
          {kind === 'scatter' && <NavDisplay />}
          {kind === 'ambiguity' && <ContactScan />}
          {kind === 'coordinates' && <GaugeCluster />}
          {kind === 'guess' && <DialWall />}
        </svg>
      </div>
    </div>
  );
}

/** Placeholder for a vendor mark. Swap for real assets if the trademark call is made. */
function VendorMark({ x, y, i, r = 15 }: { x: number; y: number; i: number; r?: number }) {
  const k = r * 0.42;
  const glyphs = [
    <circle key="a" cx={x} cy={y} r={k * 0.9} />,
    <rect key="b" x={x - k} y={y - k} width={k * 2} height={k * 2} rx={k * 0.4} />,
    <path key="c" d={`M ${x} ${y - k * 1.2} L ${x + k * 1.1} ${y + k} L ${x - k * 1.1} ${y + k} Z`} />,
    <path key="d" d={`M ${x} ${y - k * 1.25} L ${x + k * 1.25} ${y} L ${x} ${y + k * 1.25} L ${x - k * 1.25} ${y} Z`} />,
    <path key="e" d={`M ${x - k * 1.2} ${y} h ${k * 2.4} M ${x} ${y - k * 1.2} v ${k * 2.4}`} />,
    <path key="f" d={`M ${x - k} ${y - k} L ${x + k} ${y + k} M ${x + k} ${y - k} L ${x - k} ${y + k}`} />,
  ];
  return (
    <g className={s.hudMark}>
      <circle className={s.hudMarkDisc} cx={x} cy={y} r={r} />
      {glyphs[i % glyphs.length]}
    </g>
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
 * is what makes the four figures read as one instrument family.
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
      {dense && (
        <path className={s.hudTickFine} d={tickRing(cx, cy, r * 0.86, r * 0.98, 120)} />
      )}
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
   AI World, as a navigation display that will not hold a fix.

   A wireframe world under an instrument bezel, with six territories staked on it by
   somebody else. It comes up sharp, holds, then loses lock: the bezel drifts, the
   terrain softens, and the whole display fades back. The reader is looking at the
   moment the instrument stops being trustworthy, which is the beat exactly. */

const NAV = { cx: 500, cy: 214, r: 128 };
const HORIZON_Y = 252;
/* Wider than the frame on purpose. A surface that stops inside the viewport reads as an
   object; one that runs off both edges reads as ground you are standing on. */
const NAV_MESH = mesh(NAV.cx, HORIZON_Y, 1500, 300, 30, 14, 20260810, 30);

/** Six claims, standing on the near ground so they read as staked rather than labelled. */
const TERRITORIES = [
  { x: 120, y: 520, h: 78 },
  { x: 286, y: 466, h: 44 },
  { x: 448, y: 512, h: 70 },
  { x: 610, y: 462, h: 40 },
  { x: 772, y: 516, h: 74 },
  { x: 906, y: 470, h: 46 },
];

function NavDisplay() {
  return (
    <g className={s.hudScene}>
      <path className={s.hudFrame} d={brackets(22, 22, 956, 526, 34)} />

      <g className={s.hudWorld}>
        <clipPath id="pn-nav-clip">
          <rect x="30" y="30" width="940" height="510" />
        </clipPath>
        <g clipPath="url(#pn-nav-clip)">
          <path className={s.hudMesh} d={NAV_MESH} />
          <path className={s.hudBloom} d={`M 30 ${HORIZON_Y} H 970`} />
          <path className={s.hudHorizon} d={`M 30 ${HORIZON_Y} H 970`} />

          {/* Staked ground. A pole and a marker, so it reads as a claim, not a label. */}
          {TERRITORIES.map((t, i) => (
            <g key={i} className={s.hudStake} style={{ ['--i' as string]: i }}>
              <circle className={s.hudDot} cx={t.x} cy={t.y} r={3.6} />
              <path className={s.hudLineDim} d={`M ${t.x} ${t.y} V ${t.y - t.h}`} />
              <VendorMark x={t.x} y={t.y - t.h - 17} i={i} r={17} />
            </g>
          ))}
        </g>

        {/* The display itself, sitting on the horizon. The globe goes AFTER the bezel:
            Bezel paints its own dark disc, so anything drawn before it is covered. */}
        <g className={s.hudBezelDrift}>
          <Bezel cx={NAV.cx} cy={NAV.cy} r={NAV.r} fill={0.58} seed={7} />
        </g>
        <path className={s.hudGlobe} d={globe(NAV.cx, NAV.cy, NAV.r * 0.58)} />
      </g>

      {/* Side readouts. Segmented, so the eye reads instrumentation without a number. */}
      <g className={s.hudSide}>
        <path className={s.hudSegDim} d={ladder(52, 330, 26, 9, 12)} />
        <path className={s.hudSeg} d={ladder(52, 330, 26, 9, 12, 5)} />
        <path className={s.hudSegDim} d={ladder(922, 330, 26, 9, 12)} />
        <path className={s.hudSeg} d={ladder(922, 330, 26, 9, 12, 3)} />
        <path
          className={s.hudLineDim}
          d="M 52 100 h 26 M 52 114 h 26 M 52 128 h 16 M 922 100 h 26 M 922 114 h 16 M 922 128 h 26"
        />
      </g>
    </g>
  );
}

/** A vertical stack of blocks, filled from the bottom. One path. */
function ladder(x: number, y: number, w: number, h: number, n: number, filled = n) {
  const d: string[] = [];
  for (let i = 0; i < n; i++) {
    if (i >= filled) continue;
    const yy = y + (n - 1 - i) * (h + 5);
    d.push(`M ${x} ${yy} h ${w} v ${h} h ${-w} Z`);
  }
  return d.join(' ');
}

/* ================================================================== beat 2
   A contact scanner losing everything it was tracking.

   Humans and bots sit on the field as tracked contacts inside a HUD viewport. A sweep
   passes, and behind it the contacts drop off one by one until the display is empty.
   Effort went in; nothing is left that anyone can point at. */

type Contact = { x: number; y: number; k: 'h' | 'b'; sc: number; layer: 0 | 1 | 2; i: number };

const CONTACTS: Contact[] = (() => {
  const r = rand(70707);
  const rows: { y: number; n: number; sc: number; layer: 0 | 1 | 2 }[] = [
    { y: 150, n: 14, sc: 0.6, layer: 0 },
    { y: 250, n: 12, sc: 0.85, layer: 1 },
    { y: 362, n: 9, sc: 1.12, layer: 2 },
  ];
  const out: Contact[] = [];
  let i = 0;
  for (const row of rows) {
    for (let c = 0; c < row.n; c++) {
      const span = 830 / row.n;
      out.push({
        x: 96 + span * (c + 0.5) + (r() - 0.5) * span * 0.46,
        y: row.y + (r() - 0.5) * 32,
        // Roughly one in four is a bot, never two adjacent, so it reads as seeded
        // through the crowd rather than sorted into groups.
        k: (c + row.layer) % 4 === 1 ? 'b' : 'h',
        sc: row.sc * (0.92 + r() * 0.16),
        layer: row.layer,
        i: i++,
      });
    }
  }
  return out;
})();

const SCAN_GRID = (() => {
  const d: string[] = [];
  for (let x = 96; x <= 926; x += 34) d.push(`M ${x} 96 V 434`);
  for (let y = 96; y <= 434; y += 34) d.push(`M 96 ${y} H 926`);
  return d.join(' ');
})();

function ContactScan() {
  return (
    <g className={s.hudScene}>
      <path className={s.hudFrame} d={brackets(40, 44, 920, 412, 30)} />
      <path className={s.hudGrid} d={SCAN_GRID} />
      <path className={s.hudLineDim} d="M 96 96 H 926 V 434 H 96 Z" />

      {/* Range arcs from the sensor origin at the lower left. Clipped, because an arc
          escaping the panel stops the panel reading as a screen. */}
      <clipPath id="pn-scan-clip">
        <rect x="96" y="96" width="830" height="338" />
      </clipPath>
      <g clipPath="url(#pn-scan-clip)">
        {[150, 280, 410, 540, 680, 820].map((r, i) => (
          <path key={i} className={s.hudArcFaint} d={arc(96, 434, r, 0, 90)} />
        ))}
      </g>

      {CONTACTS.map((c) => (
        <g
          key={c.i}
          className={`${c.k === 'b' ? s.hudBot : s.hudHuman} ${s.hudDrop} ${
            c.layer === 0 ? s.figDeep : c.layer === 1 ? s.figMid : s.figNear
          }`}
          style={{ ['--i' as string]: c.i }}
        >
          {/* The tracking bracket is what makes it a contact and not an icon. */}
          <path
            className={s.hudTrack}
            d={brackets(c.x - 15 * c.sc, c.y - 19 * c.sc, 30 * c.sc, 36 * c.sc, 7 * c.sc)}
          />
          {c.k === 'b' ? <BotBody x={c.x} y={c.y} sc={c.sc} /> : <Person x={c.x} y={c.y} sc={c.sc} />}
        </g>
      ))}

      {/* The sweep. It passes once and the field is empty behind it. */}
      <g className={s.hudSweep}>
        <path className={s.hudSweepBeam} d="M 96 434 L 96 -106" />
      </g>

      <g className={s.hudSide}>
        <path className={s.hudSegDim} d={ladder(940, 120, 24, 8, 14)} />
        <path className={`${s.hudSeg} ${s.hudDrain}`} d={ladder(940, 120, 24, 8, 14, 11)} />
      </g>
    </g>
  );
}

/* ================================================================== beat 3
   The instrument cluster. A heading indicator whose needle hunts and never settles,
   beside a bank of readouts climbing towards a target none of them reaches.

   No numerals: the target is a line, not a score. */

const C3 = { cx: 256, cy: 268, r: 168 };

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

const ROSE8 = rosePoints(C3.cx, C3.cy, 112, 34, 8);
const ROSE16 = rosePoints(C3.cx, C3.cy, 62, 16, 16);

const BARS = [
  { h: 86 }, { h: 158 }, { h: 62 }, { h: 196 }, { h: 118 },
  { h: 74 }, { h: 172 }, { h: 104 }, { h: 142 },
].map((b, i) => ({ ...b, x: 560 + i * 44, i }));
const BASE_Y = 424;
const TARGET_Y = 124;
const BAR_W = 30;

/** Each bar is a stack of lit blocks rather than a solid rectangle. One path per bar. */
const barBlocks = (h: number, x: number) => {
  const d: string[] = [];
  for (let y = BASE_Y - 12; y > BASE_Y - h; y -= 15) {
    d.push(`M ${x - BAR_W / 2} ${y} h ${BAR_W} v 11 h ${-BAR_W} Z`);
  }
  return d.join(' ');
};

/** The distance each one is short by, drawn as a faint dotted leader. */
const BAR_GAPS = BARS.map((b) => `M ${b.x} ${BASE_Y - b.h - 8} V ${TARGET_Y + 8}`).join(' ');

const CHART_GRID = (() => {
  const d: string[] = [];
  for (let y = BASE_Y - 50; y > TARGET_Y - 20; y -= 50) d.push(`M 534 ${y} H 962`);
  return d.join(' ');
})();

function GaugeCluster() {
  return (
    <g className={s.hudScene}>
      <path className={s.hudFrame} d={brackets(24, 34, 952, 434, 30)} />

      <g className={s.hudGauge}>
        <Bezel cx={C3.cx} cy={C3.cy} r={C3.r} fill={0.44} seed={3} />

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

        {/* The reading it is looking for, and never lands on. Inside the bezel, so it
            cannot fall off the top of the frame. */}
        <g className={s.hudTarget}>
          <circle cx={C3.cx} cy={C3.cy - C3.r + 22} r={10} />
          <path d={`M ${C3.cx} ${C3.cy - C3.r + 4} v -14 M ${C3.cx - 18} ${C3.cy - C3.r + 22} h -14 M ${C3.cx + 18} ${C3.cy - C3.r + 22} h 14`} />
        </g>

        <g className={s.hudNeedle}>
          <path className={s.hudNeedleGlow} d={`M ${C3.cx} ${C3.cy - 138} L ${C3.cx + 16} ${C3.cy - 4} L ${C3.cx} ${C3.cy - 24} L ${C3.cx - 16} ${C3.cy - 4} Z`} />
          <path className={s.hudNeedleN} d={`M ${C3.cx} ${C3.cy - 138} L ${C3.cx + 16} ${C3.cy - 4} L ${C3.cx} ${C3.cy - 24} L ${C3.cx - 16} ${C3.cy - 4} Z`} />
          <path className={s.hudNeedleS} d={`M ${C3.cx} ${C3.cy + 112} L ${C3.cx - 9} ${C3.cy + 8} L ${C3.cx} ${C3.cy + 20} L ${C3.cx + 9} ${C3.cy + 8} Z`} />
          <circle className={s.hudNeedleS} cx={C3.cx} cy={C3.cy + 122} r="6.5" />
        </g>
        <circle className={s.hudHub} cx={C3.cx} cy={C3.cy} r="13" />
        <circle className={s.hudDot} cx={C3.cx} cy={C3.cy} r="3.6" />
        <path className={s.hudGlass} d={`M ${C3.cx - 112} ${C3.cy - 84} A 142 142 0 0 1 ${C3.cx + 22} ${C3.cy - 140}`} />
      </g>

      <g className={s.hudChart}>
        <path className={s.hudGrid} d={CHART_GRID} />
        <path className={s.hudGapLead} d={BAR_GAPS} />
        {BARS.map((b) => (
          <g key={b.i} className={s.hudBar} style={{ ['--i' as string]: b.i }}>
            <path className={s.hudBarDim} d={barBlocks(b.h + 40, b.x)} />
            <path className={s.hudBloom} d={barBlocks(b.h, b.x)} />
            <path className={s.hudBarLit} d={barBlocks(b.h, b.x)} />
          </g>
        ))}
        <path className={s.hudAxis} d={`M 534 ${BASE_Y} H 962`} />
        <path className={s.hudBloom} d={`M 534 ${TARGET_Y} H 962`} />
        <path className={s.hudTargetLine} d={`M 534 ${TARGET_Y} H 962`} />
        <path className={s.hudTargetCap} d={`M 534 ${TARGET_Y - 10} v 20 M 962 ${TARGET_Y - 10} v 20`} />
      </g>
    </g>
  );
}

/* ================================================================== beat 4
   A wall of dials, none of them resolving.

   Twelve instruments, every one part filled and stalled at a different place, each
   reading a different thing. This is the beat where the copy says every investment
   decision is a guess, and a panel of readouts that never complete is that sentence
   drawn. Nothing here agrees with anything else and nothing finishes. */

type DialSpec = { cx: number; cy: number; r: number; fill: number; k: 'v' | 'h' | 'b' | 'q'; i: number };

const DIALS: DialSpec[] = (() => {
  const r = rand(515151);
  const cols = 4;
  const rows = 3;
  const out: DialSpec[] = [];
  let i = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const kinds: DialSpec['k'][] = ['v', 'h', 'b', 'q'];
      out.push({
        cx: 158 + x * 228,
        cy: 136 + y * 156,
        r: 48 + r() * 10,
        // Never above 0.8. A dial that reads as complete would be answering the
        // question this beat exists to leave open.
        fill: 0.18 + r() * 0.6,
        k: i % 3 === 0 ? 'q' : kinds[Math.floor(r() * 4)],
        i: i++,
      });
    }
  }
  return out;
})();

function DialWall() {
  return (
    <g className={s.hudScene}>
      <path className={s.hudFrame} d={brackets(24, 26, 952, 468, 30)} />
      {DIALS.map((d) => (
        <g key={d.i} className={s.hudDial} style={{ ['--i' as string]: d.i }}>
          <Bezel cx={d.cx} cy={d.cy} r={d.r} fill={d.fill} seed={100 + d.i} dense={false} />
          {d.k === 'q' && (
            <text className={s.hudQuery} x={d.cx} y={d.cy + 13} style={{ fontSize: '34px' }}>
              ?
            </text>
          )}
          {d.k === 'v' && <VendorMark x={d.cx} y={d.cy} i={d.i} r={15} />}
          {d.k === 'h' && (
            <g className={s.hudHuman}>
              <Person x={d.cx} y={d.cy} sc={1.05} />
            </g>
          )}
          {d.k === 'b' && (
            <g className={s.hudBot}>
              <BotBody x={d.cx} y={d.cy} sc={1.05} />
            </g>
          )}
        </g>
      ))}
    </g>
  );
}
