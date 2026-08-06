import s from './story.module.css';

/**
 * Cartographic furniture.
 *
 * The register here is a survey sheet or nautical chart, not a treasure map: neatline,
 * graticule ticks, a compass rosette. Precise and instrument-like, which is what a head
 * of function will take seriously, and it still delivers the whole treasure-hunt
 * payload (you are lost, here is the route, here is where you arrive) without a single
 * pirate cue. No parchment, no torn edges, no ageing.
 *
 * Colour discipline, and it matters for honesty: mint is what you navigate WITH (route,
 * waypoints, neatline, compass). Coral and amber are never spent on ornament, because
 * the matrix legend two screens down asserts they mean gap and developing.
 *
 * Decorative and aria-hidden. Server-rendered and completely static.
 */

/** The sheet edge: a neatline inset from the viewport with graticule ticks. */
export function MapFrame() {
  return (
    <div className={s.sheet} aria-hidden="true">
      <span className={`${s.sheetTicks} ${s.sheetTicksTop}`} />
      <span className={`${s.sheetTicks} ${s.sheetTicksBottom}`} />
    </div>
  );
}
