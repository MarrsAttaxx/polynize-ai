'use client';

/**
 * "Develop into a script" — the bridge from a concept into production. POSTs to
 * ./develop (which creates or reuses a piece for this concept) and lands on the
 * Script screen. Path-relative so it works on pam.polynize.ai and www/console.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import s from './concept.module.css';

export function DevelopButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const develop = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const url = window.location.pathname.replace(/\/+$/, '') + '/develop';
      const res = await fetch(url, { method: 'POST' });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(b?.error ?? 'Could not develop this concept.');
        setBusy(false);
        return;
      }
      const { pieceId } = (await res.json()) as { pieceId: string };
      router.push(`/console/marketing/piece/${pieceId}`);
    } catch {
      setError('Network error. Try again.');
      setBusy(false);
    }
  };

  return (
    <div className={s.developRow}>
      <button type="button" className={s.developBtn} onClick={develop} disabled={busy}>
        {busy ? 'Developing…' : 'Develop into a script →'}
      </button>
      {error ? <span className={s.developError}>{error}</span> : null}
    </div>
  );
}
