/**
 * EVERY POST CARRIES ITS OWN LABEL (D96, step 1 of the plan in analytics-and-scale.md).
 *
 * The problem in one line, Marrs's: a viewer commented "Map", ManyChat sent the magnet, they
 * completed it and booked a meeting, and nothing recorded which post started it.
 *
 * So every calendar entry gets ONE link to polynize.ai with four labels on the end, the standard
 * UTM convention every marketing team uses and the one Vercel Web Analytics reads for free:
 *
 *   utm_source   = the network the post is on           (linkedin, instagram, tiktok, youtube, x)
 *   utm_medium   = how the link was delivered            (social: on the post; dm: a ManyChat flow;
 *                                                         reply: pasted by hand into a comment)
 *   utm_campaign = the use case                          (one of the six ids, or 'none')
 *   utm_content  = the entry id                          (which post, exactly)
 *
 * WHY THE ENTRY ID AND NOT THE PIECE ID. One piece becomes four entries on four networks, and the
 * question is "which post earned this", not "which piece". The entry already knows its piece,
 * stream, frame and use case, so one id on the link recovers all of it.
 *
 * WHY THE CONSOLE BUILDS IT AND NOTHING ELSE REWRITES IT. Metricool's shortener records nothing
 * (their words) and a forward can drop the labels; so the shortener is off and the reader sees our
 * full link. If a short spoken link is ever wanted it is a redirect on polynize.ai that expands to
 * this, counted first-party, never a third party's.
 *
 * NO PERSON IN THE LABEL, EVER. A post number and a use case. The same function reads labels back
 * on the site, and it allowlists keys and strips anything that is not a plain token, so a crafted
 * url cannot put a sentence, a script or an address into the lead record.
 *
 * PURE, so the console, the site and the tests share one definition. The site imports this file
 * from the public bundle, which is why it has no console imports.
 */

export type LinkMedium = 'social' | 'dm' | 'reply';

export const LINK_MEDIA: readonly { id: LinkMedium; label: string; hint: string }[] = [
  { id: 'social', label: 'On the post', hint: 'The first comment, the description, or the bio.' },
  { id: 'dm', label: 'ManyChat', hint: 'Paste into the flow that sends the magnet after a "Map" comment.' },
  { id: 'reply', label: 'Your reply', hint: 'When you paste it into a comment reply by hand.' },
];

/** What the label is allowed to contain: lowercase tokens only. Everything else is dropped. */
const TOKEN = /^[a-z0-9][a-z0-9_.:-]{0,99}$/;

function token(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim().toLowerCase();
  return TOKEN.test(t) ? t : undefined;
}

export type TrackingLinkInput = {
  /** 'https://polynize.ai'. Decided by the caller once; see siteOrigin(). */
  origin: string;
  /** A path on the site, '/map-your-team'. */
  path: string;
  network: string;
  medium: LinkMedium;
  useCase?: string;
  entryId: string;
};

/**
 * Build the link. Deterministic: the same input is always the same string, which is what lets the
 * console show it, the brief print it and the tests assert it without any of them storing a copy.
 */
export function buildTrackingLink(input: TrackingLinkInput): string {
  const origin = input.origin.replace(/\/+$/, '');
  const path = input.path.startsWith('/') ? input.path : `/${input.path}`;
  const url = new URL(`${origin}${path}`);
  url.searchParams.set('utm_source', token(input.network) ?? 'unknown');
  url.searchParams.set('utm_medium', input.medium);
  url.searchParams.set('utm_campaign', token(input.useCase) ?? 'none');
  url.searchParams.set('utm_content', token(input.entryId) ?? 'unknown');
  return url.toString();
}

/**
 * The three deliveries of one post's link, so the screen can offer "copy for ManyChat" without a
 * second stored field. Same post, same use case, only the medium differs.
 */
export function linkVariants(
  base: Omit<TrackingLinkInput, 'medium'>
): Record<LinkMedium, string> {
  return {
    social: buildTrackingLink({ ...base, medium: 'social' }),
    dm: buildTrackingLink({ ...base, medium: 'dm' }),
    reply: buildTrackingLink({ ...base, medium: 'reply' }),
  };
}

/**
 * The same link, delivered another way. Swaps only utm_medium, so a stored 'social' link becomes the
 * ManyChat or reply variant on screen without a second stored field. Returns the input unchanged
 * when it is not a url, because a copy button must never produce an empty string.
 */
export function withMedium(link: string, medium: LinkMedium): string {
  try {
    const url = new URL(link);
    url.searchParams.set('utm_medium', medium);
    return url.toString();
  } catch {
    return link;
  }
}

/**
 * THE SITE'S ORIGIN, decided in one place. The same fallback blueprintUrl() in lib/crm/model.ts
 * uses, for the same reason: the console runs on pam.polynize.ai and a link built from the request
 * host would point at the wrong site.
 */
export function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://polynize.ai').replace(/\/+$/, '');
}

/* ------------------------------------------------------------------ reading it back, on the site */

/**
 * What the site keeps about how a visitor arrived. Every field optional; every value a plain token
 * or a bare hostname. This is what goes on the lead, so it is deliberately small and boring.
 */
export type Attribution = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  /** The referrer's HOSTNAME only, never the full url, which can carry someone else's query string. */
  referrer?: string;
  /** The path they landed on, no query string. */
  landing?: string;
};

const UTM_KEYS: [keyof Attribution, string][] = [
  ['source', 'utm_source'],
  ['medium', 'utm_medium'],
  ['campaign', 'utm_campaign'],
  ['content', 'utm_content'],
  ['term', 'utm_term'],
];

/**
 * Read the labels off a query string. Returns null when there are none, so a plain visit stores
 * nothing rather than an empty object that looks like an arrival with no source.
 */
export function readAttribution(
  search: string | URLSearchParams,
  extra: { referrer?: string; landing?: string } = {}
): Attribution | null {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const out: Attribution = {};
  for (const [field, key] of UTM_KEYS) {
    const v = token(params.get(key));
    if (v) out[field] = v;
  }
  const ref = hostnameOf(extra.referrer);
  if (ref) out.referrer = ref;
  const landing = pathOf(extra.landing);
  if (landing) out.landing = landing;
  // A referrer or a landing path alone is not an attribution: no label, nothing to attribute to.
  const labelled = UTM_KEYS.some(([field]) => out[field] !== undefined);
  return labelled ? out : null;
}

/** Accept a stored attribution back from a cookie or a row, applying the same rules as a fresh read. */
export function normalizeAttribution(raw: unknown): Attribution | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const out: Attribution = {};
  for (const [field] of UTM_KEYS) {
    const v = token(r[field]);
    if (v) out[field] = v;
  }
  const ref = hostnameOf(typeof r.referrer === 'string' ? r.referrer : undefined);
  if (ref) out.referrer = ref;
  const landing = pathOf(typeof r.landing === 'string' ? r.landing : undefined);
  if (landing) out.landing = landing;
  return UTM_KEYS.some(([field]) => out[field] !== undefined) ? out : null;
}

function hostnameOf(v: string | undefined): string | undefined {
  if (!v) return undefined;
  try {
    const h = new URL(v.includes('://') ? v : `https://${v}`).hostname.toLowerCase();
    return /^[a-z0-9.-]{1,120}$/.test(h) ? h : undefined;
  } catch {
    return undefined;
  }
}

function pathOf(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const p = v.split('?')[0].split('#')[0].trim();
  return /^\/[a-zA-Z0-9\-_/.]{0,200}$/.test(p) ? p : undefined;
}
