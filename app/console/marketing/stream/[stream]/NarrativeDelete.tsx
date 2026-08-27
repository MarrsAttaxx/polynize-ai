'use client';

/**
 * DELETE ONE NARRATIVE FROM THE BOARD (D76).
 *
 * Marrs: "i need a way to delete 'Narratives' on the dashboard."
 *
 * A SIBLING OF THE ROW, NOT A CHILD OF IT. The lane row is a `<Link>`, and a `<button>` inside an
 * `<a>` is invalid HTML that browsers resolve however they like: the click either navigates or
 * deletes depending on which one wins. So the row is wrapped and this sits beside it, positioned
 * over the corner, where a click can only ever mean one thing.
 *
 * QUIET BUT NOT HIDDEN. A reveal-on-hover control is undiscoverable, and he asked for this because
 * he could not find one. So it is always there and always faint, and it only takes the accent on
 * hover.
 *
 * THE CONFIRM NAMES WHAT GOES. "Delete this?" is not enough for something that owns pieces and
 * calendar entries, so the sentence says the narrative, its pieces and its drafts. The server is
 * the thing that refuses when a post is live, because only it can see the calendar.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import s from './lanes.module.css';

export function NarrativeDelete({ id, headline }: { id: string; headline: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const remove = async () => {
    if (busy) return;
    const short = headline.length > 60 ? `${headline.slice(0, 60)}…` : headline;
    if (
      !window.confirm(
        `Delete "${short}"?\n\nThis removes the narrative, every piece cut from it, and any calendar drafts it created. Posts already published stay published. This cannot be undone.`
      )
    ) {
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const base = window.location.pathname.replace(/\/+$/, '');
      const at = base.indexOf('/marketing/stream/');
      const consoleBase = at === -1 ? '' : base.slice(0, at);
      const res = await fetch(`${consoleBase}/marketing/narrative/${id}/delete`, {
        method: 'DELETE',
      });
      const b = (await res.json().catch(() => null)) as
        | { error?: string; warning?: string }
        | null;
      if (!res.ok) {
        /**
         * The 409 is the useful one: it means a post is scheduled in Metricool and names it. Shown
         * in an alert rather than inline, because it is a paragraph and the row has no room, and
         * because it is a thing to act on rather than a status.
         */
        window.alert(b?.error ?? 'Could not delete that narrative.');
        setErr('not deleted');
        return;
      }
      if (b?.warning) window.alert(b.warning);
      // The board is server rendered, so a refresh is what makes the row actually leave.
      router.refresh();
    } catch {
      setErr('network');
      window.alert('Network error. The narrative was not deleted.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={s.del}
      onClick={remove}
      disabled={busy}
      title={`Delete ${headline}`}
      aria-label={`Delete narrative: ${headline}`}
    >
      {busy ? '…' : err ? '!' : '×'}
    </button>
  );
}
