'use client';

/**
 * Delete one episode from the list.
 *
 * Says out loud that Descript is untouched, because that is the thing a person hesitates over: the
 * episode row is cheap and the uploaded hour of video is not, and nobody should have to guess which
 * one this button reaches.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import d from './podcast.module.css';

export function DeleteEpisode({ episodeId, title }: { episodeId: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (busy) return;
    if (
      !window.confirm(
        `Delete "${title}"?\n\nThis removes the episode and its clip proposals from the console. Nothing in Descript is touched: the project, the video and any clips already cut stay where they are.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      let res = await fetch(`/console/marketing/podcast/${episodeId}/delete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      let b = (await res.json().catch(() => null)) as
        | { error?: string; needs_confirmation?: boolean; title?: string }
        | null;

      // The server asks for the title back when the episode carries decisions worth protecting.
      if (res.status === 409 && b?.needs_confirmation) {
        const typed = window.prompt(
          `This episode has clips you have already ruled on.\n\nType its title to confirm:`,
          ''
        );
        if (typed === null) return;
        res = await fetch(`/console/marketing/podcast/${episodeId}/delete`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ confirm: typed }),
        });
        b = (await res.json().catch(() => null)) as typeof b;
      }

      if (!res.ok) {
        window.alert(b?.error ?? 'Could not delete it.');
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
      className={d.delBtn}
      onClick={() => void remove()}
      disabled={busy}
      title={`Delete ${title}`}
      aria-label={`Delete ${title}`}
    >
      {busy ? '…' : 'Delete'}
    </button>
  );
}
