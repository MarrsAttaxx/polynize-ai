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
