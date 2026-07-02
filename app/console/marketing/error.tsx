'use client';

/**
 * Error boundary for the whole /console/marketing subtree (shell, piece, script,
 * teleprompter). Turns any unexpected render throw into a friendly retry instead
 * of a raw Next.js 500. Defense-in-depth: the known crash paths are already
 * guarded at the data boundary (piece-store validation), this catches the rest.
 */

import Link from 'next/link';
import { useEffect } from 'react';

export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[marketing] render error:', error);
  }, [error]);

  return (
    <div
      style={{
        maxWidth: 560,
        margin: '80px auto',
        padding: '0 24px',
        textAlign: 'center',
        color: 'var(--text-2)',
      }}
    >
      <h2
        style={{
          fontFamily: 'var(--font-space-grotesk), sans-serif',
          fontSize: 24,
          fontWeight: 700,
          color: 'var(--text)',
          margin: '0 0 10px',
        }}
      >
        Something went wrong loading Marketing.
      </h2>
      <p style={{ fontSize: 14, lineHeight: 1.55, margin: '0 0 20px' }}>
        This is usually transient. Try again, or head back to the Control Centre.
        {error.digest ? (
          <span
            style={{
              display: 'block',
              marginTop: 8,
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: 11,
              color: 'var(--text-3)',
            }}
          >
            ref {error.digest}
          </span>
        ) : null}
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <button
          type="button"
          onClick={reset}
          style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: 12,
            padding: '9px 16px',
            borderRadius: 8,
            border: '1px solid rgba(105,252,203,0.3)',
            background: 'rgba(105,252,203,0.08)',
            color: 'var(--mint)',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
        <Link
          href="/console"
          style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: 12,
            padding: '9px 16px',
            borderRadius: 8,
            border: '1px solid var(--tac-edge-dark, rgba(255,255,255,0.1))',
            color: 'var(--text-2)',
            textDecoration: 'none',
          }}
        >
          ← Control Centre
        </Link>
      </div>
    </div>
  );
}
