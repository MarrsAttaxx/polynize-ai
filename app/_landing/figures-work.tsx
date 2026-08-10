/**
 * The four beat figures for /capability-mapping, the work-modelling narrative.
 *
 * Same instrument-panel kit as figures-ai.tsx, different argument. Two of the four are
 * reused outright because they already draw exactly what these beats say:
 *
 *   beat 1  the compass, from figures-ai. "You cannot describe your own work" is the
 *           same predicament as "you are lost", so it gets the same instrument.
 *   beat 4  the slot machine, from figures-ai. "Decisions get made on a guess" is the
 *           sentence that figure was built for.
 *
 * The two new ones:
 *
 *   beat 2  BlackBox. A workflow that goes in one side and comes out the other with the
 *           middle unreadable. It is the literal claim of the beat: you know the job
 *           title and the output, and nothing about the capabilities between them.
 *   beat 3  Amplifier. One crooked input, magnified. The thesis line is that AI is a
 *           force multiplier for the individual, so pointing it at unmapped work does
 *           not straighten the process, it runs the same crooked process louder. The
 *           output waveform is the input waveform, bigger and with the same kink in it.
 *
 * Everything the AI figures' header comment says applies here too: procedural and
 * deterministic, merged paths, bloom without filters, CSS keyframes so a stalled ticker
 * still lands on a complete drawing, and no numerals anywhere.
 */

import { LoneCompass, SlotMachine } from './figures-ai';
import { Person, brackets, f, graticule, rand } from './hud';
import type { FigureRegistry } from './BeatFigure';
import s from './story.module.css';

/* ================================================================== beat 2
   The black box.

   Work goes in on the left as recognisable inputs and comes out on the right as a
   finished thing. Between them is a panel you cannot see into: a scramble of marks
   behind a heavy screen, with nothing legible. Every organisation can name the two
   ends. The beat is that nobody can name the middle. */

const IN_MARKS = [
  { y: 96, k: 'doc' },
  { y: 170, k: 'person' },
  { y: 244, k: 'doc' },
  { y: 318, k: 'person' },
] as const;

const OUT_MARKS = [
  { y: 132, k: 'doc' },
  { y: 206, k: 'doc' },
  { y: 280, k: 'doc' },
] as const;

/** The unreadable interior: a dense scribble that never resolves into steps. */
const SCRAMBLE = (() => {
  const r = rand(60606);
  const d: string[] = [];
  for (let i = 0; i < 46; i++) {
    const x = 372 + r() * 256;
    const y = 92 + r() * 246;
    const w = 14 + r() * 44;
    const h = 8 + r() * 16;
    d.push(`M ${f(x)} ${f(y)} h ${f(w)} v ${f(h)} h ${f(-w)} Z`);
  }
  return d.join(' ');
})();

const SCRAMBLE_LINKS = (() => {
  const r = rand(70701);
  const d: string[] = [];
  for (let i = 0; i < 30; i++) {
    const x = 372 + r() * 250;
    const y = 92 + r() * 250;
    d.push(`M ${f(x)} ${f(y)} L ${f(x + (r() - 0.5) * 90)} ${f(y + (r() - 0.5) * 70)}`);
  }
  return d.join(' ');
})();

function DocMark({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M -17 -22 h 24 l 10 10 v 34 h -34 Z" />
      <path d="M 7 -22 v 10 h 10" />
      <path d="M -10 -2 h 20 M -10 8 h 20 M -10 18 h 12" />
    </g>
  );
}

function BlackBox() {
  return (
    <g className={s.hudScene}>
      <path className={s.hudGrid} d={graticule(1000, 430, 44, 26)} />

      {/* What goes in. Recognisable, nameable, the part everybody can describe. */}
      <g className={s.hudHuman}>
        {IN_MARKS.map((m, i) =>
          m.k === 'doc' ? <DocMark key={i} x={132} y={m.y} /> : <Person key={i} x={132} y={m.y} sc={1.7} />
        )}
      </g>
      <path className={s.hudLineDim} d={IN_MARKS.map((m) => `M 176 ${m.y} H 316`).join(' ')} />
      <path
        className={s.hudLine}
        d={IN_MARKS.map((m) => `M 300 ${m.y - 7} L 316 ${m.y} L 300 ${m.y + 7}`).join(' ')}
      />

      {/* The box. Screened, scrambled, and deliberately illegible. */}
      <g className={s.hudBox}>
        <rect className={s.hudBoxFill} x="344" y="66" width="312" height="298" rx="10" />
        <g className={s.hudScramble}>
          <path className={s.hudScrambleLink} d={SCRAMBLE_LINKS} />
          <path className={s.hudScrambleBlock} d={SCRAMBLE} />
        </g>
        <rect className={s.hudBoxScreen} x="344" y="66" width="312" height="298" rx="10" />
        <path className={s.hudFrame} d={brackets(344, 66, 312, 298, 26)} />
        <text className={s.hudQuery} x="500" y="232" style={{ fontSize: '86px' }}>
          ?
        </text>
      </g>

      {/* What comes out. Also nameable. */}
      <path className={s.hudLineDim} d={OUT_MARKS.map((m) => `M 684 ${m.y} H 824`).join(' ')} />
      <path
        className={s.hudLine}
        d={OUT_MARKS.map((m) => `M 808 ${m.y - 7} L 824 ${m.y} L 808 ${m.y + 7}`).join(' ')}
      />
      <g className={s.hudHuman}>
        {OUT_MARKS.map((m, i) => (
          <DocMark key={i} x={868} y={m.y} />
        ))}
      </g>
    </g>
  );
}

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

/* ================================================================== registry */

export const WORK_FIGURES: FigureRegistry = {
  // Reused wholesale. Being unable to describe your work is the same predicament as
  // being lost, and it deserves the same instrument.
  lost: { viewBox: '0 0 620 580', place: 'centre', render: () => <LoneCompass /> },
  blackbox: { viewBox: '0 0 1000 430', place: 'wide', render: () => <BlackBox /> },
  amplify: {
    viewBox: '0 0 1000 420',
    // The route swings out to the left edge across this gap, so the figure sits right
    // of centre rather than fighting it for the same space.
    place: 'right',
    render: () => <Amplifier />,
  },
  gamble: { viewBox: '0 0 1000 480', place: 'wide', render: () => <SlotMachine /> },
};
