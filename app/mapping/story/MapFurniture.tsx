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
 * All of this is aria-hidden decoration. Both pieces are server-rendered and static;
 * the compass needle is the only thing that ever moves, and it moves once.
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

/**
 * Compass rosette. The page's argument in one object: the needle sits off north while
 * the reader is being told they are lost, and swings to north when the route reaches
 * the turn.
 *
 * It does not spin or loop. A continuously rotating needle is the most literal
 * treasure-hunt cue there is, it would be the only looping animation on the page, and
 * it reads as a toy. One decisive movement is the whole payoff.
 *
 * Driven purely by the data-reached attribute StoryPath already writes on the section,
 * so there is no second observer and no extra JavaScript.
 */
export function Compass() {
  return (
    <div className={s.compass} aria-hidden="true">
      <svg viewBox="0 0 64 64" width="64" height="64" focusable="false">
        <circle className={s.compRing} cx="32" cy="32" r="25" />
        <circle className={s.compRingInner} cx="32" cy="32" r="19" />
        {/* cardinal ticks */}
        {[0, 90, 180, 270].map((a) => (
          <line
            key={a}
            className={s.compTick}
            x1="32"
            y1="7"
            x2="32"
            y2="13"
            transform={`rotate(${a} 32 32)`}
          />
        ))}
        {[45, 135, 225, 315].map((a) => (
          <line
            key={a}
            className={s.compTickMinor}
            x1="32"
            y1="8"
            x2="32"
            y2="11.5"
            transform={`rotate(${a} 32 32)`}
          />
        ))}
        <text className={s.compN} x="32" y="5.5">
          N
        </text>
        {/* the needle, off north until the route arrives */}
        <g className={s.needle}>
          <path className={s.needleN} d="M32 13 L36 34 L32 31 L28 34 Z" />
          <path className={s.needleS} d="M32 51 L28 30 L32 33 L36 30 Z" />
        </g>
        <circle className={s.compHub} cx="32" cy="32" r="2.4" />
      </svg>
    </div>
  );
}
