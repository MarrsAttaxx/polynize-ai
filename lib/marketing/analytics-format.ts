/**
 * THE PANEL'S NUMBER AND MARK FORMATTING (was analytics-mock.ts, D66; the mock is gone, D86).
 *
 * The generator that invented sample numbers has been deleted now that the panel draws real ones.
 * That is deliberate rather than tidy-minded: a mock generator left beside a live dashboard is one
 * import away from being drawn again, and the whole risk of a mock is that somebody decides on it.
 *
 * What is kept is the part that was never fake: how a count is shortened, how a delta is signed, and
 * how a sparkline's points are laid out. Every rule in here comes from the house chart guidance, and
 * it is shared so no mark re-derives its own.
 *
 * Pure. No stores, no clock, no randomness.
 */

export function compactNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (abs >= 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toLocaleString('en-AU');
}

/** A signed delta with its sign always shown, so a flat period reads as flat rather than as blank. */

/**
 * The polyline for a sparkline, plus where its last segment starts.
 *
 * The last segment and the end dot carry the accent while the rest of the line is de-emphasised,
 * which is the stat tile's own contract: the eye should land on where it is NOW.
 *
 * Returned as numbers rather than a path string so the caller decides the stroke, the ring and the
 * marker radius, all of which are fixed specs it should not have to re-derive.
 */
export function sparklinePoints(
  values: number[],
  w: number,
  h: number,
  pad = 3
): { pts: { x: number; y: number }[] } {
  if (values.length === 0) return { pts: [] };
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const usableW = w - pad * 2;
  const usableH = h - pad * 2;
  const pts = values.map((v, i) => ({
    x: pad + (values.length === 1 ? usableW / 2 : (i / (values.length - 1)) * usableW),
    // SVG y grows downward, so the biggest value sits at the smallest y.
    y: pad + usableH - ((v - lo) / span) * usableH,
  }));
  return { pts };
}
