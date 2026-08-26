'use client';

/**
 * The text output screen (D23, the text module) — a non-video piece's post copy:
 * draft it from the concept (one April call), edit it, approve it, copy it out.
 * "Copy" is the interim publish step until Metricool lands (D18).
 *
 * Autosave mirrors the Script screen: debounced (1s) + flushed on blur + flushed
 * on unmount, and SERIALIZED (one PUT in flight, latest content coalesced) so a
 * slow/out-of-order write can never overwrite a newer edit. The whole piece is
 * PUT each time (script stays ''), matching the /state validated write path.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BackLink } from '@/app/console/marketing/_components/BackLink';
import { ExemplarToggle } from './ExemplarToggle';
import { PieceDeleteButton } from './PieceDeleteButton';
import { MediaPicker } from './MediaPicker';
import { PostPreview } from './PostPreview';
import type { MediaAsset } from '@/lib/marketing/media-store';
import { ChatPanel } from './ChatPanel';
import type { MarketingPiece } from '@/lib/marketing/piece-store';
import s from './text.module.css';
import c from './chat.module.css';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function channelLabel(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

export function TextOutputScreen({
  initial,
  conceptBody,
  sourceLabel = 'The concept',
}: {
  initial: MarketingPiece;
  conceptBody?: string;
  /** What the source is called: 'The article' for a Gates piece, 'The concept' otherwise. */
  sourceLabel?: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState(initial.body ?? '');
  const [status, setStatus] = useState(initial.status ?? 'draft');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [drafting, setDrafting] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [undo, setUndo] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [media, setMedia] = useState<string[]>(initial.media ?? []);
  /**
   * THE PREVIEW (D59). Which platform is being previewed, and the library the selected ids
   * resolve against. The library is handed up by the picker below rather than fetched again.
   */
  const [library, setLibrary] = useState<MediaAsset[]>([]);
  const previewNets = initial.platforms?.length ? initial.platforms : ['linkedin'];
  const [previewNet, setPreviewNet] = useState<string>(previewNets[0]);
  /**
   * IN THE ORDER THEY WILL POST. Resolved by walking the selected ids, not by filtering the
   * library, because the library is in its own order and publish.ts resolves ids in array
   * order: filtering would show him a different first image than the one that ships.
   */
  const previewImages = useMemo(() => {
    const byId = new Map(library.map((a) => [a.media_id, a]));
    return media
      .map((id) => byId.get(id))
      .filter((a): a is MediaAsset => Boolean(a) && a!.kind === 'image')
      .map((a) => a.url);
  }, [media, library]);

  const channelCount = initial.platforms?.length ?? 0;

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestBody = useRef(initial.body ?? '');
  const latestStatus = useRef(initial.status ?? 'draft');
  const latestMedia = useRef<string[]>(initial.media ?? []);
  const inFlight = useRef(false);

  const stateUrlRef = useRef('');
  useEffect(() => {
    stateUrlRef.current = window.location.pathname.replace(/\/+$/, '') + '/state';
  }, []);

  const save = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const url =
      stateUrlRef.current || window.location.pathname.replace(/\/+$/, '') + '/state';
    try {
      for (;;) {
        const contentBody = latestBody.current;
        const contentStatus = latestStatus.current;
        const contentMedia = latestMedia.current;
        setSaveState('saving');
        let ok = false;
        try {
          const res = await fetch(url, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              ...initial,
              script: '',
              body: contentBody,
              status: contentStatus,
              media: contentMedia,
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
        if (
          latestBody.current !== contentBody ||
          latestStatus.current !== contentStatus ||
          latestMedia.current !== contentMedia
        ) {
          continue; // a newer edit landed mid-flight (body, status, OR media)
        }
        setSaveState('saved');
        break;
      }
    } finally {
      inFlight.current = false;
    }
  }, [initial]);

  const scheduleSave = useCallback(() => {
    setSaveState('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void save();
    }, 1000);
  }, [save]);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    void save();
  }, [save]);

  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => flushRef.current(), []);

  const onEditBody = (next: string) => {
    setBody(next);
    latestBody.current = next;
    scheduleSave();
    if (undo !== null) setUndo(null); // a manual edit ends the undo window
  };

  // Apply a chat rewrite: snapshot the pre-edit body for one-click undo, then set
  // and autosave (the single validated write path).
  const applyChatEdit = (next: string) => {
    setUndo(latestBody.current);
    setBody(next);
    latestBody.current = next;
    scheduleSave();
  };

  const revert = () => {
    if (undo === null) return;
    setBody(undo);
    latestBody.current = undo;
    scheduleSave();
    setUndo(null);
  };

  const setStatusNow = (next: string) => {
    setStatus(next);
    latestStatus.current = next;
    flush();
  };

  const draft = async () => {
    if (drafting || chatBusy) return;
    setDrafting(true);
    setError(null);
    try {
      const url = window.location.pathname.replace(/\/+$/, '') + '/text-draft';
      const res = await fetch(url, { method: 'POST' });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(b?.error ?? 'Could not draft the post.');
        setDrafting(false);
        return;
      }
      const { body: drafted } = (await res.json()) as { body: string };
      // Route through applyChatEdit so a redraft is one-click undoable AND the undo
      // snapshot is refreshed (a stale snapshot from a prior chat edit would make
      // Undo jump two edits back, silently discarding the redraft).
      applyChatEdit(drafted);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setDrafting(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError('Could not copy. Select the text and copy manually.');
    }
  };

  const prepare = async () => {
    if (preparing) return;
    setPreparing(true);
    setError(null);
    try {
      const url = window.location.pathname.replace(/\/+$/, '') + '/prepare';
      const res = await fetch(url, { method: 'POST' });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(b?.error ?? 'Could not prepare the posts.');
        setPreparing(false);
        return;
      }
      router.push('/console/marketing/calendar');
    } catch {
      setError('Network error. Try again.');
      setPreparing(false);
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

  const approved = status === 'approved';

  return (
    <div className={s.root}>
      <header className={s.head}>
        <div className={s.headLeft}>
          <BackLink
            fallbackHref="/console/marketing"
            className={s.back}
            dashboardHref={`/console/marketing/stream/${initial.stream}`}
          />
          <div className={s.titleWrap}>
            <span className={s.eyebrow}>
              {(initial.format ?? '').replace(/_/g, ' ')} · post
            </span>
            <h1 className={s.title}>{initial.title}</h1>
          </div>
        </div>
        <div className={s.headRight}>
          {/* Same quality mark as the script screen: text pieces feed the same standard. */}
          <ExemplarToggle
            pieceId={initial.piece_id}
            exemplar={Boolean(initial.exemplar)}
            note={initial.exemplar_note}
          />
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

      {initial.platforms && initial.platforms.length > 0 ? (
        <div className={s.platforms}>
          {initial.platforms.map((c) => (
            <span key={c} className={s.platform}>
              {channelLabel(c)}
            </span>
          ))}
        </div>
      ) : null}

      {/* Three columns on this screen only: it is the one with a preview to put in the third. */}
      <div className={`${c.workspace} ${c.workspace3}`}>
        <div className={s.editorCol}>
          {conceptBody ? (
            /* The source, readable where the writing happens. Same reason as the script
               screen: it was loaded for April and never shown to the person writing. */
            <details className={s.source} open={!body.trim()}>
              <summary className={s.sourceHead}>{sourceLabel}</summary>
              <div className={s.sourceBody}>{conceptBody}</div>
            </details>
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
                : body.trim()
                  ? 'Redraft from the concept'
                  : 'Draft from the concept'}
            </button>
            <button type="button" className={s.ghostBtn} onClick={copy} disabled={!body.trim()}>
              {copied ? 'Copied ✓' : 'Copy post'}
            </button>
            {approved ? (
              <>
                <span className={s.approvedTag}>Approved ✓</span>
                <button type="button" className={s.ghostBtn} onClick={() => setStatusNow('draft')}>
                  Reopen
                </button>
                {channelCount > 0 ? (
                  <button
                    type="button"
                    className={s.draftBtn}
                    onClick={prepare}
                    disabled={preparing}
                  >
                    {preparing
                      ? 'Preparing…'
                      : `Prepare posts for ${channelCount} channel${channelCount === 1 ? '' : 's'} →`}
                  </button>
                ) : null}
              </>
            ) : (
              <button
                type="button"
                className={s.approveBtn}
                onClick={() => setStatusNow('approved')}
                disabled={!body.trim()}
              >
                Mark approved
              </button>
            )}
          </div>

          {undo !== null ? (
            <div className={s.undoBar}>
              <span>The post was rewritten.</span>
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
            className={s.body}
            value={body}
            placeholder="Draft from the concept, or write the post here. Edits autosave."
            onChange={(e) => onEditBody(e.target.value)}
            onBlur={flush}
            disabled={chatBusy || drafting}
            aria-label="Post copy"
          />
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
              flush();
            }}
            onAssets={setLibrary}
          />
          <p className={s.hint}>
            {error ? (
              <span className={s.error}>{error}</span>
            ) : (
              'Copy the post to publish it for now. Scheduling to your channels arrives with the publish step.'
            )}
          </p>
        </div>

        {/* WHAT IT LOOKS LIKE ON THE PLATFORM (D59). Marrs: "if I'm editing on the left, I can
            see on the right what it's going to look like." Between the editor and the chat in
            the DOM so a phone reads write, then see it, then talk about it; the desktop grid
            puts the chat on the far left and this on the far right. */}
        <PostPreview
          network={previewNet}
          copy={body}
          imageUrls={previewImages}
          stream={initial.stream}
          networks={previewNets}
          onPickNetwork={setPreviewNet}
        />

        <ChatPanel
          content={body}
          kind="body"
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
