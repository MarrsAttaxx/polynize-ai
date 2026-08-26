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
import { StagedBuild } from './StagedBuild';
import { BackLink } from '@/app/console/marketing/_components/BackLink';
import s from './script.module.css';
import c from './chat.module.css';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function ScriptScreen({
  initial,
  conceptBody,
  sourceLabel = 'The concept',
  scriptIsScaffold = false,
}: {
  initial: MarketingPiece;
  conceptBody?: string;
  /** What the source is called: 'The article' for a Gates piece, 'The concept' otherwise. */
  sourceLabel?: string;
  /** True when `script` is still the placeholder createOutputs seeded, so nothing real exists. */
  scriptIsScaffold?: boolean;
}) {
  const [script, setScript] = useState(initial.script);
  /**
   * Which model wrote the draft on screen, for as long as this draft is on screen.
   *
   * Deliberately NOT persisted with the piece. It is a fact about one generation, not about the
   * script: once the script has been hand-edited or chat-edited, "written by X" stops being true,
   * and a stored attribution would keep asserting it. So it lives and dies with the draft action.
   */
  const [draftModel, setDraftModel] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [chatBusy, setChatBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [undo, setUndo] = useState<string | null>(null);
  const [media, setMedia] = useState<string[]>(initial.media ?? []);
  /**
   * THE AGREED DECISIONS (D39), held here because the parent owns the only save path.
   *
   * These MUST be mirrored into refs and into the autosave body. Autosave re-sends `...initial`,
   * the piece as the server loaded it, plus one ref per mutable field. A field that lives only in
   * React state is therefore silently reverted by the next autosave a second later, which would
   * have looked exactly like "the hooks do not save" and been miserable to diagnose.
   */
  const [hooks, setHooks] = useState<string[]>(initial.hooks ?? []);
  const [outline, setOutline] = useState(initial.outline ?? '');
  const [conceptRead, setConceptRead] = useState<string[]>(initial.concept_read ?? []);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // `latest` is the single source of truth for what should be persisted; every
  // edit path writes it. The save loop always reconciles against it.
  const latest = useRef(initial.script);
  const latestHooks = useRef<string[]>(initial.hooks ?? []);
  const latestOutline = useRef(initial.outline ?? '');
  const latestConceptRead = useRef<string[]>(initial.concept_read ?? []);
  const scheduleSaveRef = useRef<((next: string) => void) | null>(null);
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
  /**
   * EVERYTHING THIS SCREEN OWNS, in one object (D63).
   *
   * The save loop used to build its body from seven refs and then re-check TWO of them, so an edit
   * to the title, the treatment, the hooks, the arc or the concept-read landing mid-flight was
   * never re-sent while the indicator went to Saved. Agreeing a hook and then pressing "Propose
   * the arc" refused with the hooks visibly ticked on screen, because the server had never been
   * told.
   *
   * The image screen never had this bug for one reason: it holds its whole state in a single ref,
   * so its one comparison covers everything. This is that property, restored by construction. The
   * PUT body is built FROM this snapshot, so a field cannot be sent without also being checked:
   * adding an eighth field to the screen cannot reintroduce the bug.
   */
  const snapshot = useCallback(
    () => ({
      title: latestTitle.current.trim() || initial.title,
      script: latest.current,
      media: latestMedia.current,
      treatment: latestTreatment.current,
      hooks: latestHooks.current,
      outline: latestOutline.current,
      concept_read: latestConceptRead.current,
    }),
    [initial.title]
  );

  const save = useCallback(async () => {
    if (inFlight.current) return; // a running loop will pick up the latest snapshot
    inFlight.current = true;
    const url =
      stateUrlRef.current || window.location.pathname.replace(/\/+$/, '') + '/state';
    try {
      for (;;) {
        const sent = snapshot();
        /**
         * Compared by VALUE, not by reference, which is the second half of the fix: `hooks`,
         * `media` and `concept_read` are arrays, and a setter that rebuilds one with the same
         * contents used to trigger a pointless resend while one that mutated in place was missed
         * entirely. Stringifying a seven field object twice per save costs nothing measurable.
         */
        const sentKey = JSON.stringify(sent);
        setSaveState('saving');
        let ok = false;
        try {
          const res = await fetch(url, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ ...initial, ...sent }),
          });
          ok = res.ok;
        } catch {
          ok = false;
        }
        if (!ok) {
          setSaveState('error');
          break;
        }
        // A newer edit to ANY field landed mid-flight, so send the whole thing again.
        if (JSON.stringify(snapshot()) !== sentKey) continue;
        setSaveState('saved');
        break;
      }
    } finally {
      inFlight.current = false;
    }
  }, [initial, snapshot]);

  /**
   * Agreeing a hook or editing the arc has to persist like any other edit. Each setter writes
   * state (for the render), the ref (for the save body), then nudges the same debounced save with
   * the unchanged script, so there is still exactly one write path and one in-flight PUT.
   */
  const commitHooks = useCallback(
    (next: string[]) => {
      setHooks(next);
      latestHooks.current = next;
      scheduleSaveRef.current?.(latest.current);
    },
    []
  );
  const commitOutline = useCallback((next: string) => {
    setOutline(next);
    latestOutline.current = next;
    scheduleSaveRef.current?.(latest.current);
  }, []);
  const commitConceptRead = useCallback((next: string[]) => {
    setConceptRead(next);
    latestConceptRead.current = next;
    scheduleSaveRef.current?.(latest.current);
  }, []);

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
  scheduleSaveRef.current = scheduleSave;

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
      const { script: drafted, model } = (await res.json()) as {
        script: string;
        model?: string;
      };
      setDraftModel(model ?? null);
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
          {/* THE STAGED BUILD (D39). Above the editor because it comes first: hooks, then the
              arc, then the script. Collapsed to one line once a script exists, so it stops
              competing with the thing he came to the screen to edit. */}
          {conceptBody ? (
            /**
             * THE SOURCE, ON THE SCREEN. Marrs, in Gate 4: "I can't remember what the
             * script is. I need a version of the script here I can look at." The article
             * was already loaded for April's chat and simply never shown to the person
             * writing against it. Open by default while the script is still empty, which
             * is when it needs reading, and collapsible once there is work to look at.
             */
            <details className={s.source} open={!script.trim()}>
              <summary className={s.sourceHead}>{sourceLabel}</summary>
              <div className={s.sourceBody}>{conceptBody}</div>
            </details>
          ) : null}
          {initial.kind !== 'text' ? (
            <StagedBuild
              hooks={hooks}
              outline={outline}
              conceptRead={conceptRead}
              onHooksChange={commitHooks}
              onOutlineChange={commitOutline}
              onConceptReadChange={commitConceptRead}
              onWriteScript={draft}
              writing={drafting}
              hasScript={script.trim() !== '' && !(scriptIsScaffold && script === initial.script)}
            />
          ) : null}
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
            {/* Who wrote it. Shown only right after a draft, so a two-model comparison is
                attributable instead of taken on faith about which env var was live. */}
            {!draftError && draftModel ? (
              <span className={s.draftModel}>written by {draftModel}</span>
            ) : null}
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
            // This narrative's own images first, the whole library folded below (D52).
            narrativeRef={initial.narrative_ref}
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
