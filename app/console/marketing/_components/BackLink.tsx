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
    // Use the App Router's in-app history index, not window.history.length:
    // `idx` is 0 on the entry page (however much cross-origin history the tab
    // already had) and only climbs after a genuine in-app navigation. So we step
    // back only when there is an in-app screen to return to; otherwise fall back
    // to the logical parent (never off-app / to an unrelated prior origin).
    const idx =
      typeof window !== 'undefined'
        ? (window.history.state as { idx?: number } | null)?.idx ?? 0
        : 0;
    if (idx > 0) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <a href={fallbackHref} onClick={onClick} className={className}>
      ← {label}
    </a>
  );
}
