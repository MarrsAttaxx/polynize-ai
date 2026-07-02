'use client';

/**
 * The Script screen (Phase-1 ticket T2). The first stage of the short-form
 * video middle module: an agent-drafted, human-editable script that autosaves
 * (debounced 1s + flush on blur), owner-scoped, in the authed console.
 *
 * The teleprompter view (own URL, section-by-section stepping, remote advance)
 * is ticket T3; the context chat is T4; the April draft round-trip is T5. This
 * ticket proves the authed, owner-scoped, autosaving editor.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { MarketingPiece } from '@/lib/marketing/piece-store';
import s from './script.module.css';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function ScriptScreen({
  pieceId,
  initial,
}: {
  pieceId: string;
  initial: MarketingPiece;
}) {
  const [script, setScript] = useState(initial.script);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(initial.script);

  const save = useCallback(
    async (next: string) => {
      setSaveState('saving');
      try {
        const res = await fetch(
          `/console/marketing/piece/${pieceId}/state`,
          {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ ...initial, script: next }),
          }
        );
        setSaveState(res.ok ? 'saved' : 'error');
      } catch {
        setSaveState('error');
      }
    },
    [pieceId, initial]
  );

  const scheduleSave = useCallback(
    (next: string) => {
      latest.current = next;
      setSaveState('saving');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void save(next);
      }, 1000);
    },
    [save]
  );

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    void save(latest.current);
  }, [save]);

  // Flush any pending save on unmount.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const saveLabel =
    saveState === 'saving'
      ? 'Saving…'
      : saveState === 'saved'
        ? 'Saved ✓'
        : saveState === 'error'
          ? 'Save failed'
          : '';

  return (
    <div className={s.root}>
      <header className={s.head}>
        <div className={s.headLeft}>
          <Link href="/console/marketing" className={s.back}>
            ← Marketing
          </Link>
          <div className={s.titleWrap}>
            <span className={s.eyebrow}>
              {initial.format.replace(/_/g, ' ')} · script
            </span>
            <h1 className={s.title}>{initial.title}</h1>
          </div>
        </div>
        <span
          className={`${s.saveInd} ${
            saveState === 'saving'
              ? s.saving
              : saveState === 'saved'
                ? s.ok
                : saveState === 'error'
                  ? s.err
                  : ''
          }`}
        >
          {saveLabel}
        </span>
      </header>

      <textarea
        className={s.script}
        value={script}
        spellCheck={false}
        onChange={(e) => {
          setScript(e.target.value);
          scheduleSave(e.target.value);
        }}
        onBlur={flush}
        aria-label="Script"
      />

      <p className={s.hint}>
        Edits autosave. Teleprompter mode (own URL, section stepping, remote
        advance) and the context chat land in the next tickets.
      </p>
    </div>
  );
}
