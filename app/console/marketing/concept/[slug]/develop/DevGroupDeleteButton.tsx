'use client';

/**
 * Discrete "Delete" in the dev hub header (top right) that removes the WHOLE
 * in-development group: the concept doc (if any) plus all its pieces and their
 * calendar entries. The confirm dialog names exactly what will be deleted so the
 * scope is never a surprise. POSTs to ./delete, then lands on the stream home.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import s from '../concept.module.css';

export function DevGroupDeleteButton({
  stream,
  count,
  title,
}: {
  stream: string;
  count: number;
  title: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const del = async () => {
    if (busy) return;
    if (count === 0) {
      window.alert(
        'There are no pieces in development here to delete. The core concept lives in Core concepts.'
      );
      return;
    }
    const msg = `Delete all ${count} piece${count === 1 ? '' : 's'} in development from "${title}"? The core concept itself is KEPT. This cannot be undone.`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    setError(null);
    try {
      const url = window.location.pathname.replace(/\/+$/, '') + '/delete';
      const res = await fetch(url, { method: 'POST' });
      const b = (await res.json().catch(() => null)) as
        | { stream?: string; error?: string }
        | null;
      if (!res.ok) {
        setError(b?.error ?? 'Could not delete.');
        setBusy(false);
        return;
      }
      router.push(`/console/marketing/stream/${b?.stream ?? stream}`);
    } catch {
      setError('Network error. Try again.');
      setBusy(false);
    }
  };

  return (
    <span className={s.groupDeleteWrap}>
      <button
        type="button"
        className={s.groupDeleteBtn}
        onClick={del}
        disabled={busy}
      >
        {busy ? 'Deleting…' : 'Delete pieces'}
      </button>
      {error ? <span className={s.groupDeleteError}>{error}</span> : null}
    </span>
  );
}
