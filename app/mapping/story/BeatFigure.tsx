import type { FigureKind } from './content';
import s from './story.module.css';

/**
 * One small diagram per beat, sitting in the gap under its sub-line.
 *
 * Each one draws the argument of its beat rather than decorating it, in the same
 * cartographic vocabulary as the route: dashed survey lines, hollow markers, hachure.
 * They are what turns the empty space between beats into part of the story.
 *
 * Server-rendered and static by default. StoryMotion animates the pieces on entry via
 * the data-fig-* hooks, so if no script runs the diagram is simply the finished
 * drawing, which still reads correctly.
 *
 * No numerals anywhere. A figure that shows a score or a percentage would be inventing
 * data, and the only real numbers on this page are two sections down and captioned as
 * illustrative.
 */
export function BeatFigure({ kind }: { kind: FigureKind }) {
  return (
    <div className={s.figure} aria-hidden="true">
      <svg viewBox="0 0 360 150" className={s.figureSvg} focusable="false">
        {kind === 'scatter' && <Scatter />}
        {kind === 'ambiguity' && <Ambiguity />}
        {kind === 'coordinates' && <Coordinates />}
        {kind === 'guess' && <Guess />}
      </svg>
    </div>
  );
}

/** Beat 1: fragments of route that never join up. Movement without a direction. */
function Scatter() {
  const frags = [
    { d: 'M 26 104 q 18 -22 42 -12', r: -8 },
    { d: 'M 96 46 q 26 14 40 -6', r: 6 },
    { d: 'M 164 118 q 22 -20 46 -6', r: -4 },
    { d: 'M 236 40 q 20 18 44 2', r: 10 },
    { d: 'M 292 96 q 18 -16 40 -4', r: -6 },
  ];
  return (
    <g>
      {frags.map((f, i) => (
        <g key={i} data-fig-item style={{ transform: `rotate(${f.r}deg)`, transformOrigin: 'center' }}>
          <path className={s.figDash} d={f.d} />
          <circle className={s.figNode} cx={Number(f.d.split(' ')[1])} cy={Number(f.d.split(' ')[2])} r="4" />
        </g>
      ))}
    </g>
  );
}

/** Beat 2: one origin, too many equally plausible destinations. */
function Ambiguity() {
  const ends = [
    [326, 26],
    [332, 62],
    [326, 100],
    [300, 130],
    [246, 138],
  ];
  return (
    <g>
      <circle className={s.figOrigin} cx="34" cy="78" r="9" />
      <circle className={s.figOriginCore} cx="34" cy="78" r="3.5" />
      {ends.map(([x, y], i) => (
        <g key={i} data-fig-item>
          <path className={s.figDash} d={`M 44 78 Q ${(44 + x) / 2} ${y < 78 ? y - 18 : y + 18}, ${x - 12} ${y}`} />
          <circle className={s.figHollow} cx={x} cy={y} r="5" />
        </g>
      ))}
    </g>
  );
}

/** Beat 3: both coordinates missing. No fix on position, no benchmark to steer to. */
function Coordinates() {
  return (
    <g>
      {/* where you are: an unresolved position fix */}
      <g data-fig-item>
        <circle className={s.figHollow} cx="88" cy="75" r="26" />
        <circle className={s.figHollow} cx="88" cy="75" r="13" />
        <path className={s.figCross} d="M 88 42 v -14 M 88 108 v 14 M 55 75 h -14 M 121 75 h 14" />
        <text className={s.figMark} x="88" y="82">
          ?
        </text>
      </g>
      {/* what good looks like: a benchmark line that is not there */}
      <g data-fig-item>
        <path className={s.figDash} d="M 196 48 H 336" />
        <text className={s.figMark} x="266" y="86">
          ?
        </text>
        <path className={s.figCross} d="M 196 104 H 336" />
      </g>
    </g>
  );
}

/** Beat 4: three ways to spend it, no way to tell which. */
function Guess() {
  const lanes = [30, 75, 120];
  return (
    <g>
      <circle className={s.figOrigin} cx="34" cy="75" r="9" />
      <circle className={s.figOriginCore} cx="34" cy="75" r="3.5" />
      {lanes.map((y, i) => (
        <g key={i} data-fig-item>
          <path className={s.figDash} d={`M 46 75 Q 150 75, 214 ${y}`} />
          <rect className={s.figBox} x="240" y={y - 17} width="74" height="34" rx="4" />
          <text className={s.figMark} x="277" y={y + 6}>
            ?
          </text>
        </g>
      ))}
    </g>
  );
}
