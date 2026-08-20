/**
 * The marketing streams (owner buckets) — one source of truth so the dashboard
 * cards, the per-stream view, the intake selector, and the finalize validator
 * never drift. A stream is who the content is FOR (brand or a person); `owner`
 * (the signed-in email) is separate and drives storage partitioning.
 *
 * Order here is the display order on the dashboard.
 */
export const STREAMS = [
  { id: 'polynize', label: 'Polynize', kind: 'company' },
  { id: 'marrs', label: 'Marrs', kind: 'person' },
  { id: 'shourov', label: 'Shourov', kind: 'person' },
  { id: 'kristin', label: 'Kristin', kind: 'person' },
  { id: 'julian', label: 'Julian', kind: 'person' },
] as const;

/**
 * COMPANY OR PERSON, and it is load-bearing rather than decorative (D45).
 *
 * It decides which post frames a narrative gets by default. A first-person post with real
 * stakes ("hard moment") is available to a person and not to a brand; a "field report" across
 * client work is the brand's version of the same job and needs nobody's sign off. And the
 * measured gap is not small: a personal profile takes 63% higher engagement than a company page
 * at similar impressions (Metricool 2026), which is a structural reason the two kinds must
 * never be judged by one number.
 *
 * The kit reads this rather than naming streams, so adding a person adds no branches.
 */
export type StreamKind = (typeof STREAMS)[number]['kind'];

export function streamKind(id: string): StreamKind {
  return STREAMS.find((s) => s.id === id)?.kind ?? 'person';
}

/**
 * Stream avatars shown on the dashboard cards (mint-ringed circles). Files live
 * in public/pam/avatars/ and are registered here as they land; streams without
 * an entry render a MINT DOT instead, at half the circle's diameter (see .streamAvatarMark).
 *
 * Patricia, Dhamiri and Avik left the team (Marrs, 2026-07-28) and are gone from
 * STREAMS above, but their avatars are kept registered on purpose: removing a
 * stream only HIDES it, it does not delete anything the stream owns, so restoring
 * one is a single line above rather than a hunt for what else was stripped out.
 */
/**
 * WHOSE MEETINGS BELONG TO WHICH CRM.
 *
 * Marrs: "Shourov's lead list is pulling my meetings not his." Correct, and it was my bug: the
 * Fireflies scan fetched recent meetings and offered the same set to every CRM, so every list
 * showed whoever the API key could see.
 *
 * It does NOT need a second API key. One key already sees the whole team's meetings, which the
 * live data proved: the Polynize Weekly Sync came back with shourov@polynize.com as organiser
 * under Marrs's key. So the fix is to filter by who ATTENDED rather than to authenticate as
 * each person.
 *
 * These addresses are taken from real attendee lists in that data. Polynize is deliberately
 * absent: it is the website-inbound CRM, and a meeting's contacts belong to the person who was
 * in the meeting. A stream with no address here is not offered the meeting pull at all.
 */
/**
 * A LIST PER PERSON, NOT ONE ADDRESS, because the two do not always agree. Marrs confirmed
 * Shourov is `shourov@polynize.io`, but Fireflies recorded him as `shourov@polynize.com` on the
 * Weekly Sync, as both attendee and organiser. Matching only the real address would have left
 * his list empty for a second time; matching only what Fireflies showed would break if the
 * alias stops being used. So both count, and adding an alias later is one entry.
 */
export const STREAM_EMAILS: Record<string, string[]> = {
  marrs: ['marrs@polynize.io'],
  shourov: ['shourov@polynize.io', 'shourov@polynize.com'],
  kristin: ['kristin@polynize.io'],
  julian: ['julian@polynize.io'],
};

/** Every address whose meetings feed this CRM. Empty when the CRM takes no meeting contacts. */
export function streamEmails(id: string): string[] {
  return STREAM_EMAILS[id] ?? [];
}

/** True when this CRM takes contacts from meetings at all. */
export function takesMeetingContacts(id: string): boolean {
  return streamEmails(id).length > 0;
}

export const STREAM_AVATARS: Record<string, string> = {
  /**
   * POLYNIZE HAS NO IMAGE ON PURPOSE. Marrs: "remove the Polynize logos on the console cards
   * and replace with a simple brand mint circle that's about half the diameter of the size of
   * the actual circle." A stream with no entry here now renders that mint dot, so the brand
   * card is a mark rather than a shrunk logo. `/pam/avatars/polynize.png` is still on disk if
   * the logo is ever wanted back.
   */
  marrs: '/pam/avatars/marrs.jpeg',
  shourov: '/pam/avatars/shourov.jpeg',
  patricia: '/pam/avatars/patricia.png',
  julian: '/pam/avatars/julian.jpeg',
  dhamiri: '/pam/avatars/dhamiri.png',
  avik: '/pam/avatars/avik.jpeg',
  kristin: '/pam/avatars/kristin.jpeg',
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
