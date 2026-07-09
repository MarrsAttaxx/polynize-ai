/**
 * Small monochrome platform marks for the calendar and plan chips. Inline SVG
 * (no icon library, per the brand anti-goals), sized by `size`, colored by
 * `currentColor`. Simplified glyphs, recognizable at 16-20px.
 */

import type { CSSProperties } from 'react';

export function PlatformIcon({
  channel,
  size = 18,
  title,
}: {
  channel: string;
  size?: number;
  title?: string;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'currentColor',
    role: 'img' as const,
    'aria-label': title ?? channel,
    style: { flexShrink: 0 } as CSSProperties,
  };

  switch (channel) {
    case 'linkedin':
      return (
        <svg {...common}>
          <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg {...common}>
          <path d="M16.6 5.82a4.28 4.28 0 0 1-1.06-2.82h-3.02v11.67a2.4 2.4 0 1 1-2.4-2.4c.22 0 .43.03.63.09V9.3a5.6 5.6 0 0 0-.63-.04 5.42 5.42 0 1 0 5.42 5.42V8.9a7.28 7.28 0 0 0 4.06 1.24V7.12a4.28 4.28 0 0 1-3-1.3z" />
        </svg>
      );
    case 'youtube':
      return (
        <svg {...common}>
          <path d="M23.5 6.5a3 3 0 0 0-2.11-2.13C19.5 3.86 12 3.86 12 3.86s-7.5 0-9.39.51A3 3 0 0 0 .5 6.5 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.5 3 3 0 0 0 2.11 2.13c1.89.51 9.39.51 9.39.51s7.5 0 9.39-.51A3 3 0 0 0 23.5 17.5 31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.5zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z" />
        </svg>
      );
    case 'x':
      return (
        <svg {...common}>
          <path d="M18.9 2H22l-7.1 8.1L23.3 22h-6.6l-5.17-6.76L5.6 22H2.5l7.6-8.68L1 2h6.75l4.67 6.18L18.9 2zm-1.16 18.1h1.72L6.35 3.8H4.5l13.24 16.3z" />
        </svg>
      );
    case 'substack':
      return (
        <svg {...common}>
          <path d="M22 4.5H2v2.6h20V4.5zM2 9.9V22l10-4.4L22 22V9.9H2z" />
        </svg>
      );
    case 'newsletter':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
          <path d="M3 6l9 7 9-7" />
        </svg>
      );
    default:
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}
