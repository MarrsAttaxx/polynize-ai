'use client';

/**
 * The two things a shoot row does in the room: open the prezie, and say it is recorded.
 *
 * The prezie and teleprompter links are plain anchors in the server component, because they have to
 * survive being opened on another device and a router push would keep them inside this tab. This is only
 * the part that needs state: marking it done, and getting out of the way once it is.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import d from './studio.module.css';

export function RecordedButton({ pieceId, title }: { pieceId: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const mark = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/console/studio/shoot', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ piece_id: pieceId }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        window.alert(b?.error ?? 'Could not save that.');
        return;
      }
      // Marked in place first, then refreshed. In a studio the confirmation has to be instant: a row
      // that sits unchanged while a request flies makes you press it twice.
      setDone(true);
      router.refresh();
    } catch {
      window.alert('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (done) return <span className={d.recorded}>recorded</span>;

  return (
    <button
      type="button"
      className={d.recordBtn}
      onClick={() => void mark()}
      disabled={busy}
      title={`Mark "${title}" recorded and move it to the rough cut`}
    >
      {busy ? '…' : 'Recorded'}
    </button>
  );
}

/**
 * Queue a piece, or take it back out. Lives on the piece's own stage rather than in the studio.
 */
export function ReadyToRecord({
  pieceId,
  ready,
  label,
}: {
  pieceId: string;
  ready: boolean;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [on, setOn] = useState(ready);

  const set = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    setOn(next);
    try {
      const res = await fetch('/console/studio/shoot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ piece_id: pieceId, ready: next }),
      });
      if (!res.ok) {
        setOn(!next);
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        window.alert(b?.error ?? 'Could not save that.');
        return;
      }
      router.refresh();
    } catch {
      setOn(!next);
      window.alert('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={on ? d.queuedBtn : d.queueBtn}
      onClick={() => void set(!on)}
      disabled={busy}
      title={
        on
          ? 'Queued for the studio. Click to take it back out.'
          : 'Put it in the studio queue, ready to record'
      }
    >
      {busy ? '…' : on ? 'In the shoot queue ✓' : (label ?? 'Ready to record')}
    </button>
  );
}
