'use client';

/**
 * Generate / regenerate the SoW from the Blueprint. POSTs to the generate
 * endpoint, then refreshes the route so the rendered document updates.
 *
 * Regenerate is a fresh merge: it overwrites the AUTO content and re-seeds
 * HUMAN defaults, so a confirm guards against losing manual edits.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import s from '../sow.module.css';

export function SowGenerateButton({
  slug,
  exists,
}: {
  slug: string;
  exists: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (
      exists &&
      !window.confirm(
        'Regenerate this SoW from the Blueprint? This refreshes the Blueprint-derived content and keeps the commercial fields you have already completed.'
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/console/${slug}/sow/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className={s.genWrap}>
      <button
        type="button"
        className={exists ? s.genSecondary : s.genPrimary}
        onClick={run}
        disabled={busy}
      >
        {busy
          ? 'Working…'
          : exists
            ? 'Regenerate from Blueprint'
            : 'Generate SoW'}
      </button>
      {error && <span className={s.genError}>{error}</span>}
    </span>
  );
}
