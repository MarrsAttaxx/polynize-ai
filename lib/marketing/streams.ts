/**
 * The marketing streams (owner buckets) — one source of truth so the dashboard
 * cards, the per-stream view, the intake selector, and the finalize validator
 * never drift. A stream is who the content is FOR (brand or a person); `owner`
 * (the signed-in email) is separate and drives storage partitioning.
 *
 * Order here is the display order on the dashboard.
 */
export const STREAMS = [
  { id: 'polynize', label: 'Polynize' },
  { id: 'marrs', label: 'Marrs' },
  { id: 'shourov', label: 'Shourov' },
  { id: 'patricia', label: 'Patricia' },
  { id: 'julian', label: 'Julian' },
  { id: 'dhamiri', label: 'Dhamiri' },
  { id: 'avik', label: 'Avik' },
  { id: 'kristin', label: 'Kristin' },
] as const;

/**
 * Stream avatars shown on the dashboard cards (mint-ringed circles). Files live
 * in public/pam/avatars/ and are registered here as they land; streams without
 * an entry render an initial-letter circle instead.
 */
export const STREAM_AVATARS: Record<string, string> = {
  polynize: '/pam/avatars/polynize.png',
  marrs: '/pam/avatars/marrs.jpeg',
  shourov: '/pam/avatars/shourov.jpeg',
  patricia: '/pam/avatars/patricia.png',
  julian: '/pam/avatars/julian.jpeg',
  dhamiri: '/pam/avatars/dhamiri.png',
  avik: '/pam/avatars/avik.jpeg',
  kristin: '/pam/avatars/kristin.jpeg',
  // polynize: logo pending — shows the "P" initial until it lands.
};

export type StreamId = (typeof STREAMS)[number]['id'];

/** Tuple form for zod's z.enum(...). */
export const STREAM_IDS = STREAMS.map((s) => s.id) as [StreamId, ...StreamId[]];

export function isStreamId(x: unknown): x is StreamId {
  return typeof x === 'string' && (STREAM_IDS as readonly string[]).includes(x);
}

/** Label for a stream id, falling back to the raw id (e.g. a legacy value). */
export function streamLabel(id: string): string {
  return STREAMS.find((s) => s.id === id)?.label ?? id;
}

/** Default stream when none is chosen. */
export const DEFAULT_STREAM: StreamId = 'polynize';
