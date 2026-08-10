import type { ArtefactKind } from './content-base';
import s from './story.module.css';

/**
 * Visuals for the three things you keep.
 *
 * Deliberately diagrammatic rather than screenshot-like. A convincing fake of the
 * product UI is the thing that got the earlier hand-drawn matrix killed, and these
 * sit under a heading promising real artefacts, so they must read as illustration,
 * not evidence. No numbers, no labels that could be mistaken for data.
 *
 * Colours come from the brand tokens, so the rebrand carries them.
 */
export function ArtefactGlyph({ kind }: { kind: ArtefactKind }) {
  if (kind === 'workmodel') {
    // The work broken into scenarios and steps: a spine with branches. This is what
    // /capability-mapping's first artefact is, and it has to read as structure rather
    // than as a chart, because the point of a work model is that it has an anatomy.
    return (
      <svg className={s.artSvg} viewBox="0 0 168 96" fill="none" aria-hidden="true">
        <path className={s.artArrow} d="M20 48h128" strokeLinecap="round" />
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect className={s.artHead} x={30 + i * 44} y={41} width={14} height={14} rx={3} />
            <path className={s.artTick} d={`M${37 + i * 44} 41v-16h22`} strokeLinecap="round" />
            <path className={s.artTick} d={`M${37 + i * 44} 55v16h22`} strokeLinecap="round" />
            <rect className={s.artLine} x={59 + i * 44} y={21} width={18} height={5} rx={2} />
            <rect className={s.artLine} x={59 + i * 44} y={68} width={18} height={5} rx={2} />
          </g>
        ))}
        <rect className={s.artHead} x={148} y={41} width={14} height={14} rx={3} />
      </svg>
    );
  }

  if (kind === 'capmap') {
    // Three lanes, one lit per row. The same anatomy as the map itself, which is the
    // whole point: the artefact card should look like the thing it is promising.
    const lane = [2, 0, 1, 2, 1, 0];
    return (
      <svg className={s.artSvg} viewBox="0 0 168 96" fill="none" aria-hidden="true">
        {lane.map((l, r) => (
          <g key={r}>
            <rect className={s.artRail} x={6} y={12 + r * 13} width={40} height={8} rx={2} />
            {[0, 1, 2].map((c) => (
              <rect
                key={c}
                className={`${s.artCell} ${l === c ? s[`art_${['coral', 'amber', 'mint'][c]}`] : s.artCellOff}`}
                x={56 + c * 36}
                y={12 + r * 13}
                width={30}
                height={8}
                rx={2}
              />
            ))}
          </g>
        ))}
      </svg>
    );
  }

  if (kind === 'benchmark') {
    // Bars under a line none of them meets. Same argument as the figure three screens
    // up, drawn small.
    const h = [26, 40, 18, 46, 32, 22];
    return (
      <svg className={s.artSvg} viewBox="0 0 168 96" fill="none" aria-hidden="true">
        <path className={s.artTick} d="M14 22h140" strokeLinecap="round" strokeDasharray="6 4" />
        {h.map((v, i) => (
          <rect key={i} className={s.artFill} x={20 + i * 22} y={78 - v} width={14} height={v} rx={2} />
        ))}
        <path className={s.artArrow} d="M14 78h140" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === 'matrix') {
    // A grid, coloured by state. The shape of the deliverable, not its contents.
    const rows = 4;
    const cols = 7;
    const tint = (r: number, c: number) => {
      const n = (r * 7 + c * 3) % 10;
      return n > 6 ? 'coral' : n > 3 ? 'amber' : 'mint';
    };
    return (
      <svg className={s.artSvg} viewBox="0 0 168 96" fill="none" aria-hidden="true">
        {Array.from({ length: rows }).map((_, r) =>
          Array.from({ length: cols }).map((_, c) => (
            <rect
              key={`${r}-${c}`}
              className={`${s.artCell} ${s[`art_${tint(r, c)}`]}`}
              x={30 + c * 19}
              y={14 + r * 19}
              width={15}
              height={15}
              rx={2.5}
            />
          ))
        )}
        {Array.from({ length: rows }).map((_, r) => (
          <rect key={r} className={s.artRail} x={6} y={17 + r * 19} width={18} height={9} rx={2} />
        ))}
      </svg>
    );
  }

  if (kind === 'data') {
    // Rows of records leaving the frame: the export.
    return (
      <svg className={s.artSvg} viewBox="0 0 168 96" fill="none" aria-hidden="true">
        <rect className={s.artFrame} x={5} y={9} width={104} height={78} rx={6} />
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect className={s.artRail} x={16} y={22 + i * 16} width={26} height={7} rx={2} />
            <rect className={s.artLine} x={50} y={22 + i * 16} width={48} height={7} rx={2} />
          </g>
        ))}
        {/* leaving the frame */}
        <path className={s.artArrow} d="M116 48h34" strokeLinecap="round" />
        <path className={s.artArrow} d="M142 40l8 8-8 8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  // report: a document with a benchmark bar and a written read
  return (
    <svg className={s.artSvg} viewBox="0 0 168 96" fill="none" aria-hidden="true">
      <rect className={s.artFrame} x={38} y={6} width={92} height={84} rx={6} />
      <rect className={s.artHead} x={52} y={20} width={40} height={8} rx={2} />
      {[0, 1, 2].map((i) => (
        <rect key={i} className={s.artLine} x={52} y={38 + i * 11} width={i === 2 ? 40 : 64} height={5} rx={2} />
      ))}
      {/* the benchmark read */}
      <rect className={s.artTrack} x={52} y={72} width={64} height={6} rx={3} />
      <rect className={s.artFill} x={52} y={72} width={40} height={6} rx={3} />
      <path className={s.artTick} d="M100 68v14" strokeLinecap="round" strokeDasharray="3 3" />
    </svg>
  );
}
