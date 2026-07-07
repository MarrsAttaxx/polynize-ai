'use client';

/**
 * Delete a concept doc (with a confirm). POSTs to ./delete and returns to the
 * stream on success. Owner-scoped + team-only on the server; this is the client
 * affordance. Path-relative so it works on pam.polynize.ai and www/console.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import s from './concept.module.css';

export function DeleteButton({ stream }: { stream: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const del = async () => {
    if (busy) return;
    if (!window.confirm('Delete this concept? This cannot be undone.')) return;
    setBusy(true);
    setError(null);
    try {
      const url = window.location.pathname.replace(/\/+$/, '') + '/delete';
      const res = await fetch(url, { method: 'POST' });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(b?.error ?? 'Could not delete this concept.');
        setBusy(false);
        return;
      }
      router.push(`/console/marketing/stream/${stream}`);
    } catch {
      setError('Network error. Try again.');
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className={s.deleteBtn} onClick={del} disabled={busy}>
        {busy ? 'Deleting…' : 'Delete'}
      </button>
      {error ? <span className={s.developError}>{error}</span> : null}
    </>
  );
}
