'use client';

/**
 * Back button that goes to the PREVIOUS screen, not a fixed destination. Renders
 * as a real anchor to `fallbackHref` (so middle-click / no-JS / a fresh deep
 * link still land somewhere sensible), but on a plain left-click it steps back
 * through history when there is in-app history to step back to. This replaces the
 * old fixed "← Marketing" links, which jumped to the top from anywhere.
 */

import { useRouter } from 'next/navigation';
import type { MouseEvent } from 'react';

export function BackLink({
  fallbackHref,
  label = 'Back',
  className,
}: {
  fallbackHref: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Let the browser handle new-tab / modified clicks via the href.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    // Prefer the App Router's in-app history index when it exposes one (idx > 0
    // means there is an in-app screen to return to). Next does not always set
    // `idx`, so when it is absent fall back to history.length (> 1 means we
    // navigated here in-session). This is the fix for "Back always jumped to the
    // dashboard": relying on idx alone made it undefined -> always the fallback.
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    const canGoBack = typeof idx === 'number' ? idx > 0 : window.history.length > 1;
    if (canGoBack) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  // Wrapped in one inline-flex span so the two links always sit side by side and
  // as a single unit, whatever the parent layout is: the header rows are flex
  // columns (where two bare anchors would stack vertically), but some are flex
  // rows or plain blocks. alignSelf keeps it left-aligned in a column and is a
  // harmless no-op elsewhere.
  return (
    <span style={{ display: 'inline-flex', gap: 14, alignSelf: 'flex-start' }}>
      <a href={fallbackHref} onClick={onClick} className={className}>
        ← {label}
      </a>
      <a
        href="/console/marketing"
        className={className}
        title="Back to the marketing dashboard"
      >
        Dashboard
      </a>
    </span>
  );
}
