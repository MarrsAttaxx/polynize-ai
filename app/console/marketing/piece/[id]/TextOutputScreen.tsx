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
import { FINISHED_MEDIA_FORMAT } from '@/lib/marketing/finished-media';
import { youtubeTitleFrom, YOUTUBE_TITLE_MAX } from '@/lib/marketing/youtube-title';
import s from './text.module.css';
import c from './chat.module.css';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * WHERE A POST CAN ACTUALLY GO, which is not the same list as CHANNELS (D80).
 *
 * The channel list carries seven ids including X, Substack and a newsletter. Only these four have
 * posting times, a queue and a Metricool network, so offering any of the others here would hand the
 * operator a calendar entry whose only button cannot work.
 */
const POSTABLE = ['linkedin', 'instagram', 'tiktok', 'youtube'] as const;

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
   * WHERE IT POSTS, and this is now EDITABLE (D80).
   *
   * It was a row of dead chips, set once at creation and changeable nowhere in the console. That is
   * a dead end you can walk into: `prepare` refuses a piece with no platforms and tells you to
   * "re-plan it with at least one platform", and there was no screen where a platform could be set.
   * A piece that arrived here with none, which is every piece made from finished media, could never
   * reach the calendar at all.
   */
  const [platforms, setPlatforms] = useState<string[]>(initial.platforms ?? []);
  /**
   * WHETHER APRIL REWRITES IT PER PLATFORM (D80).
   *
   * Adapting is right when the copy came from an article and has to reach four feeds with different
   * registers. It is wrong when the operator wrote the caption himself for one finished file, and
   * until now there was no way to decline it: the prepare route rewrote every channel, always.
   *
   * So the default follows where the words came from. A piece with a source behind it adapts, as it
   * always has. A piece made of finished media does not, because he typed the caption for that file
   * and having it rewritten three ways is a surprise rather than a service.
   */
  const [adapt, setAdapt] = useState(initial.format !== FINISHED_MEDIA_FORMAT);
  /**
   * THE PREVIEW (D59). Which platform is being previewed, and the library the selected ids
   * resolve against. The library is handed up by the picker below rather than fetched again.
   */
  const [library, setLibrary] = useState<MediaAsset[]>([]);
  // Follows the live selection, not the saved one, so ticking TikTok previews TikTok at once.
  const previewNets = platforms.length ? platforms : ['linkedin'];
  const [previewNet, setPreviewNet] = useState<string>(previewNets[0]);
  // A network that has just been unticked cannot stay the one being previewed.
  const shownNet = previewNets.includes(previewNet) ? previewNet : previewNets[0];
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

  /**
   * THE ATTACHED VIDEO'S NAME, for the preview (D80). A video is an exclusive selection in the
   * picker, so there is at most one, and naming it is what stops the panel and the picker
   * contradicting each other about whether anything is attached.
   */
  const previewVideo = useMemo(() => {
    const byId = new Map(library.map((a) => [a.media_id, a]));
    const found = media.map((id) => byId.get(id)).find((a) => a?.kind === 'video');
    return found?.label;
  }, [media, library]);

  const channelCount = platforms.length;

  /**
   * EXACTLY WHAT YOUTUBE WILL BE SENT (D82), from the same function publish uses, so the screen and
   * the payload cannot disagree. Live off the body, because the title IS the first line.
   */
  const ytTitle = youtubeTitleFrom(body, initial.title);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestBody = useRef(initial.body ?? '');
  const latestStatus = useRef(initial.status ?? 'draft');
  const latestMedia = useRef<string[]>(initial.media ?? []);
  /** In the snapshot with the rest (D63): a field sent without being re-checked is a field that
      can be silently dropped when an edit lands mid-flight. */
  const latestPlatforms = useRef<string[]>(initial.platforms ?? []);
  const inFlight = useRef(false);

  const stateUrlRef = useRef('');
  useEffect(() => {
    stateUrlRef.current = window.location.pathname.replace(/\/+$/, '') + '/state';
  }, []);

  /**
   * ONE PUT, AWAITED, from the current refs (D81).
   *
   * Split out of the loop below because `prepare` has to know the screen's state reached the store
   * before it asks the server to read it. Autosave is debounced by a second and prepare POSTed
   * immediately, so ticking two more platforms and pressing Prepare inside that second prepared the
   * piece as it was a moment earlier. That is almost certainly why a post ticked for Instagram,
   * TikTok and YouTube arrived in Metricool as Instagram alone.
   */
  const putOnce = useCallback(async (): Promise<boolean> => {
    const url =
      stateUrlRef.current || window.location.pathname.replace(/\/+$/, '') + '/state';
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...initial,
          script: '',
          body: latestBody.current,
          status: latestStatus.current,
          media: latestMedia.current,
          platforms: latestPlatforms.current,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, [initial]);

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
        const contentPlatforms = latestPlatforms.current;
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
              platforms: contentPlatforms,
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
          latestMedia.current !== contentMedia ||
          latestPlatforms.current !== contentPlatforms
        ) {
          continue; // a newer edit landed mid-flight (body, status, media OR platforms)
        }
        setSaveState('saved');
        break;
      }
    } finally {
      inFlight.current = false;
    }
  }, [initial]);

  /** One tick, saved like everything else on this screen. */
  const togglePlatform = (cid: string) => {
    const next = platforms.includes(cid)
      ? platforms.filter((p) => p !== cid)
      : [...platforms, cid];
    setPlatforms(next);
    latestPlatforms.current = next;
    scheduleSave();
  };

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
      /**
       * SAVE FIRST, AND WAIT (D81). The route reads the piece out of the store, so anything still
       * sitting in the debounce is invisible to it. A failed save stops here rather than preparing
       * a piece that does not match the screen.
       */
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      setSaveState('saving');
      const stored = await putOnce();
      if (!stored) {
        setSaveState('error');
        setError('Could not save your changes, so nothing was prepared. Try again.');
        setPreparing(false);
        return;
      }
      setSaveState('saved');

      const url = window.location.pathname.replace(/\/+$/, '') + '/prepare';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ adapt }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(b?.error ?? 'Could not prepare the posts.');
        setPreparing(false);
        return;
      }
      /**
       * SAY WHAT WAS CREATED (D81). It used to redirect silently, so "three platforms ticked, one
       * post in Metricool" was indistinguishable from working. The count comes from the route, which
       * has always returned it and nobody read it.
       */
      const made = (await res.json().catch(() => null)) as { count?: number } | null;
      const n = made?.count ?? 0;
      router.push(`/console/marketing/calendar?prepared=${n}`);
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

      {/* WHERE IT POSTS (D80). Buttons, not chips: this was the only piece of the plan with no
          control anywhere in the console, and a piece with none can never reach the calendar. */}
      <div className={s.platforms} role="group" aria-label="Where this posts">
        {POSTABLE.map((cid) => {
          const on = platforms.includes(cid);
          return (
            <button
              key={cid}
              type="button"
              className={`${s.platform} ${on ? s.platformOn : ''}`}
              aria-pressed={on}
              onClick={() => togglePlatform(cid)}
            >
              {channelLabel(cid)}
            </button>
          );
        })}
        {/* An id from an older piece that this screen cannot offer, shown so it is not silently
            dropped: X and Substack pieces exist and their entries are still real. */}
        {platforms
          .filter((p) => !(POSTABLE as readonly string[]).includes(p))
          .map((p) => (
            <button
              key={p}
              type="button"
              className={`${s.platform} ${s.platformOn}`}
              aria-pressed
              onClick={() => togglePlatform(p)}
              title="Not published through Metricool. Click to remove."
            >
              {channelLabel(p)}
            </button>
          ))}
      </div>

      {/* WHAT YOUTUBE WILL BE CALLED (D82). Marrs: "how are we making that up? Are you selecting
          that yourself?" A derived title nobody can see is a guess with extra steps, so it is
          printed. It comes from the first line, which is the only line written to be read. */}
      {platforms.includes('youtube') ? (
        <p className={s.ytTitle}>
          <span className={s.ytLabel}>YouTube title</span>
          {ytTitle ? (
            <>
              <span className={s.ytValue}>{ytTitle}</span>
              <span className={s.ytHint}>
                The first line of the post, {ytTitle.length}/{YOUTUBE_TITLE_MAX} characters. Change
                the first line to change it.
              </span>
            </>
          ) : (
            <span className={s.ytHint}>
              Write the post and its first line becomes the title.
            </span>
          )}
        </p>
      ) : null}

      {/* THE ONE THING THE CONSOLE CANNOT SET YET (D81). Said before he presses anything, because
          the alternative is finding out from a Metricool rejection after the fact. */}
      {platforms.includes('youtube') && previewVideo ? (
        <p className={s.caveat}>
          YouTube: a vertical video has to publish as a Short, and that setting is not in
          Metricool&rsquo;s API in any form we can send yet. Schedule it, then open the post in
          Metricool and switch the YouTube type to Short. A landscape video needs nothing.
        </p>
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
                  <>
                    {/* Said out loud, because a rewrite the operator did not ask for is the kind of
                        surprise that only shows up on the calendar. */}
                    <label className={s.adaptToggle}>
                      <input
                        type="checkbox"
                        checked={adapt}
                        onChange={(e) => setAdapt(e.target.checked)}
                      />
                      April adapts it per platform
                    </label>
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
                  </>
                ) : (
                  /* The dead end that had no exit before platforms became editable. */
                  <span className={s.needPlatform}>Tick a platform above to prepare it.</span>
                )}
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
          network={shownNet}
          copy={body}
          imageUrls={previewImages}
          videoLabel={previewVideo}
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
