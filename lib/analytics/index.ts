/**
 * Provider-agnostic analytics. The shape of `track(event, props)` is locked so callers
 * never change when the provider does.
 *
 * WIRED TO VERCEL WEB ANALYTICS, 11 Aug 2026. Until now this was a no-op that logged to
 * the console in dev, which meant every CTA on the site was unmeasurable: the funnel
 * rework could not be evaluated at all. Vercel was the right choice by elimination
 * rather than enthusiasm. The site is already on Vercel, so there is no new vendor, no
 * cookie banner (it is cookieless and does not fingerprint), no extra script domain to
 * get blocked, and pageviews need no configuration.
 *
 * ONE THING TO KNOW: custom events are a PRO feature. Pageviews record on any plan, but
 * `track()` calls are silently dropped on Hobby. If map_click and booking_click show zero
 * while pageviews climb, that is the plan and not the code.
 *
 * The provider is forwarded to directly rather than installed via setProvider, on
 * purpose. setProvider needs a client component to run before the first event fires, and
 * a race there loses events silently. Vercel's own track() is already a safe no-op on the
 * server and before <Analytics /> mounts, so there is nothing to sequence.
 */

import { track as vercelTrack } from '@vercel/analytics';

export type AnalyticsEvent =
  /** Generic CTA click. props: { surface, label, href? } */
  | 'cta_click'
  /** Primary CTA into the mapping flow. Distinct from booking_click, which is the
      quiet nav path to Calendly, so the two can be compared rather than merged. */
  | 'map_click'
  /** Phase A advance/back. props: { from_step, to_step, question_id } */
  | 'phase_a_step'
  /** Phase A complete. props: { steps_completed, has_email } */
  | 'phase_a_complete'
  /** Phase B reveal complete. props: { shape_id, percentages } */
  | 'phase_b_complete'
  /** Phase B LLM generation failed after retry. props: { reason } */
  | 'phase_b_error'
  /** Phase C message sent. props: { agent_id, message_count } */
  | 'phase_c_message'
  /** Phase C agent switch. props: { from_agent, to_agent } */
  | 'phase_c_agent_switch'
  /** Email captured during Phase A. props: { domain } (no PII) */
  | 'email_captured'
  /** Blueprint generated. props: { id, shape_id } */
  | 'blueprint_created'
  /** Blueprint shared (copy link / native share). props: { id, method } */
  | 'blueprint_shared'
  /** Booking CTA clicked. props: { surface } */
  | 'booking_click'
  /** Page view. props: { path, referrer } */
  | 'page_view';

export type EventProps = Record<string, string | number | boolean | null | undefined>;

export interface AnalyticsProvider {
  track(event: AnalyticsEvent, props?: EventProps): void;
  identify?(userId: string, traits?: EventProps): void;
  page?(path: string, props?: EventProps): void;
}

/**
 * Vercel Web Analytics. Still logs to the console in development, because a silent
 * analytics layer is one you cannot tell apart from a broken one.
 */
const vercelProvider: AnalyticsProvider = {
  track(event, props) {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV !== 'production') {
       
      console.debug('[analytics] %s', event, props ?? {});
    }
    vercelTrack(event, props);
  },
};

let currentProvider: AnalyticsProvider = vercelProvider;

export function setProvider(provider: AnalyticsProvider): void {
  currentProvider = provider;
}

export function track(event: AnalyticsEvent, props?: EventProps): void {
  try {
    currentProvider.track(event, sanitize(props));
  } catch {
    /* analytics must never throw into the app */
  }
}

export function identify(userId: string, traits?: EventProps): void {
  try {
    currentProvider.identify?.(userId, sanitize(traits));
  } catch {
    /* swallow */
  }
}

export function page(path: string, props?: EventProps): void {
  try {
    currentProvider.page?.(path, sanitize(props));
  } catch {
    /* swallow */
  }
}

/**
 * Strip undefined values + cap string lengths so we never send giant
 * payloads or expose accidentally-included PII fields with `?? whatever`.
 */
function sanitize(props?: EventProps): EventProps | undefined {
  if (!props) return undefined;
  const out: EventProps = {};
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined) continue;
    if (typeof v === 'string') {
      out[k] = v.length > 200 ? `${v.slice(0, 200)}…` : v;
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Pulls just the email domain (no local part). Use for `email_captured`
 * so we can spot trends without storing inboxes in analytics payloads.
 */
export function emailDomain(email: string | undefined): string {
  if (!email) return 'unknown';
  const at = email.lastIndexOf('@');
  if (at < 0) return 'unknown';
  return email.slice(at + 1).toLowerCase();
}
