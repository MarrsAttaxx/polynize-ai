/**
 * The four beat figures for /capability-mapping, the work-modelling narrative.
 *
 * Same instrument-panel kit as figures-ai.tsx, different argument. Two are reused from
 * the sibling page because they already draw exactly what these beats say:
 *
 *   beat 1  the compass. "Lost in their AI journey" is literally being lost, so it gets
 *           the instrument you would reach for and that will not settle.
 *   beat 2  the vendor field. "Too many tools, too many options, too many opinions" is
 *           the sentence that figure was built for: every mark a different vendor,
 *           question marks at the same weight among them, nothing lining up.
 *   beat 3  the torch on the systems diagram. Beat 3 is now word for word the same beat
 *           as /mapping's, so it gets the same figure. Both pages arrive at the same
 *           place here: there is no clarity on where AI actually works.
 *
 * The two here:
 *
 *   beat 3  Amplifier. One crooked input, magnified. AI is a force multiplier for the
 *           individual, so pointing it at unmapped work does not straighten the process,
 *           it runs the same crooked process louder. The output waveform is the input
 *           waveform, bigger and with the same kink in it.
 *   beat 4  Redesign. A LOCKED org chart on fixed reporting lines, where pairs of boxes
 *           trade places one swap at a time. This is the pivot of the page (not a
 *           technology problem, an organisation design problem) and it also sets up the
 *           org chart the reader is handed in the next section, so the two read as the
 *           same object.
 *
 * Everything the AI figures' header comment says applies here too: procedural and
 * deterministic, merged paths, bloom without filters, CSS keyframes so a stalled ticker
 * still lands on a complete drawing, and no numerals anywhere.
 */

import { LoneCompass, TorchDiagram, VendorDrift } from './figures-ai';
import { f, graticule } from './hud';
import type { FigureRegistry } from './BeatFigure';
import s from './story.module.css';

/* ================================================================== beat 3
   The amplifier.

   A small crooked waveform on the left, a gain stage, and the same waveform on the
   right at four times the size with exactly the same kink in it. Nothing is corrected
   on the way through. That is the whole argument: a force multiplier multiplies what it
   is given, so unmapped work does not get better, it gets louder. */

/** One waveform. `k` is the amount of deformation, and it is IDENTICAL on both sides. */
function wave(x0: number, y0: number, w: number, amp: number) {
  const pts: string[] = [];
  const N = 60;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    // A clean carrier plus a fixed defect. The defect scales with the carrier, which is
    // the point: the flaw is amplified in exact proportion to the signal.
    const clean = Math.sin(t * Math.PI * 3);
    const defect = Math.exp(-Math.pow((t - 0.58) * 7, 2)) * 1.5 - Math.exp(-Math.pow((t - 0.72) * 9, 2)) * 1.1;
    const y = y0 - (clean + defect) * amp;
    pts.push(`${i ? 'L' : 'M'} ${f(x0 + t * w)} ${f(y)}`);
  }
  return pts.join(' ');
}

const GAIN_STEPS = (() => {
  const d: string[] = [];
  for (let i = 0; i < 7; i++) {
    const h = 16 + i * 20;
    d.push(`M ${446 + i * 18} ${232 + h / 2} v ${-h}`);
  }
  return d.join(' ');
})();

function Amplifier() {
  return (
    <g className={s.hudScene}>
      <path className={s.hudGrid} d={graticule(1000, 420, 44, 26)} />

      {/* In: small, and already crooked. */}
      <path className={s.hudAxis} d="M 60 232 H 400" />
      <path className={s.hudBloom} d={wave(70, 232, 320, 22)} />
      <path className={s.hudWaveIn} d={wave(70, 232, 320, 22)} />

      {/* The gain stage. A triangle, which is what an amplifier is on every schematic
          anybody has ever read. */}
      <g className={s.hudAmp}>
        <path className={s.hudAmpBody} d="M 432 118 L 588 232 L 432 346 Z" />
        <path className={s.hudAmpStep} d={GAIN_STEPS} />
      </g>

      {/* Out: four times the size, same shape, same kink. */}
      <path className={s.hudAxis} d="M 612 232 H 952" />
      <path className={s.hudBloom} d={wave(622, 232, 320, 88)} />
      <path className={s.hudWaveOut} d={wave(622, 232, 320, 88)} />
    </g>
  );
}

/* ================================================================== beat 4
   The organisation being redesigned.

   A LOCKED org chart. The boxes sit exactly on their anchors and the reporting lines never
   move. What happens is that pairs of boxes trade places: one lifts, crosses, and settles
   into the other's slot while its partner comes the other way. One trade at a time, on a
   long cycle, so the chart is still far more often than it is moving.

   TWO EARLIER VERSIONS, and why they went. The first drew a bright curve cutting across
   the chart, which said "AI does not fit in here" but said it ABOUT the structure rather
   than through it. The second had all nine boxes drifting continuously, which Marrs read
   as floating rather than as redesign (12 Aug 2026), and he was right: a structure that
   never holds still is not being redesigned, it is just unstable. A locked chart with
   deliberate swaps is the actual claim. The org is not wobbling, it is being rearranged.

   The pairs are chosen so the two straight paths cross in the empty band BETWEEN tiers and
   never pass over a stationary box. Check that if you change them.

   No graticule. The page already has a drafting grid behind it and a second one inside the
   figure was just noise (Marrs, same note). */

const BOX_W = 132;
const BOX_H = 54;
/* Sits in a 300-tall frame now that the grid is gone, so the chart is not floating in a
   half-empty 400. `top` is set to centre the three tiers in it. */
const CHART = { top: 66, gap: 84 };

/** Three tiers: one at the top, three beneath, five beneath that. */
const TIERS = [1, 3, 5];

/**
 * Box centres and the reporting lines between them.
 *
 * THE GEOMETRY BUG THIS FIXES IS WORTH NAMING, because it is easy to reintroduce. `y` here
 * is a box CENTRE, not its top. The first version placed the bus at `y - 16` and ran each
 * stub from `y` up to it, which put the whole wiring 11px INSIDE a 54-tall box: the bus cut
 * horizontally through every box in its row and the spine ran straight down through the
 * middle column (Marrs, 12 Aug 2026). Every offset below is expressed against an EDGE
 * (`y - BOX_H / 2`) for exactly that reason. No line should ever enter a box.
 *
 * The bus sits centred in the empty band between two tiers, so:
 *   band top    = parent centre + BOX_H / 2
 *   band bottom = child centre  - BOX_H / 2
 *   bus         = midway between them
 */
const BUS_DROP = BOX_H / 2 + (CHART.gap - BOX_H) / 2;

const ORG = (() => {
  const boxes: { x: number; y: number }[] = [];
  const lines: string[] = [];
  TIERS.forEach((n, tier) => {
    const y = CHART.top + tier * CHART.gap;
    const span = 1000;
    const busY = y - BUS_DROP;
    for (let i = 0; i < n; i++) {
      const x = span * ((i + 0.5) / n);
      boxes.push({ x, y });
      // A drop from the bus down to this box's TOP EDGE. It stops there; it does not
      // continue into the box.
      if (tier > 0) lines.push(`M ${f(x)} ${f(busY)} V ${f(y - BOX_H / 2)}`);
    }
    if (tier > 0) {
      // The bus, spanning the outermost children in this tier.
      const first = span * (0.5 / n);
      const last = span * ((n - 0.5) / n);
      lines.push(`M ${f(first)} ${f(busY)} H ${f(last)}`);
      // And the spine, from the bus up to the parent row's BOTTOM EDGE.
      lines.push(`M 500 ${f(busY)} V ${f(y - CHART.gap + BOX_H / 2)}`);
    }
  });
  return { boxes, lines: lines.join(' ') };
})();

/**
 * Which boxes trade places. Indices into ORG.boxes: tier 1 is [0], tier 2 is [1,2,3],
 * tier 3 is [4..8].
 *
 * EVERY PAIR IS CROSS-TIER ON PURPOSE. Two boxes swapping along a straight line meet at
 * the midpoint, and for a cross-tier pair that midpoint falls in the empty band between
 * rows, so the crossing is legible and nothing is ever hidden behind a stationary box.
 * A same-tier pair would slide straight through its neighbours.
 */
const SWAPS: [number, number][] = [
  [1, 5], // tier 2 left  <-> tier 3, second from left
  [2, 8], // tier 2 centre <-> tier 3, far right. The long one.
  [3, 7], // tier 2 right <-> tier 3, second from right
];

/**
 * Per-box swap vector, cycle slot, and which of the pair passes in front.
 *
 * The second element of each pair is the OVER card. That is not arbitrary: it is the
 * later index, so document order already paints it on top, and the two facts have to stay
 * agreed or the card that shrinks will be the one drawn in front.
 */
const SWAP_BY_BOX = new Map<number, { dx: number; dy: number; k: number; over: boolean }>();
SWAPS.forEach(([a, b], k) => {
  const A = ORG.boxes[a];
  const B = ORG.boxes[b];
  SWAP_BY_BOX.set(a, { dx: B.x - A.x, dy: B.y - A.y, k, over: false });
  SWAP_BY_BOX.set(b, { dx: A.x - B.x, dy: A.y - B.y, k, over: true });
});

function Redesign() {
  return (
    <g className={s.hudScene}>
      {/* The wiring never moves. It is the structure; the boxes are what gets rearranged
          inside it. */}
      <path className={s.hudOrgLine} d={ORG.lines} />

      {ORG.boxes.map((b, i) => {
        const sw = SWAP_BY_BOX.get(i);
        return (
          <g
            key={i}
            className={sw ? (sw.over ? s.orgSwapOver : s.orgSwapUnder) : undefined}
            style={
              sw
                ? ({
                    ['--dx' as string]: `${f(sw.dx)}px`,
                    ['--dy' as string]: `${f(sw.dy)}px`,
                    ['--k' as string]: sw.k,
                  } as React.CSSProperties)
                : undefined
            }
          >
            <rect
              className={s.hudOrgBox}
              x={f(b.x - BOX_W / 2)}
              y={f(b.y - BOX_H / 2)}
              width={BOX_W}
              height={BOX_H}
              rx="6"
            />
            <path
              className={s.hudOrgRule}
              d={`M ${f(b.x - 38)} ${f(b.y - 8)} h 76 M ${f(b.x - 38)} ${f(b.y + 7)} h 48`}
            />
          </g>
        );
      })}
    </g>
  );
}

/* ================================================================== registry */

export const WORK_FIGURES: FigureRegistry = {
  // Reused wholesale from the sibling page. Being lost is being lost.
  lost: { viewBox: '0 0 620 580', place: 'centre', render: () => <LoneCompass /> },
  // Also reused: the vendor field IS "too many tools, too many options, too many
  // opinions", which is closer to what that figure argues than the beat it was built for.
  options: { viewBox: '0 0 1000 480', place: 'wide', render: () => <VendorDrift /> },
  // Same key geometry as /mapping's, so the two pages are identical here.
  torch: { viewBox: '0 0 1000 440', place: 'wide', render: () => <TorchDiagram /> },
  /**
   * The amplifier is no longer used by a beat. It is kept registered rather than deleted
   * because it draws the strongest single argument in the thesis (a force multiplier
   * multiplies what it is given), and that argument is likely to want a home again. A
   * registry entry nothing references costs nothing.
   */
  amplify: {
    viewBox: '0 0 1000 420',
    place: 'right',
    render: () => <Amplifier />,
  },
  misfit: { viewBox: '0 0 1000 300', place: 'wide', render: () => <Redesign /> },
};
