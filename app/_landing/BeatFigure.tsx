import s from './story.module.css';

/**
 * The band a figure sits in, between two blocks of copy.
 *
 * The figure is a SIBLING of the beat, not a child of it. Inside the beat it read as a
 * small caption to the text above; in its own band it is centred in the gap between one
 * thought and the next, which is where a diagram belongs.
 *
 * It renders from a REGISTRY rather than a fixed union, because each landing page brings
 * its own figures. A beat naming a figure the page did not supply renders nothing rather
 * than throwing, which is the right failure for a marketing page.
 */

/** Where the figure sits in its band. */
export type FigurePlace = 'wide' | 'right' | 'centre';

export type FigureSpec = {
  viewBox: string;
  place: FigurePlace;
  render: () => React.ReactNode;
};

export type FigureRegistry = Record<string, FigureSpec>;

const PLACE_CLASS: Record<FigurePlace, string> = {
  wide: s.figWide,
  right: s.figRight,
  centre: s.figCentre,
};

export function BeatFigure({ kind, figures }: { kind: string; figures: FigureRegistry }) {
  const spec = figures[kind];
  if (!spec) return null;
  return (
    <div className={s.figBand}>
      <div className={`${s.figure} ${PLACE_CLASS[spec.place]}`} data-fig={kind} aria-hidden="true">
        <svg viewBox={spec.viewBox} className={s.figureSvg} focusable="false">
          {spec.render()}
        </svg>
      </div>
    </div>
  );
}
