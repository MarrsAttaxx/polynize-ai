/**
 * Provider-agnostic analytics. Designed so we can swap in PostHog,
 * Segment, GA4, or anything else as a single edit later. No tracker
 * is wired in v1, so calls are no-ops + a debug log.
 *
 * To add a real provider, implement an `AnalyticsProvider` and assign
 * `currentProvider`. The shape of `track(event, props)` is locked so
 * callers don't change.
 */

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
 * No-op provider used in v1. When a real tracker is wired, replace
 * `currentProvider` with the implementation. All events queue silently
 * via console.debug so we can spot-check what would fire.
 */
const noopProvider: AnalyticsProvider = {
  track(event, props) {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.debug('[analytics] %s', event, props ?? {});
    }
  },
};

let currentProvider: AnalyticsProvider = noopProvider;

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
