'use client';

/**
 * READ THE LABEL OFF THE URL ON ARRIVAL (D97).
 *
 * Renders nothing. On first paint it looks at the url; if it carries utm labels it asks the server
 * to remember them (an httpOnly cookie the lead capture reads later) and keeps a readable copy in
 * localStorage so analytics events can say which use case and which post they belong to.
 *
 * WHY A COMPONENT AND NOT MIDDLEWARE. Middleware could set the cookie on the first request, but
 * the site's middleware already does host rewriting for the console and touching it for a
 * marketing concern is how one rewrite breaks another. A component that posts once on mount
 * costs one request on labelled arrivals only and nothing on the rest.
 *
 * NOT ON CONSOLE ROUTES. The console has no visitors to attribute and the cookie would sit on the
 * wrong host.
 */

import { useEffect } from 'react';
import { rememberAttribution } from '@/lib/analytics';

export function AttributionCapture() {
  useEffect(() => {
    try {
      if (window.location.pathname.startsWith('/console')) return;
      const search = window.location.search;
      if (!/(^|[?&])utm_/.test(search)) return;
      rememberAttribution(search);
      void fetch('/api/attribution', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          search,
          referrer: document.referrer || undefined,
          landing: window.location.pathname,
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* attribution must never break a page */
    }
  }, []);
  return null;
}
