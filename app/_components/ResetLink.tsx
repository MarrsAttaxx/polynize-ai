'use client';

import { useCallback, type ReactNode } from 'react';
import { track, type EventProps } from '@/lib/analytics';

type Props = {
  className?: string;
  children: ReactNode;
  /** Where to send the user after clearing local state. Defaults to /blueprint. */
  href?: string;
  event?: 'cta_click';
  eventProps?: EventProps;
};

/**
 * Both keys are cleared because the cache was rekeyed to v4 while this constant
 * still pointed at v3, which silently made "start over" a no-op.
 */
const AGENTS_STORAGE_KEYS = ['polynize_agents_state_v4', 'polynize_agents_state_v3'];

/** Kept for callers that import the key directly. */
export const AGENTS_STORAGE_KEY = AGENTS_STORAGE_KEYS[0];

/**
 * Clears the legacy /agents flow's local cache and sends the visitor onward
 * (default /blueprint). Hard navigation so any in-memory React state is dropped.
 */
export function ResetLink({
  className,
  children,
  href = '/blueprint',
  event = 'cta_click',
  eventProps,
}: Props) {
  const onClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      try {
        for (const key of AGENTS_STORAGE_KEYS) window.localStorage.removeItem(key);
        // Cookie is fine to keep (the next visit will reuse the session row);
        // we're only resetting the client-side flow cache.
      } catch {
        /* private mode etc. */
      }
      track(event, eventProps);
      window.location.href = href;
    },
    [href, event, eventProps]
  );

  return (
    <a className={className} href={href} onClick={onClick}>
      {children}
    </a>
  );
}
