'use client';

/**
 * A subtle "Move concept" control in the concept header (top right). Opens a
 * small stream picker; on confirm it POSTs to ./move (which moves the concept doc
 * plus its pieces and calendar entries to the chosen stream) and lands on the new
 * stream's home. Deliberately low-key: it is a rare, deliberate action.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { STREAMS } from '@/lib/marketing/streams';
import s from './move-concept.module.css';

export function MoveConceptButton({
  currentStream,
}: {
  currentStream: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const others = STREAMS.filter((o) => o.id !== currentStream);

  const move = async () => {
    if (!target || busy) return;
    setBusy(true);
    setError(null);
    try {
      const url = window.location.pathname.replace(/\/+$/, '') + '/move';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetStream: target }),
      });
      const b = (await res.json().catch(() => null)) as
        | { stream?: string; error?: string }
        | null;
      if (!res.ok) {
        setError(b?.error ?? 'Could not move the concept.');
        setBusy(false);
        return;
      }
      router.push(`/console/marketing/stream/${target}`);
    } catch {
      setError('Network error. Try again.');
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        className={s.trigger}
        onClick={() => setOpen(true)}
      >
        Move concept
      </button>
    );
  }

  return (
    <span className={s.panel}>
      <select
        className={s.select}
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        disabled={busy}
        aria-label="Move to stream"
      >
        <option value="">Move to…</option>
        {others.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={s.go}
        onClick={move}
        disabled={busy || !target}
      >
        {busy ? 'Moving…' : 'Move'}
      </button>
      <button
        type="button"
        className={s.cancel}
        onClick={() => {
          setOpen(false);
          setError(null);
        }}
        disabled={busy}
      >
        Cancel
      </button>
      {error ? <span className={s.error}>{error}</span> : null}
    </span>
  );
}
