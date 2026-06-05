'use client';

/**
 * Team-only unlock control for a signed SoW. Unlocking clears the client
 * signature (an unlocked agreement is no longer signed), so it is guarded by a
 * confirm. The server route is team-scoped (requireTeamScope); this button is
 * only rendered for team viewers.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import s from '../sow.module.css';

export function SowUnlockButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (
      !window.confirm(
        'Unlock this signed Statement of Works? This clears the client signature; the client will need to sign again.'
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/console/${slug}/sow/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unlock failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className={s.unlockWrap}>
      <button
        type="button"
        className={s.unlockBtn}
        onClick={run}
        disabled={busy}
      >
        {busy ? 'Unlocking…' : 'Unlock to edit'}
      </button>
      {error && <span className={s.sigError}>{error}</span>}
    </span>
  );
}
