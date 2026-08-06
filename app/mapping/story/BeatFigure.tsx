import type { FigureKind } from './content';
import s from './story.module.css';

/**
 * One instrument per beat, in the ate.html idiom.
 *
 * THE GRAMMAR, taken from the deck: the frame of the measurement exists before any of
 * the measurement does, content washes in on a stagger far shorter than its own fade
 * (the deck runs 42ms against 450ms, so a dozen items are mid-fade at once and it reads
 * as one directional wipe rather than a staircase), and the last gesture is the one
 * that should deliver a reading. Here it never does. These sit in the PROBLEM section,
 * so every instrument fills itself in and then refuses to resolve.
 *
 * FAIL-SAFE BY CONSTRUCTION, and this is why the motion is CSS keyframes rather than
 * GSAP. Every element below is server-rendered at its FINISHED geometry, and the
 * stylesheet's base state is the finished drawing. Animation only exists while a
 * `.play` class is present, and a CSS animation returns the element to its base style.
 * So no script, no observer, a stalled ticker and reduced motion all land on the
 * completed figure. Nothing here may rest at opacity 0.
 *
 * NO NUMERALS, NO WORDS, NO AXES, NO GRADING. These are drawn before the product is
 * introduced, so anything readable as a score, a benchmark or a result would be
 * inventing evidence. Neutral greys only: mint belongs to the route and the turn, and
 * amber and coral are spoken for by the matrix legend two sections down.
 */

const VIEWBOX: Record<FigureKind, string> = {
  scatter: '0 0 360 150',
  ambiguity: '0 0 360 150',
  coordinates: '0 0 360 150',
  guess: '0 0 360 158',
};

export function BeatFigure({ kind }: { kind: FigureKind }) {
  return (
    <div className={s.figure} data-fig={kind} aria-hidden="true">
      <svg viewBox={VIEWBOX[kind]} className={s.figureSvg} focusable="false">
        {kind === 'scatter' && <Fragments />}
        {kind === 'ambiguity' && <Fan />}
        {kind === 'coordinates' && <Reticle />}
        {kind === 'guess' && <Ledger />}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ beat 1
   Activity that never joins up. Seven short runs of route, each with its own point of
   departure, arriving in scattered order so the picture accumulates rather than
   progresses. None of them meets another. Deliberately NOT a field of bars: bars on a
   shared floor read as a distribution, which is a different (and unearned) claim. */
const FRAGMENTS = [
  { d: 'M 24 108 q 20 -24 46 -14', i: 3 },
  { d: 'M 104 44 q 26 16 44 -6', i: 0 },
  { d: 'M 60 74 q 22 -18 44 -8', i: 5 },
  { d: 'M 178 116 q 24 -22 48 -8', i: 1 },
  { d: 'M 232 52 q 22 20 46 2', i: 6 },
  { d: 'M 150 80 q 20 18 42 0', i: 4 },
  { d: 'M 288 98 q 20 -18 44 -6', i: 2 },
];

function Fragments() {
  return (
    <g>
      {FRAGMENTS.map((f, k) => {
        const [, x, y] = f.d.split(' ');
        return (
          <g key={k} className={s.figItem} style={{ ['--i' as string]: f.i }}>
            <circle className={s.figSource} cx={x} cy={y} r="3.4" />
            <path className={s.figDash} d={f.d} />
          </g>
        );
      })}
    </g>
  );
}

/* ------------------------------------------------------------------ beat 2
   One committed stem, then five equally plausible routes.

   The choreography is the argument, and it is lifted from the deck's animateModel: its
   cards arrive one at a time, then every connector lands AT ONCE, unstaggered. Drawing
   branches in sequence would imply an order; landing them on the same frame says all of
   these, and you cannot pick.

   Each route is built from discrete dash segments rather than a dashed stroke, because
   DrawSVGPlugin overwrites stroke-dasharray on every render and would finish a dashed
   path as a solid one. Segment k of every route shares one delay, so the five grow
   outward together. */
const FAN_ENDS = [22, 50, 76, 102, 128];
const SEGS = 7;
const FORK = { x: 118, y: 76 };
const FAN_END_X = 322;

function Fan() {
  return (
    <g>
      <circle className={s.figSource} cx="26" cy="76" r="5.5" />
      {/* the only committed stretch: the part nobody disputes */}
      <path className={s.figStem} d="M 34 76 H 110" />
      <circle className={s.figHollow} cx={FORK.x} cy={FORK.y} r="6" />

      {FAN_ENDS.map((endY, r) => (
        <g key={r}>
          {Array.from({ length: SEGS }).map((_, k) => {
            const t0 = k / SEGS;
            const t1 = (k + 0.62) / SEGS;
            const px = (t: number) => FORK.x + 8 + (FAN_END_X - FORK.x - 20) * t;
            const py = (t: number) => FORK.y + (endY - FORK.y) * (t * t * 0.35 + t * 0.65);
            return (
              <line
                key={k}
                className={`${s.figSeg} ${s.figItem}`}
                style={{ ['--i' as string]: k }}
                x1={px(t0).toFixed(1)}
                y1={py(t0).toFixed(1)}
                x2={px(t1).toFixed(1)}
                y2={py(t1).toFixed(1)}
              />
            );
          })}
          {/* destinations land together, and none is distinguished */}
          <circle className={`${s.figHollow} ${s.figItem}`} style={{ ['--i' as string]: SEGS }} cx={FAN_END_X} cy={endY} r="5.5" />
        </g>
      ))}
    </g>
  );
}

/* ------------------------------------------------------------------ beat 3
   Two coordinates, neither of which resolves.

   A locator that tries three times to close on a position and stops short, off centre,
   and a horizon that re-levels three times and settles at no particular height. Chosen
   over a ruled table on purpose: a table with a name column and a per-row measurement
   track is the capability matrix's own anatomy, and hand-drawing the product one
   section before the real one appears is exactly what got the last attempt rejected. */
function Reticle() {
  return (
    <g>
      <g className={s.figLock}>
        <circle className={s.figHollow} cx="96" cy="75" r="34" />
        <circle className={s.figHollow} cx="96" cy="75" r="17" />
      </g>
      <path className={s.figCross} d="M 96 30 v -14 M 96 120 v 14 M 51 75 h -14 M 141 75 h 14" />
      <circle className={s.figSource} cx="96" cy="75" r="2.6" />

      <g className={s.figHorizon}>
        <path className={s.figDash} d="M 208 62 H 340" />
      </g>
      <path className={s.figCross} d="M 208 118 H 340" />
      <path className={s.figCross} d="M 208 32 H 340" />
    </g>
  );
}

/* ------------------------------------------------------------------ beat 4
   Three decisions, three ways each could go, nothing allocated.

   Rows wash down at the deck's animateCapMap cadence. Then one row tries each lane in
   turn, borrowed from the train slide's fill tween: it commits faster than it lets go
   (a 220ms wash against a 150ms drain), three times, and keeps none of them. The row
   ends exactly as empty as it started.

   Trimmed to three rows from the spec's six: eighteen outlined pills read as a table,
   and the reader meets the real matrix two sections later. */
const LEDGER_ROWS = [0, 1, 2];
const LANES = [196, 252, 308];
const TRY_ROW = 1;

function Ledger() {
  return (
    <g>
      <path className={s.figFrame} d="M 20 28 H 340" />
      {LEDGER_ROWS.map((r) => {
        const y = 56 + r * 38;
        return (
          <g key={r} className={s.figItem} style={{ ['--i' as string]: r }}>
            <rect className={s.figRule} x="20" y={y - 5} width={[104, 78, 122][r]} height="9" rx="4.5" />
            {LANES.map((lx, k) => (
              <g key={k}>
                <rect className={s.figPill} x={lx - 24} y={y - 12} width="48" height="24" rx="5" />
                {r === TRY_ROW && (
                  <rect
                    className={s.figTry}
                    style={{ ['--k' as string]: k }}
                    x={lx - 24}
                    y={y - 12}
                    width="48"
                    height="24"
                    rx="5"
                  />
                )}
              </g>
            ))}
          </g>
        );
      })}
      <path className={s.figFrame} d="M 20 170 H 340" />
    </g>
  );
}
