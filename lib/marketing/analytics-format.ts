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
