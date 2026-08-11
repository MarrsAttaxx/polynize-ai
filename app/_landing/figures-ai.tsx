/**
 * The four beat figures for /mapping, the AI-capability narrative.
 *
 * STYLE: instrument panel. Mint on near black, concentric arcs with gaps, dense radial
 * graduations, segmented rings, wireframe terrain, bloom on the live elements. Marrs
 * supplied HUD reference on 10 Aug 2026 and this is built to it. It is not decoration
 * for its own sake: the argument of these beats is that you are navigating without
 * instruments, so drawing instruments that will not give a reading is the figure doing
 * the work of the copy.
 *
 * WHY THIS IS A GENERATOR AND NOT A DRAWING. The first two versions were about fifteen
 * hand-placed shapes each and read as exactly that. Detail at this scale is a quantity
 * problem, not a craft one: a convincing bezel carries 120 graduations, three arc
 * segments at different radii and a 36 block segmented ring. You generate it.
 *
 * FAIL-SAFE BY CONSTRUCTION, which is why these are CSS keyframes and not GSAP. Every
 * element is server-rendered at its finished geometry and the stylesheet base state is
 * a complete, legible drawing. Animation exists only while `.play` is on the container.
 *
 * NO NUMERALS AND NO WORDS, and this is the one place the reference is deliberately NOT
 * followed. Every HUD in the source material is covered in readouts (75%, LOADING, 93).
 * These sit before the product is introduced, so a number on a dial would be inventing
 * evidence the page has not earned. The dials say it in how far the arc has filled.
 */

import { VENDORS, VendorLogo, type VendorName } from './VendorLogos';
import { Bezel, BotBody, Person, arc, brackets, f, graticule, pol, rand } from './hud';
import type { FigureRegistry } from './BeatFigure';
import s from './story.module.css';

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

/** Reused by /capability-mapping: being unable to describe your work is being lost. */
export function LoneCompass() {
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
 * Hand placed, not generated, and that is the point: a loop produces rows, and rows read
 * as an ordered set. This is a pile of things you have bought that do not line up with
 * each other. One of each mark, never repeated, because a duplicate reads as a pattern;
 * the question repeats instead, since that IS the recurring thing.
 *
 * PLACED ON A JITTERED LATTICE covering the whole frame, not scattered freehand. The
 * first version clumped toward the middle and left the corners empty, which read as a
 * cluster rather than as a field (Marrs, 10 Aug 2026). Spread wider again on 11 Aug, with
 * the size range opened up from 58-110 to 48-132: a field where everything is roughly the
 * same size reads as a set, and this is meant to read as a pile.
 *
 * Anything moved here has to keep three properties: reach the edges, never line up with a
 * neighbour on either axis, and keep the size range wide. This figure is shared with
 * /capability-mapping, so a change lands on both pages.
 */
const FLOATERS: Floater[] = [
  { name: 'openai', x: 74, y: 82, size: 124, i: 0 },
  { name: 'anthropic', x: 318, y: 58, size: 66, i: 1 },
  { name: 'q', x: 560, y: 110, size: 104, i: 2 },
  { name: 'gemini', x: 806, y: 52, size: 92, i: 3 },
  { name: 'q', x: 946, y: 148, size: 54, i: 4 },
  { name: 'claude', x: 168, y: 246, size: 78, i: 5 },
  { name: 'copilot', x: 424, y: 232, size: 132, i: 6 },
  { name: 'q', x: 690, y: 268, size: 70, i: 7 },
  { name: 'grok', x: 902, y: 300, size: 108, i: 8 },
  { name: 'q', x: 62, y: 392, size: 88, i: 9 },
  { name: 'openclaw', x: 296, y: 424, size: 60, i: 10 },
  { name: 'q', x: 556, y: 418, size: 118, i: 11 },
  { name: 'q', x: 782, y: 436, size: 48, i: 12 },
];

/** Reused by /capability-mapping: too many tools, too many options, too many opinions. */
export function VendorDrift() {
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
   The dirty windscreen.

   Looking out of a car through a screen smeared with dirt. The wipers sweep and sweep and
   clear nothing, and out beyond the glass the vendor marks from beat 2 drift past, blurred
   past recognition. The beat says there is no clarity on where AI actually works, and the
   figure is that sentence: you are moving, something is being done about the view, and you
   still cannot see.

   THE WIPERS MUST NOT CLEAR A PATH. The obvious implementation sweeps a clean arc through
   the grime, and that inverts the whole thing: a cleared arc says the problem is being
   solved. The smear is a static layer the wipers pass OVER, never through. */

const WS = { cx: 500, cy: 250 };

/** The screen aperture: a windscreen is wider than it is tall and rounded at the top. */
const GLASS = 'M 96 118 C 300 62, 700 62, 904 118 L 946 396 C 700 430, 300 430, 54 396 Z';

/** The grime. Blotches at three sizes so it reads as dirt rather than as texture. */
const GRIME = (() => {
  const r = rand(9182736);
  const d: string[] = [];
  for (let i = 0; i < 90; i++) {
    const x = 60 + r() * 880;
    const y = 80 + r() * 340;
    const rx = 6 + r() * 30;
    const ry = rx * (0.5 + r() * 0.7);
    d.push(
      `M ${f(x - rx)} ${f(y)} a ${f(rx)} ${f(ry)} 0 1 0 ${f(rx * 2)} 0 a ${f(rx)} ${f(ry)} 0 1 0 ${f(-rx * 2)} 0`
    );
  }
  return d.join(' ');
})();

/** Streaks left behind, following the wiper arc rather than the grime. */
const STREAKS = (() => {
  const d: string[] = [];
  // Six, not fourteen: evenly spaced concentric arcs stop reading as a smear and start
  // reading as radar rings. Broken into partial sweeps at uneven radii instead.
  const spans = [
    [168, -54, 18],
    [206, -12, 58],
    [242, -60, -6],
    [281, 6, 54],
    [318, -44, 26],
    [352, -8, 48],
  ] as const;
  for (const [rr, a0, a1] of spans) d.push(arc(WS.cx, 470, rr, a0, a1));
  return d.join(' ');
})();

/** What is out there, going past. Recognisable in silhouette only, which is the point. */
const PASSING: { name: VendorName; x: number; y: number; size: number; i: number }[] = [
  { name: 'openai', x: 210, y: 190, size: 84, i: 0 },
  { name: 'gemini', x: 430, y: 150, size: 62, i: 1 },
  { name: 'claude', x: 640, y: 210, size: 74, i: 2 },
  { name: 'copilot', x: 830, y: 168, size: 90, i: 3 },
  { name: 'grok', x: 330, y: 320, size: 66, i: 4 },
  { name: 'anthropic', x: 720, y: 340, size: 58, i: 5 },
];

function Windscreen() {
  return (
    <g className={s.hudScene}>
      <clipPath id="pn-glass">
        <path d={GLASS} />
      </clipPath>

      {/* Beyond the glass. Drawn first, so everything else is between it and the viewer. */}
      <g clipPath="url(#pn-glass)">
        <rect className={s.wsOutside} x="40" y="50" width="920" height="400" />
        <path className={s.wsHorizon} d="M 40 300 H 960" />
        <g className={s.wsPassing}>
          {PASSING.map((v) => (
            <g key={v.name} className={s.wsPass} style={{ ['--i' as string]: v.i }}>
              <VendorLogo name={v.name} x={v.x} y={v.y} size={v.size} />
            </g>
          ))}
        </g>

        {/* The grime, and the streaks the wipers leave. Neither is ever cleared: a wiped
            arc would say the view is being fixed, which is the opposite of the copy. */}
        <path className={s.wsStreak} d={STREAKS} />
        <path className={s.wsGrime} d={GRIME} />

        {/* The wipers. They sweep over the grime, never through it. */}
        <g className={s.wsWiperL}>
          <path className={s.wsArm} d={`M 340 470 L 300 214`} />
          <path className={s.wsBlade} d={`M 296 190 L 304 238`} />
        </g>
        <g className={s.wsWiperR}>
          <path className={s.wsArm} d={`M 660 470 L 700 214`} />
          <path className={s.wsBlade} d={`M 696 190 L 704 238`} />
        </g>
      </g>

      {/* The car. Pillars and dash, so the frame reads as being inside something. */}
      <path className={s.wsGlassEdge} d={GLASS} />
      <path className={s.wsDash} d="M 20 402 C 300 446, 700 446, 980 402 L 980 470 L 20 470 Z" />
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

/** Reused by /capability-mapping: the beat about deciding on a guess is the same beat. */
export function SlotMachine() {
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

/**
 * The registry StoryLanding renders from. Keys are whatever a beat's `figure` says, so
 * a page can only draw figures its own module declares.
 */
export const AI_FIGURES: FigureRegistry = {
  scatter: { viewBox: '0 0 620 580', place: 'centre', render: () => <LoneCompass /> },
  ambiguity: {
    viewBox: '0 0 1000 480',
    // Centred and full width. It was placed right to keep clear of the route, but the
    // narrower column squeezed the marks together and the offset made the whole field
    // look like it had drifted off to one side. Spread across the full width it reads as
    // a field, and the route passing behind it is what a route on a chart does anyway.
    place: 'wide',
    render: () => <VendorDrift />,
  },
  windscreen: { viewBox: '0 0 1000 470', place: 'wide', render: () => <Windscreen /> },
  guess: { viewBox: '0 0 1000 480', place: 'wide', render: () => <SlotMachine /> },
};
