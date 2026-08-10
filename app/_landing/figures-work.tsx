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
 *
 * The two here:
 *
 *   beat 3  Amplifier. One crooked input, magnified. AI is a force multiplier for the
 *           individual, so pointing it at unmapped work does not straighten the process,
 *           it runs the same crooked process louder. The output waveform is the input
 *           waveform, bigger and with the same kink in it.
 *   beat 4  Misfit. A rigid org chart of identical boxes on identical reporting lines,
 *           with the work drawn as a shape that cuts straight across them and fits none
 *           of them. This is the pivot of the page: not a technology problem, an
 *           organisation design problem, and the figure has to make the reader SEE that
 *           AI does not sit inside the structure they already have.
 *
 * Everything the AI figures' header comment says applies here too: procedural and
 * deterministic, merged paths, bloom without filters, CSS keyframes so a stalled ticker
 * still lands on a complete drawing, and no numerals anywhere.
 */

import { LoneCompass, VendorDrift } from './figures-ai';
import { Person, brackets, f, graticule, rand } from './hud';
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
   The misfit.

   A rigid hierarchy of identical boxes on identical lines, and one continuous shape that
   runs straight through all of them. Every box is the same size on purpose: the point is
   that the structure was designed for interchangeable units of work, and the thing being
   introduced is not one.

   The crossing shape is drawn LAST and bright, over the top of the chart rather than
   inside it, because "does not fit within" is the entire argument. If a future edit tucks
   it neatly into a lane, the figure has started saying the opposite. */

const BOX_W = 132;
const BOX_H = 54;
const CHART = { top: 40, gap: 84 };

/** Three tiers: one at the top, three beneath, five beneath that. */
const TIERS = [1, 3, 5];

const ORG = (() => {
  const boxes: { x: number; y: number }[] = [];
  const lines: string[] = [];
  TIERS.forEach((n, tier) => {
    const y = CHART.top + tier * CHART.gap;
    const span = 1000;
    for (let i = 0; i < n; i++) {
      const x = span * ((i + 0.5) / n);
      boxes.push({ x, y });
      if (tier > 0) {
        // A stub up to the bus, and the bus itself, so it reads as reporting lines.
        lines.push(`M ${f(x)} ${f(y)} V ${f(y - 16)}`);
      }
    }
    if (tier > 0) {
      const first = span * (0.5 / n);
      const last = span * ((n - 0.5) / n);
      lines.push(`M ${f(first)} ${f(y - 16)} H ${f(last)}`);
      lines.push(`M 500 ${f(y - 16)} V ${f(y - CHART.gap + BOX_H / 2)}`);
    }
  });
  return { boxes, lines: lines.join(' ') };
})();

/** The work: one continuous run that ignores every boundary in the chart. */
const CROSSING =
  'M 40 300 C 190 300, 214 118, 356 118 C 498 118, 520 292, 664 292 ' +
  'C 808 292, 826 180, 960 180';

function Misfit() {
  return (
    <g className={s.hudScene}>
      <path className={s.hudGrid} d={graticule(1000, 400, 44, 24)} />

      {/* The structure. Identical boxes, identical lines, no exceptions. */}
      <g className={s.hudOrg}>
        <path className={s.hudOrgLine} d={ORG.lines} />
        {ORG.boxes.map((b, i) => (
          <rect
            key={i}
            className={s.hudOrgBox}
            x={f(b.x - BOX_W / 2)}
            y={f(b.y - BOX_H / 2)}
            width={BOX_W}
            height={BOX_H}
            rx="6"
          />
        ))}
      </g>

      {/* The work, over the top. Bright, continuous, and fitting nothing. */}
      <path className={s.hudBloom} d={CROSSING} />
      <path className={s.hudCross} d={CROSSING} />
      <circle className={s.hudDot} cx="40" cy="300" r="6" />
      <circle className={s.hudDot} cx="960" cy="180" r="6" />
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
  amplify: {
    viewBox: '0 0 1000 420',
    // The route swings out to the left edge across this gap, so the figure sits right
    // of centre rather than fighting it for the same space.
    place: 'right',
    render: () => <Amplifier />,
  },
  misfit: { viewBox: '0 0 1000 400', place: 'wide', render: () => <Misfit /> },
};
