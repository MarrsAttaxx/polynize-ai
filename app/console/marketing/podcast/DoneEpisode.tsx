'use client';

/**
 * Mark an episode done, or put it back.
 *
 * A done episode leaves the list rather than being deleted, because its clips, its exclusions and its
 * Descript links are the record of what was published, and it is also the thing any future clip gets
 * cut from.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import d from './podcast.module.css';

export function DoneEpisode({ episodeId, done }: { episodeId: string; done: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const set = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/console/marketing/podcast/${episodeId}/delete`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ done: next }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        window.alert(b?.error ?? 'Could not save that.');
        return;
      }
      router.refresh();
    } catch {
      window.alert('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={done ? d.doneBtnOn : d.doneBtn}
      onClick={() => void set(!done)}
      disabled={busy}
      title={done ? 'Put it back in the list' : 'Processed. Hide it from the list.'}
    >
      {busy ? '…' : done ? 'Reopen' : 'Done'}
    </button>
  );
}
