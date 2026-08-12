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
import { ExemplarToggle } from './ExemplarToggle';
import { ReadyToRecord } from '../../../studio/ShootRowActions';
import { StageRail } from './StageRail';
import { PieceDeleteButton } from './PieceDeleteButton';
import { MediaPicker } from './MediaPicker';
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
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [undo, setUndo] = useState<string | null>(null);
  const [media, setMedia] = useState<string[]>(initial.media ?? []);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // `latest` is the single source of truth for what should be persisted; every
  // edit path writes it. The save loop always reconciles against it.
  const latest = useRef(initial.script);
  const latestMedia = useRef<string[]>(initial.media ?? []);
  // The INTERFACE plan rides along on the autosave purely to PRESERVE it: this screen
  // PUTs the whole piece, so without carrying it a script save would wipe the screen
  // plan. It is authored on its own Interface stage, never from here.
  const latestTreatment = useRef<string | undefined>(initial.treatment);
  // The piece NAME. Many pieces come off one concept, so the angle-derived name is only a
  // starting point; it is edited in place and rides the same coalesced autosave.
  const [title, setTitle] = useState(initial.title);
  const latestTitle = useRef(initial.title);
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
        const mediaContent = latestMedia.current;
        setSaveState('saving');
        let ok = false;
        try {
          const res = await fetch(url, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              ...initial,
              title: latestTitle.current.trim() || initial.title,
              script: content,
              media: mediaContent,
              treatment: latestTreatment.current,
            }),
          });
          ok = res.ok;
        } catch {
          ok = false;
        }
        if (!ok) {
          setSaveState('error');
          break;
        }
        // newer edit arrived mid-flight (script OR media) -> re-send the latest
        if (latest.current !== content || latestMedia.current !== mediaContent) continue;
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

  // Draft (or redraft) the whole script from the concept + template recipe, the
  // video counterpart to the text screen's button. Applies through applyChatEdit
  // so the pre-draft script is one-click undoable and the result autosaves.
  const draft = async () => {
    if (drafting || chatBusy) return;
    setDrafting(true);
    setDraftError(null);
    try {
      const url = window.location.pathname.replace(/\/+$/, '') + '/script-draft';
      const res = await fetch(url, { method: 'POST' });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        setDraftError(b?.error ?? 'Could not draft the script.');
        return;
      }
      const { script: drafted } = (await res.json()) as { script: string };
      applyChatEdit(drafted);
    } catch {
      setDraftError('Network error. Try again.');
    } finally {
      setDrafting(false);
    }
  };

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
          <BackLink
            fallbackHref="/console/marketing"
            className={s.back}
            dashboardHref={`/console/marketing/stream/${initial.stream}`}
          />
          <div className={s.titleWrap}>
            <span className={s.eyebrow}>
              {(initial.format ?? '').replace(/_/g, ' ')} · script
            </span>
            {/* RENAMEABLE: the derived name is a starting point, and a concept with eight
                shorts against it needs eight distinguishable names. */}
            <input
              className={s.titleInput}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                latestTitle.current = e.target.value;
                scheduleSave(latest.current);
              }}
              onBlur={flush}
              aria-label="Piece name"
              spellCheck={false}
            />
          </div>
        </div>
        <div className={s.headRight}>
          {/* THE QUALITY MARK. Here because this is the screen where he reads the script and
              forms the opinion; a separate place to record it is a place he would not go. */}
          <ExemplarToggle
            pieceId={initial.piece_id}
            exemplar={Boolean(initial.exemplar)}
            note={initial.exemplar_note}
          />
          {/* QUEUE IT FOR THE STUDIO. Here as well as on the Prezie stage, because a piece with no prezie
              never visits that stage and would otherwise have no way into the shoot queue at all. */}
          <ReadyToRecord pieceId={initial.piece_id} ready={Boolean(initial.shoot_ready)} />
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
          <div className={s.toolbar}>
            <button
              type="button"
              className={s.draftBtn}
              onClick={draft}
              disabled={drafting || chatBusy}
            >
              {drafting
                ? 'Drafting…'
                : script.trim()
                  ? 'Redraft from the concept'
                  : 'Draft from the concept'}
            </button>
            {draftError ? <span className={s.draftError}>{draftError}</span> : null}
          </div>
          {undo !== null ? (
            <div className={s.undoBar}>
              <span>The script was rewritten.</span>
              <button
                type="button"
                className={s.undoBtn}
                onClick={revert}
                disabled={chatBusy || drafting}
              >
                Undo
              </button>
            </div>
          ) : null}
          <textarea
            className={s.script}
            value={script}
            spellCheck={false}
            disabled={chatBusy || drafting}
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
          <MediaPicker
            pieceId={initial.piece_id}
            stream={initial.stream}
            selected={media}
            disabled={chatBusy}
            onChange={(ids) => {
              setMedia(ids);
              latestMedia.current = ids;
              void save();
            }}
          />
        </div>

        <ChatPanel
          content={script}
          kind="script"
          format={initial.format}
          title={initial.title}
          conceptBody={conceptBody}
          onBusyChange={setChatBusy}
          onApply={applyChatEdit}
          disabled={drafting}
        />
      </div>
    </div>
  );
}
