/**
 * THE SITE REMEMBERS THE LABEL (D97, step 2 of the plan in analytics-and-scale.md).
 *
 * A visitor arrives from a post with four labels on the url. They read for a while, click into a
 * magnet, answer eleven questions, and only then give an email. By that point the url has changed
 * six times. So the labels are kept in a cookie on arrival and read back at the one moment that
 * matters: when a lead is written.
 *
 * FIRST TOUCH WINS. If the cookie is already set, a later labelled arrival does not overwrite it,
 * because the question the whole plan exists to answer is "which post started it", and that is
 * the first one. Thirty days, the same life as the session cookie.
 *
 * httpOnly, so no script on the page can read or forge it; the client component that reports the
 * url can only ask the server to set it, and the server allowlists what it stores. A second,
 * readable copy lives in localStorage for analytics events only (see lib/analytics), and never
 * reaches the lead record.
 *
 * SERVER ONLY: this file imports next/headers.
 */

import { cookies } from 'next/headers';
import { normalizeAttribution, type Attribution } from '@/lib/marketing/tracking-link';

export const ATTRIBUTION_COOKIE = 'polynize_attr';
const MAX_AGE_DAYS = 30;

/** The stored attribution, or null when there is none or it does not parse. Never throws. */
export async function readAttributionCookie(): Promise<Attribution | null> {
  try {
    const jar = await cookies();
    const raw = jar.get(ATTRIBUTION_COOKIE)?.value;
    if (!raw) return null;
    return normalizeAttribution(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Store it, unless one is already stored. Returns what is now stored, so the caller can say
 * whether this arrival was the first.
 */
export async function setAttributionCookie(
  attr: Attribution
): Promise<{ stored: Attribution; first: boolean }> {
  const existing = await readAttributionCookie();
  if (existing) return { stored: existing, first: false };
  const jar = await cookies();
  jar.set({
    name: ATTRIBUTION_COOKIE,
    value: JSON.stringify(attr),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_DAYS * 24 * 60 * 60,
  });
  return { stored: attr, first: true };
}
