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

import { VendorLogo, type VendorName } from './VendorLogos';
import { Bezel, BotBody, Person, f, graticule, pol } from './hud';
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
   The torch on the systems diagram.

   Underneath is an ordinary systems diagram: process steps wired left to right, AI nodes
   hanging off them on dotted lines, work travelling along the links, a couple of links
   broken. Over the top, a moving circle of light. Only what the light is on is visible.
   Everything else is dark, and the light never covers more than a fraction of it.

   That is the beat exactly. There is no clarity on where AI actually works: not because
   nothing is there, but because you can only ever see the piece somebody is currently
   pointing at, and the advice you get is about that piece rather than about the whole.

   THE LIGHT MUST NEVER REVEAL THE WHOLE DIAGRAM. The obvious edit widens the circle until
   the picture is legible, which is the opposite of the argument. It stays a fraction of
   the frame, and its radius is fixed while only its position moves.

   Fail-safe: with no animation the torch sits at its starting position and one section of
   the diagram is lit. Something is always visible; nothing rests at nothing. */

const DIAG = { w: 1000, h: 440 };

/** Process steps: a workflow spine, two rows, left to right. */
const STEPS = [
  { x: 120, y: 150 },
  { x: 320, y: 150 },
  { x: 520, y: 150 },
  { x: 720, y: 150 },
  { x: 880, y: 262 },
  { x: 620, y: 320 },
  { x: 380, y: 320 },
  { x: 168, y: 320 },
];

/** AI nodes, hanging off the spine. Hexagons, so they read as a different kind of thing. */
const AI_NODES = [
  { x: 226, y: 58, to: 1 },
  { x: 470, y: 52, to: 2 },
  { x: 786, y: 62, to: 3 },
  { x: 512, y: 414, to: 5 },
  { x: 268, y: 412, to: 6 },
];

const STEP_W = 104;
const STEP_H = 46;

/** The spine. `broken` links are drawn with a visible gap and a coral break mark. */
const LINKS: { a: number; b: number; broken?: boolean }[] = [
  { a: 0, b: 1 },
  { a: 1, b: 2, broken: true },
  { a: 2, b: 3 },
  { a: 3, b: 4 },
  { a: 4, b: 5 },
  { a: 5, b: 6, broken: true },
  { a: 6, b: 7 },
];

const hex = (cx: number, cy: number, r: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    return `${i ? 'L' : 'M'} ${f(cx + Math.cos(a) * r)} ${f(cy + Math.sin(a) * r)}`;
  }).join(' ') + ' Z';

/** Straight-ish routing between two steps, with a dog-leg when they are on different rows. */
function link(a: { x: number; y: number }, b: { x: number; y: number }) {
  if (Math.abs(a.y - b.y) < 4) return `M ${a.x + STEP_W / 2} ${a.y} H ${b.x - STEP_W / 2}`;
  const midY = (a.y + b.y) / 2;
  return `M ${a.x} ${a.y + STEP_H / 2} V ${f(midY)} H ${b.x} V ${f(b.y - STEP_H / 2)}`;
}

const SPINE = LINKS.filter((l) => !l.broken)
  .map((l) => link(STEPS[l.a], STEPS[l.b]))
  .join(' ');

const BROKEN = LINKS.filter((l) => l.broken).map((l) => ({
  d: link(STEPS[l.a], STEPS[l.b]),
  x: (STEPS[l.a].x + STEPS[l.b].x) / 2,
  y: (STEPS[l.a].y + STEPS[l.b].y) / 2,
}));

const AI_LINKS = AI_NODES.map((n) => {
  const t = STEPS[n.to];
  return `M ${n.x} ${n.y + 20} V ${f((n.y + t.y) / 2)} H ${t.x} V ${f(t.y - STEP_H / 2)}`;
}).join(' ');

/** Work in flight. Three dots on the horizontal runs, so something is always moving. */
const TRAVELLERS = [
  { x0: 172, x1: 268, y: 150, i: 0 },
  { x0: 572, x1: 668, y: 150, i: 1 },
  { x0: 432, x1: 568, y: 320, i: 2 },
];

/** Reused by /capability-mapping: the same beat, so the same figure. */
export function TorchDiagram() {
  return (
    <g className={s.hudScene}>
      <defs>
        {/* White reveals, black hides. The gradient's soft outer stop is the blurred
            edge of the beam: a hard-edged circle reads as a hole punched in a card. */}
        <radialGradient id="pn-torch-grad">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="62%" stopColor="#fff" />
          <stop offset="100%" stopColor="#000" />
        </radialGradient>
        <mask id="pn-torch" maskUnits="userSpaceOnUse" x="0" y="0" width={DIAG.w} height={DIAG.h}>
          <rect x="0" y="0" width={DIAG.w} height={DIAG.h} fill="#000" />
          <g className={s.torchMove}>
            <circle cx="180" cy="150" r="150" fill="url(#pn-torch-grad)" />
          </g>
        </mask>
      </defs>

      <g mask="url(#pn-torch)">
        <path className={s.hudGrid} d={graticule(DIAG.w, DIAG.h, 44, 22)} />

        {/* The wiring. Dotted, because a systems diagram is dotted. */}
        <path className={s.dgLink} d={SPINE} />
        <path className={s.dgAiLink} d={AI_LINKS} />

        {/* The links that are not working. */}
        {BROKEN.map((b, i) => (
          <g key={i}>
            <path className={s.dgBroken} d={b.d} />
            <path
              className={s.dgBreak}
              d={`M ${b.x - 9} ${b.y - 9} L ${b.x + 9} ${b.y + 9} M ${b.x + 9} ${b.y - 9} L ${b.x - 9} ${b.y + 9}`}
            />
          </g>
        ))}

        {/* Work in flight. */}
        {TRAVELLERS.map((t) => (
          <circle
            key={t.i}
            className={s.dgFlow}
            cx={t.x0}
            cy={t.y}
            r="4.5"
            style={{ ['--dx' as string]: `${t.x1 - t.x0}px`, ['--i' as string]: t.i }}
          />
        ))}

        {/* The steps. */}
        {STEPS.map((p, i) => (
          <g key={i}>
            <rect
              className={s.dgStep}
              x={p.x - STEP_W / 2}
              y={p.y - STEP_H / 2}
              width={STEP_W}
              height={STEP_H}
              rx="6"
            />
            {/* Two rules inside each box: enough to read as a labelled step, no words. */}
            <path
              className={s.dgStepRule}
              d={`M ${p.x - 32} ${p.y - 8} h 64 M ${p.x - 32} ${p.y + 6} h 40`}
            />
          </g>
        ))}

        {/* The AI nodes. */}
        {AI_NODES.map((n, i) => (
          <g key={i} className={s.dgAi} style={{ ['--i' as string]: i }}>
            <path className={s.dgAiHex} d={hex(n.x, n.y, 22)} />
            <path
              className={s.dgAiSpark}
              d={`M ${n.x} ${n.y - 10} V ${n.y + 10} M ${n.x - 9} ${n.y - 5} L ${n.x + 9} ${n.y + 5} M ${n.x + 9} ${n.y - 5} L ${n.x - 9} ${n.y + 5}`}
            />
          </g>
        ))}
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
  windscreen: { viewBox: '0 0 1000 440', place: 'wide', render: () => <TorchDiagram /> },
  guess: { viewBox: '0 0 1000 480', place: 'wide', render: () => <SlotMachine /> },
};
