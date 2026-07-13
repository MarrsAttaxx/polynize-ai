'use client';

/**
 * The Script screen (Phase-1 tickets T2 + T4). An agent-drafted, human-editable
 * script with an on-screen context chat, owner-scoped and autosaving, in the
 * authed console.
 *
 * Autosave is debounced (1s) + flushed on blur + flushed on unmount, and
 * SERIALIZED: at most one PUT is in flight and the latest content is coalesced,
 * so a slow/out-of-order request can never overwrite a newer edit.
 *
 * The chat (T4) rewrites the whole script on command. Two guards protect the
 * user's work: the editor is LOCKED while a chat command is in flight (so
 * concurrent typing can't be clobbered by the returning revision), and every
 * chat apply is one-click UNDOABLE (so an over-aggressive rewrite is always
 * recoverable, since the store keeps no version history).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { MarketingPiece } from '@/lib/marketing/piece-store';
import { ChatPanel } from './ChatPanel';
import { StageRail } from './StageRail';
import { PieceDeleteButton } from './PieceDeleteButton';
import { BackLink } from '@/app/console/marketing/_components/BackLink';
import s from './script.module.css';
import c from './chat.module.css';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function ScriptScreen({
  initial,
  conceptBody,
}: {
  initial: MarketingPiece;
  conceptBody?: string;
}) {
  const [script, setScript] = useState(initial.script);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [chatBusy, setChatBusy] = useState(false);
  const [undo, setUndo] = useState<string | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // `latest` is the single source of truth for what should be persisted; every
  // edit path writes it. The save loop always reconciles against it.
  const latest = useRef(initial.script);
  const inFlight = useRef(false);

  // Capture the state URL ONCE at mount. Deriving it inside save() at call time
  // is wrong for the unmount flush: React's cleanup runs AFTER the App Router
  // has already changed window.location.pathname to the destination, so the
  // flush would PUT to the destination's /state route (404) and drop the edit.
  // The piece URL is stable for this component's life, so snapshot it on mount.
  // (Derived from the current path, not an absolute /console path, because on
  // pam.polynize.ai the middleware prepends /console and an absolute fetch would
  // double up. Correct on both pam.polynize.ai and www.polynize.ai/console.)
  const stateUrlRef = useRef('');
  useEffect(() => {
    stateUrlRef.current = window.location.pathname.replace(/\/+$/, '') + '/state';
  }, []);

  // Serialized autosave: at most one PUT in flight. The loop always sends
  // `latest.current` and, after each PUT, re-checks it — if a newer edit landed
  // mid-flight it sends that too, so the last committed write is always the
  // newest content (last-write-wins by construction). A fetch failure breaks the
  // loop with an honest 'error'; the next edit/flush starts a fresh save. There
  // is no queued value to strand, so an error can never poison the next cycle.
  const save = useCallback(async () => {
    if (inFlight.current) return; // a running loop will pick up latest.current
    inFlight.current = true;
    const url =
      stateUrlRef.current || window.location.pathname.replace(/\/+$/, '') + '/state';
    try {
      for (;;) {
        const content = latest.current;
        setSaveState('saving');
        let ok = false;
        try {
          const res = await fetch(url, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ ...initial, script: content }),
          });
          ok = res.ok;
        } catch {
          ok = false;
        }
        if (!ok) {
          setSaveState('error');
          break;
        }
        if (latest.current !== content) continue; // newer edit arrived mid-flight
        setSaveState('saved');
        break;
      }
    } finally {
      inFlight.current = false;
    }
  }, [initial]);

  const scheduleSave = useCallback(
    (next: string) => {
      latest.current = next;
      setSaveState('saving');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void save();
      }, 1000);
    },
    [save]
  );

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      void save();
    }
  }, [save]);

  // Flush a pending debounced save on unmount (e.g. clicking the Teleprompter
  // link within the 1s debounce). Via a ref so the empty-dep effect always runs
  // the current flush. The fetch survives client-side navigation.
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => flushRef.current(), []);

  const applyChatEdit = useCallback(
    (next: string) => {
      setUndo(latest.current); // snapshot the pre-apply script for one-click undo
      setScript(next);
      scheduleSave(next);
    },
    [scheduleSave]
  );

  const revert = useCallback(() => {
    if (undo === null) return;
    setScript(undo);
    scheduleSave(undo);
    setUndo(null);
  }, [undo, scheduleSave]);

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
      <StageRail pieceId={initial.piece_id} current="script" />
      <header className={s.head}>
        <div className={s.headLeft}>
          <BackLink fallbackHref="/console/marketing" className={s.back} />
          <div className={s.titleWrap}>
            <span className={s.eyebrow}>
              {(initial.format ?? '').replace(/_/g, ' ')} · script
            </span>
            <h1 className={s.title}>{initial.title}</h1>
          </div>
        </div>
        <div className={s.headRight}>
          <Link
            href={`/console/marketing/piece/${initial.piece_id}/teleprompter`}
            className={s.prompterLink}
          >
            ▶ Teleprompter
          </Link>
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
          <PieceDeleteButton stream={initial.stream} />
        </div>
      </header>

      <div className={c.workspace}>
        <div className={s.editorCol}>
          {undo !== null ? (
            <div className={s.undoBar}>
              <span>The chat rewrote the script.</span>
              <button
                type="button"
                className={s.undoBtn}
                onClick={revert}
                disabled={chatBusy}
              >
                Undo
              </button>
            </div>
          ) : null}
          <textarea
            className={s.script}
            value={script}
            spellCheck={false}
            disabled={chatBusy}
            onChange={(e) => {
              setScript(e.target.value);
              scheduleSave(e.target.value);
              if (undo !== null) setUndo(null); // a manual edit ends the undo window
            }}
            onBlur={flush}
            aria-label="Script"
          />
          <p className={s.hint}>
            {chatBusy
              ? 'The chat is editing the script. The editor unlocks when it is done.'
              : 'Edits autosave. Use the chat to change the script by command, or open the teleprompter (own URL) to record.'}
          </p>
        </div>

        <ChatPanel
          script={script}
          format={initial.format}
          title={initial.title}
          conceptBody={conceptBody}
          onBusyChange={setChatBusy}
          onApply={applyChatEdit}
        />
      </div>
    </div>
  );
}
