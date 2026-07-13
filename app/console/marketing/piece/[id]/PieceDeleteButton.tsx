'use client';

/**
 * Delete an output draft (piece) from its own screen (top right). POSTs to
 * ./delete (which also removes the piece's calendar entries) and lands back on
 * the source concept if there is one, else the stream. Green outline at rest,
 * red on hover (destructive affordance).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import pd from './piece-delete.module.css';

export function PieceDeleteButton({ stream }: { stream: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const del = async () => {
    if (busy) return;
    if (!window.confirm('Delete this output draft? This cannot be undone.')) return;
    setBusy(true);
    setError(null);
    try {
      const url = window.location.pathname.replace(/\/+$/, '') + '/delete';
      const res = await fetch(url, { method: 'POST' });
      const b = (await res.json().catch(() => null)) as
        | { conceptSlug?: string; error?: string }
        | null;
      if (!res.ok) {
        setError(b?.error ?? 'Could not delete.');
        setBusy(false);
        return;
      }
      router.push(
        b?.conceptSlug
          ? `/console/marketing/concept/${b.conceptSlug}`
          : `/console/marketing/stream/${stream}`
      );
    } catch {
      setError('Network error. Try again.');
      setBusy(false);
    }
  };

  return (
    <span className={pd.wrap}>
      <button type="button" className={pd.deleteBtn} onClick={del} disabled={busy}>
        {busy ? 'Deleting…' : 'Delete'}
      </button>
      {error ? <span className={pd.error}>{error}</span> : null}
    </span>
  );
}
