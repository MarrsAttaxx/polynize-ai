'use client';

/**
 * "This one is good."
 *
 * The whole quality loop starts here. Marking a piece makes it a worked example in every
 * later draft for the same stream and format, which is how the prompt learns the house
 * standard instead of being told about it in adjectives.
 *
 * The NOTE is the valuable half and the easy one to skip, so marking opens the field
 * rather than saving silently. It is optional, because forcing an explanation would make
 * marking annoying enough to not bother with.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import s from './exemplar.module.css';

export function ExemplarToggle({
  pieceId,
  exemplar,
  note,
}: {
  pieceId: string;
  exemplar: boolean;
  note?: string;
}) {
  const router = useRouter();
  const [on, setOn] = useState(exemplar);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(note ?? '');
  const [busy, setBusy] = useState(false);

  const send = async (good: boolean, noteText?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/console/marketing/piece/${pieceId}/exemplar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ good, note: noteText }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        window.alert(b?.error ?? 'Could not save that.');
        return;
      }
      setOn(good);
      setOpen(false);
      router.refresh();
    } catch {
      window.alert('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (open) {
    return (
      <div className={s.wrap}>
        <input
          className={s.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What makes this one good? (optional, one line)"
          aria-label="Why this piece is good"
          autoFocus
        />
        <button type="button" className={s.on} onClick={() => void send(true, text)} disabled={busy}>
          {busy ? '…' : 'Mark it'}
        </button>
        <button type="button" className={s.quiet} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className={s.wrap}>
      {on ? (
        <>
          <span className={s.badge}>★ sets the standard</span>
          {text ? <span className={s.note}>{text}</span> : null}
          <button
            type="button"
            className={s.quiet}
            onClick={() => void send(false)}
            disabled={busy}
            title="Stop using this as an example in later drafts"
          >
            unmark
          </button>
        </>
      ) : (
        <button
          type="button"
          className={s.off}
          onClick={() => setOpen(true)}
          disabled={busy}
          title="Use this as the standard for later drafts in this stream and format"
        >
          ☆ This one is good
        </button>
      )}
    </div>
  );
}
