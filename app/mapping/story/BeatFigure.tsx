import type { FigureKind } from './content';
import s from './story.module.css';

/**
 * One animation per beat, filling the space between the lines.
 *
 * FAIL-SAFE BY CONSTRUCTION, which is why these are CSS keyframes and not GSAP. Every
 * element is server-rendered at its finished geometry and the stylesheet base state is
 * a complete, legible drawing. Animation exists only while `.play` is on the container.
 * No script, no observer, a stalled ticker and reduced motion all land on something
 * drawn. Nothing here rests at opacity 0.
 *
 * NO NUMERALS AND NO WORDS. These sit before the product is introduced, so anything
 * readable as a score or a benchmark figure would be inventing evidence.
 *
 * ON THE VENDOR MARKS: beat 1 and beat 4 use neutral territory badges rather than real
 * OpenAI / Anthropic / Gemini / Copilot logos. Drawing third-party trademarks from
 * memory would be both inaccurate and a real trademark exposure on a commercial page.
 * The badges are deliberately one component (`VendorMark`) so real assets can be
 * dropped in once that call is made.
 */

const VIEWBOX: Record<FigureKind, string> = {
  scatter: '0 0 420 230',
  ambiguity: '0 0 420 200',
  coordinates: '0 0 420 200',
  guess: '0 0 420 210',
};

export function BeatFigure({ kind }: { kind: FigureKind }) {
  return (
    <div className={s.figure} data-fig={kind} aria-hidden="true">
      <svg viewBox={VIEWBOX[kind]} className={s.figureSvg} focusable="false">
        {kind === 'scatter' && <AiWorld />}
        {kind === 'ambiguity' && <Evaporate />}
        {kind === 'coordinates' && <CompassBench />}
        {kind === 'guess' && <Jumble />}
      </svg>
    </div>
  );
}

/** Placeholder for a vendor mark. Swap for real assets if the trademark call is made. */
function VendorMark({ x, y, i }: { x: number; y: number; i: number }) {
  const glyphs = [
    <circle key="a" cx={x} cy={y} r="5.5" />,
    <rect key="b" x={x - 5} y={y - 5} width="10" height="10" rx="2.5" />,
    <path key="c" d={`M ${x} ${y - 6} L ${x + 6} ${y + 5} L ${x - 6} ${y + 5} Z`} />,
    <path key="d" d={`M ${x} ${y - 6.5} L ${x + 6.5} ${y} L ${x} ${y + 6.5} L ${x - 6.5} ${y} Z`} />,
    <path key="e" d={`M ${x - 6} ${y} h 12 M ${x} ${y - 6} v 12`} />,
  ];
  return (
    <g className={s.figVendor}>
      <circle className={s.figBadge} cx={x} cy={y} r="13" />
      {glyphs[i % glyphs.length]}
    </g>
  );
}

/* ---------------------------------------------------------------- beat 1
   A fictitious continent, drawn as a clean survey outline with territories staked out
   across it. It arrives crisp and then goes soft and faint: the terrain you thought you
   were navigating will not hold still long enough to be navigated.
   Ends faded rather than gone, so the base state is never blank. */
const TERRITORIES = [
  { x: 118, y: 86 },
  { x: 196, y: 62 },
  { x: 262, y: 104 },
  { x: 152, y: 142 },
  { x: 316, y: 74 },
  { x: 226, y: 160 },
];

function AiWorld() {
  return (
    <g className={s.figWorld}>
      {/* coastline */}
      <path
        className={s.figCoast}
        d="M 74 118 C 66 84, 104 52, 148 48 C 190 44, 206 26, 250 34 C 300 43, 340 40, 356 68
           C 372 96, 350 116, 344 140 C 338 166, 296 190, 248 186 C 200 182, 176 196, 140 184
           C 100 170, 82 152, 74 118 Z"
      />
      {/* interior contour */}
      <path
        className={s.figContour}
        d="M 106 116 C 108 92, 142 74, 180 76 C 224 78, 258 66, 290 82 C 320 97, 326 126, 306 146
           C 284 168, 226 170, 186 162 C 146 154, 104 142, 106 116 Z"
      />
      {/* offshore */}
      <path className={s.figContour} d="M 46 168 q 14 -12 28 -2 q -12 14 -28 2 Z" />
      <path className={s.figContour} d="M 372 158 q 16 -10 28 2 q -14 12 -28 -2 Z" />

      {TERRITORIES.map((t, i) => (
        <VendorMark key={i} x={t.x} y={t.y} i={i} />
      ))}
    </g>
  );
}

/* ---------------------------------------------------------------- beat 2
   Bots appearing among the people, and then the whole field evaporating: effort that
   went in and left nothing behind that anyone can point at. */
const PEOPLE = [
  [54, 118], [96, 74], [138, 132], [180, 86], [222, 140], [264, 78], [306, 126], [348, 88],
];
const BOTS = [
  [76, 96], [160, 108], [244, 100], [326, 150], [118, 158],
];

function Person({ x, y, i }: { x: number; y: number; i: number }) {
  return (
    <g className={`${s.figHuman} ${s.figPuff}`} style={{ ['--i' as string]: i }}>
      <circle cx={x} cy={y - 9} r="5.6" />
      <path d={`M ${x - 8.5} ${y + 12} a 8.5 9 0 0 1 17 0`} />
    </g>
  );
}

function Bot({ x, y, i }: { x: number; y: number; i: number }) {
  return (
    <g className={`${s.figBot} ${s.figPuff}`} style={{ ['--i' as string]: i + 8 }}>
      <rect x={x - 8} y={y - 8} width="16" height="14" rx="3.5" />
      <circle cx={x - 3.4} cy={y - 1.5} r="1.7" className={s.figBotEye} />
      <circle cx={x + 3.4} cy={y - 1.5} r="1.7" className={s.figBotEye} />
      <path d={`M ${x} ${y - 8} v -5 M ${x - 11} ${y - 2} h -3 M ${x + 11} ${y - 2} h 3`} />
    </g>
  );
}

function Evaporate() {
  return (
    <g>
      {PEOPLE.map(([x, y], i) => (
        <Person key={`p${i}`} x={x} y={y} i={i} />
      ))}
      {BOTS.map(([x, y], i) => (
        <Bot key={`b${i}`} x={x} y={y} i={i} />
      ))}
    </g>
  );
}

/* ---------------------------------------------------------------- beat 3
   Two instruments, both refusing to give a reading: a compass whose needle never
   settles on north, and a set of bars climbing towards a benchmark none of them
   reaches. No numerals: the benchmark is a line, not a score. */
const BARS = [
  { x: 244, h: 44, i: 0 },
  { x: 274, h: 62, i: 1 },
  { x: 304, h: 34, i: 2 },
  { x: 334, h: 70, i: 3 },
  { x: 364, h: 52, i: 4 },
];
const BENCH_Y = 46;
const BAR_BASE = 158;

function CompassBench() {
  return (
    <g>
      {/* compass */}
      <g className={s.figCompass}>
        <circle className={s.figRing} cx="104" cy="100" r="62" />
        <circle className={s.figRing} cx="104" cy="100" r="48" />
        {Array.from({ length: 16 }).map((_, i) => {
          const a = (i * Math.PI * 2) / 16;
          const r0 = i % 4 === 0 ? 44 : 52;
          return (
            <line
              key={i}
              className={s.figTick}
              x1={104 + Math.sin(a) * r0}
              y1={100 - Math.cos(a) * r0}
              x2={104 + Math.sin(a) * 60}
              y2={100 - Math.cos(a) * 60}
            />
          );
        })}
        {/* eight-point rose */}
        <path className={s.figRose} d="M 104 52 L 113 91 L 104 100 L 95 91 Z" />
        <path className={s.figRoseDim} d="M 104 148 L 95 109 L 104 100 L 113 109 Z" />
        <path className={s.figRoseDim} d="M 56 100 L 95 91 L 104 100 L 95 109 Z" />
        <path className={s.figRoseDim} d="M 152 100 L 113 109 L 104 100 L 113 91 Z" />
        <g className={s.figNeedle}>
          <path className={s.figNeedleN} d="M 104 60 L 110 100 L 104 96 L 98 100 Z" />
          <path className={s.figNeedleS} d="M 104 140 L 98 100 L 104 104 L 110 100 Z" />
        </g>
        <circle className={s.figHub} cx="104" cy="100" r="4" />
      </g>

      {/* the benchmark, and bars that never reach it */}
      <path className={s.figBench} d={`M 226 ${BENCH_Y} H 392`} />
      <path className={s.figAxis} d={`M 226 ${BAR_BASE} H 392`} />
      {BARS.map((b) => (
        <rect
          key={b.x}
          className={s.figGrow}
          style={{ ['--i' as string]: b.i, ['--h' as string]: `${b.h}px` }}
          x={b.x - 9}
          y={BAR_BASE - b.h}
          width="18"
          height={b.h}
          rx="2.5"
        />
      ))}
    </g>
  );
}

/* ---------------------------------------------------------------- beat 4
   Everything from the beats above, jumbled together with the question that is actually
   being asked: which of these is worth the money. Nothing resolves. */
const JUMBLE = [
  { k: 'v', x: 60, y: 62 },
  { k: 'q', x: 118, y: 44 },
  { k: 'h', x: 168, y: 74 },
  { k: 'b', x: 224, y: 48 },
  { k: 'q', x: 282, y: 70 },
  { k: 'v', x: 340, y: 52 },
  { k: 'h', x: 74, y: 130 },
  { k: 'b', x: 132, y: 150 },
  { k: 'q', x: 196, y: 134 },
  { k: 'v', x: 252, y: 156 },
  { k: 'h', x: 312, y: 132 },
  { k: 'q', x: 366, y: 152 },
];

function Jumble() {
  return (
    <g>
      {JUMBLE.map((j, i) => {
        const style = { ['--i' as string]: i } as React.CSSProperties;
        if (j.k === 'v') return <g key={i} className={s.figItem} style={style}><VendorMark x={j.x} y={j.y} i={i} /></g>;
        if (j.k === 'h') return <g key={i} className={s.figItem} style={style}><Person x={j.x} y={j.y} i={i} /></g>;
        if (j.k === 'b') return <g key={i} className={s.figItem} style={style}><Bot x={j.x} y={j.y} i={i} /></g>;
        return (
          <text key={i} className={`${s.figQuery} ${s.figItem}`} style={style} x={j.x} y={j.y + 8}>
            ?
          </text>
        );
      })}
    </g>
  );
}
