'use client';

/**
 * THE SLIDE RUN. The image editor for Gate 4, serving both image masters: the ten slide
 * Instagram carousel and the single quote card. Same screen, different count, and the
 * count is decided by the master rather than asked for.
 *
 * ONE SLIDE AT A TIME. The screen shows one slide, full size, with one primary action on
 * it. Approving is also advancing, so ten slides is ten taps in one place and never a
 * navigation. A progress strip along the top says where the run is and lets him jump back
 * to slide three without losing the place he was at, because the place is a number and not
 * a scroll position.
 *
 * WHAT MAKES IT FINISHABLE. The definition of done for an image piece is that piece.media
 * holds the right ids in the right order, since Gate 5 copies piece.media onto every
 * calendar entry it creates and publish.ts resolves those ids to urls in array order. So
 * media is DERIVED from the plan (mediaFromPlan) on every save, never accumulated from
 * clicks. Slide order is post order by construction, and unticking then reticking cannot
 * silently move a slide to the end the way a picker can.
 *
 * REUSE. Generation is the media library's Higgsfield call and the words are its
 * deterministic Space Grotesk overlay, chained server side in ./slides/render. Approval
 * registers the finished slide through the library's own add route, unchanged. The
 * library's Generate and Add-text panels are mounted here too, in a folded "by hand"
 * drawer, pointed at the stream's routes with the new `base` prop.
 *
 * Autosave mirrors the Script screen: debounced, flushed on blur and on unmount, and
 * SERIALIZED (one PUT in flight, latest plan coalesced) so a slow write can never
 * overwrite a newer one.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MarketingPiece } from '@/lib/marketing/piece-store';
import type { MediaAsset } from '@/lib/marketing/media-store';
import {
  parseSlidePlan,
  serialiseSlidePlan,
  mediaFromPlan,
  nextUnapproved,
  runPosition,
  approvedCount,
  slideCountFor,
  SLIDE_W,
  SLIDE_H,
  type SlidePlan,
  type Slide,
} from '@/lib/marketing/slide-plan';
import { BackLink } from '@/app/console/marketing/_components/BackLink';
import { ExemplarToggle } from './ExemplarToggle';
import { PieceDeleteButton } from './PieceDeleteButton';
import { MediaGenerate } from '../../stream/[stream]/media/MediaGenerate';
import { MediaTextOverlay } from '../../stream/[stream]/media/MediaTextOverlay';
import s from './image.module.css';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function ImageScreen({
  initial,
  conceptBody,
  sourceLabel = 'The concept',
  heroUrl,
}: {
  initial: MarketingPiece;
  conceptBody?: string;
  /** What the source is called: 'The article' for a Gates piece, 'The concept' otherwise. */
  sourceLabel?: string;
  /**
   * THE NARRATIVE'S HERO (D51): the style reference every image in this narrative is generated
   * against. Absent on a narrative with no hero, and on a piece with no narrative behind it, in
   * which case the old behaviour stands and the reference is inferred from the first approved
   * slide's background.
   */
  heroUrl?: string;
}) {
  const wanted = slideCountFor(initial);
  const isCard = wanted === 1;

  const [plan, setPlan] = useState<SlidePlan | null>(() => parseSlidePlan(initial.slides));
  const [cursor, setCursor] = useState(() => {
    const p = parseSlidePlan(initial.slides);
    return p ? runPosition(p) : 1;
  });

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [writing, setWriting] = useState(false);
  const [steer, setSteer] = useState('');
  const [rendering, setRendering] = useState<number | null>(null);
  const [approving, setApproving] = useState(false);
  const [runningRest, setRunningRest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [library, setLibrary] = useState<MediaAsset[]>([]);

  const latestPlan = useRef<SlidePlan | null>(plan);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const stopRun = useRef(false);

  /**
   * Capture the state URL ONCE at mount, for the same reason the Script screen does: the
   * unmount flush runs after the App Router has already changed window.location.pathname,
   * so deriving it at call time would PUT to the destination route and drop the work.
   */
  const stateUrlRef = useRef('');
  const streamMediaRef = useRef('');
  useEffect(() => {
    const path = window.location.pathname.replace(/\/+$/, '');
    stateUrlRef.current = `${path}/state`;
    /**
     * The stream library's routes, derived from THIS path rather than written absolute.
     * On pam.polynize.ai the middleware prepends /console, so a hardcoded
     * "/console/marketing/stream/..." fetch would double up. Slicing at the known
     * segment keeps it correct on both hosts.
     */
    const at = path.indexOf('/marketing/piece/');
    const consoleBase = at === -1 ? '' : path.slice(0, at);
    streamMediaRef.current = `${consoleBase}/marketing/stream/${initial.stream}/media`;
  }, [initial.stream]);

  // The library is only needed by the by-hand drawer's pickers. Loaded once, tolerantly:
  // no library is a weaker drawer, never a broken screen.
  useEffect(() => {
    let cancelled = false;
    const path = window.location.pathname.replace(/\/+$/, '');
    fetch(`${path}/media?stream=${encodeURIComponent(initial.stream)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (!cancelled) setLibrary(((d.media ?? []) as MediaAsset[]).filter((m) => m.kind === 'image'));
      })
      .catch(() => {
        if (!cancelled) setLibrary([]);
      });
    return () => {
      cancelled = true;
    };
  }, [initial.stream]);

  /* --------------------------------------------------------------- persistence */

  const save = useCallback(async () => {
    if (inFlight.current) return; // a running loop picks up latestPlan.current
    inFlight.current = true;
    const url =
      stateUrlRef.current || window.location.pathname.replace(/\/+$/, '') + '/state';
    try {
      for (;;) {
        const current = latestPlan.current;
        const payload = current ? serialiseSlidePlan(current) : undefined;
        setSaveState('saving');
        let ok = false;
        try {
          const res = await fetch(url, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              ...initial,
              script: initial.script ?? '',
              slides: payload,
              /**
               * THE WHOLE POINT. Derived from the plan every single time, so the ids on
               * the piece are the approved slides in slide order and nothing else. There
               * is exactly one writer of piece.media on this screen.
               */
              media: mediaFromPlan(current),
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
        if (latestPlan.current !== current) continue; // a newer plan landed mid-flight
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

  /** Every mutation goes through here: state for the render, ref for the save body. */
  const commitPlan = useCallback(
    (next: SlidePlan, immediate = false) => {
      setPlan(next);
      latestPlan.current = next;
      if (immediate) flush();
      else scheduleSave();
    },
    [flush, scheduleSave]
  );

  const patchSlide = useCallback(
    (n: number, patch: (sl: Slide) => Slide, immediate = false) => {
      const current = latestPlan.current;
      if (!current) return null;
      const next: SlidePlan = {
        ...current,
        slides: current.slides.map((sl) => (sl.n === n ? patch(sl) : sl)),
      };
      commitPlan(next, immediate);
      return next;
    },
    [commitPlan]
  );

  /* --------------------------------------------------------------- the actions */

  const writePlan = async () => {
    if (writing) return;
    setWriting(true);
    setError(null);
    try {
      const url = window.location.pathname.replace(/\/+$/, '') + '/slides';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ steer: steer.trim() }),
      });
      const b = (await res.json().catch(() => null)) as
        | { plan?: SlidePlan; error?: string }
        | null;
      if (!res.ok || !b?.plan) {
        setError(b?.error ?? 'Could not write the slides.');
        return;
      }
      const parsed = parseSlidePlan(JSON.stringify(b.plan));
      if (!parsed) {
        setError('The slides came back in a shape we could not read. Try again.');
        return;
      }
      commitPlan(parsed, true);
      setCursor(1);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setWriting(false);
    }
  };

  /**
   * Make one slide: generate the background, put the words on it, show it. Two server
   * steps, one tap, one wait.
   *
   * `keepBackground` skips the generation and only re-renders the words, which is what a
   * headline edit needs and what makes trying a bigger size instant.
   */
  const makeSlide = useCallback(
    async (n: number, keepBackground = false): Promise<boolean> => {
      const current = latestPlan.current;
      const slide = current?.slides.find((sl) => sl.n === n);
      if (!current || !slide) return false;
      if (!slide.headline.trim()) {
        setError('This slide has no words on it yet. Write them first.');
        return false;
      }
      setRendering(n);
      setError(null);
      try {
        const url = window.location.pathname.replace(/\/+$/, '') + '/slides/render';
        /**
         * Keep the whole set in one visual world. The narrative's HERO is the reference when
         * there is one, because that is an image he chose; otherwise fall back to the first
         * blessed background, which is a guess made from approval order and is what the hero
         * exists to replace.
         */
        const reference =
          heroUrl ?? current.slides.find((sl) => sl.approved && sl.bg_url)?.bg_url;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            n,
            headline: slide.headline.trim(),
            prompt: slide.prompt,
            world: current.world,
            position: slide.position,
            size: slide.size,
            baseColor: slide.baseColor,
            highlightColor: slide.highlightColor,
            bgUrl: keepBackground ? slide.bg_url : undefined,
            referenceUrl: keepBackground ? undefined : reference,
          }),
        });
        const b = (await res.json().catch(() => null)) as
          | { url?: string; bg_url?: string; error?: string }
          | null;
        if (!res.ok || !b?.url) {
          setError(b?.error ?? 'Could not make that slide.');
          // A background that survived a failed overlay is kept, so the retry is cheap.
          if (b?.bg_url) patchSlide(n, (sl) => ({ ...sl, bg_url: b.bg_url }));
          return false;
        }
        patchSlide(n, (sl) => ({
          ...sl,
          bg_url: b.bg_url ?? sl.bg_url,
          url: b.url,
          // A remade slide is no longer the approved one. The stale library asset stays
          // in the library, but the piece stops pointing at it, which is what matters.
          approved: false,
          media_id: undefined,
        }));
        return true;
      } catch {
        setError('Network error. Try again.');
        return false;
      } finally {
        setRendering(null);
      }
    },
    // heroUrl belongs here: makeSlide reads it, so without it the closure keeps whatever the
    // hero was at mount and a hero set during this session would be ignored until a reload.
    [patchSlide, heroUrl]
  );

  /**
   * Approve: register the finished slide in the stream library through the library's own
   * add route (unchanged), take the media id back, and move to the next slide needing a
   * decision. Approving IS advancing, which is what stops the run feeling like ten trips.
   */
  const approve = useCallback(
    async (n: number) => {
      const current = latestPlan.current;
      const slide = current?.slides.find((sl) => sl.n === n);
      if (!current || !slide?.url || approving) return false;
      setApproving(true);
      setError(null);
      try {
        const label = `${initial.title} slide ${n}`.slice(0, 90);
        const res = await fetch(streamMediaRef.current + '/add', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url: slide.url, kind: 'image', label }),
        });
        const b = (await res.json().catch(() => null)) as
          | { asset?: MediaAsset; error?: string }
          | null;
        if (!res.ok || !b?.asset) {
          setError(b?.error ?? 'Could not save that slide to the library.');
          return false;
        }
        const asset = b.asset;
        setLibrary((prev) => [asset, ...prev]);
        const next = patchSlide(
          n,
          (sl) => ({ ...sl, media_id: asset.media_id, approved: true }),
          true
        );
        if (next) {
          const go = nextUnapproved(next, n);
          if (go) setCursor(go);
        }
        return true;
      } catch {
        setError('Network error. Try again.');
        return false;
      } finally {
        setApproving(false);
      }
    },
    [approving, initial.title, patchSlide]
  );

  /**
   * MAKE THE REST. The generation is the slow part, not the judgement, so this queues the
   * remaining slides and leaves every approval to him. He walks away, comes back to a set
   * to review, and the run still stops at each one.
   */
  const makeRest = async () => {
    const current = latestPlan.current;
    if (!current || runningRest) return;
    stopRun.current = false;
    setRunningRest(true);
    setError(null);
    try {
      const todo = current.slides.filter((sl) => !sl.url && sl.headline.trim());
      for (const sl of todo) {
        if (stopRun.current) break;
        setCursor(sl.n);
        const ok = await makeSlide(sl.n);
        if (!ok) break;
      }
    } finally {
      setRunningRest(false);
      const after = latestPlan.current;
      if (after) setCursor(runPosition(after));
    }
  };

  /** Attach something made in the by-hand drawer to the slide on screen, and advance. */
  const attachFromLibrary = useCallback(
    (asset: MediaAsset) => {
      setLibrary((prev) => (prev.some((a) => a.media_id === asset.media_id) ? prev : [asset, ...prev]));
      const next = patchSlide(
        cursor,
        (sl) => ({ ...sl, url: asset.url, media_id: asset.media_id, approved: true }),
        true
      );
      if (next) {
        const go = nextUnapproved(next, cursor);
        if (go) setCursor(go);
      }
    },
    [cursor, patchSlide]
  );

  const copyCaption = async () => {
    if (!plan?.caption) return;
    try {
      await navigator.clipboard.writeText(plan.caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError('Could not copy. Select the caption and copy manually.');
    }
  };

  /* --------------------------------------------------------------- the keyboard */

  const slide = plan?.slides.find((sl) => sl.n === cursor) ?? null;
  const busy = writing || approving || runningRest || rendering !== null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (busy || !plan) return;
      const here = plan.slides.find((sl) => sl.n === cursor);
      if (e.key === 'Enter' && here?.url && !here.approved) {
        e.preventDefault();
        void approve(cursor);
      } else if (e.key === 'ArrowRight') {
        const after = plan.slides.find((sl) => sl.n > cursor);
        if (after) setCursor(after.n);
      } else if (e.key === 'ArrowLeft') {
        const before = [...plan.slides].reverse().find((sl) => sl.n < cursor);
        if (before) setCursor(before.n);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [approve, busy, cursor, plan]);

  /* --------------------------------------------------------------- the render */

  const done = approvedCount(plan);
  const total = plan?.slides.length ?? wanted;
  const runAt = plan ? runPosition(plan) : 1;
  const allDone = plan !== null && done === total;

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
          <BackLink
            fallbackHref="/console/marketing"
            className={s.back}
            dashboardHref={`/console/marketing/stream/${initial.stream}`}
          />
          <div className={s.titleWrap}>
            <span className={s.eyebrow}>
              {isCard ? 'quote card' : 'carousel'} · {SLIDE_W} x {SLIDE_H}
            </span>
            <h1 className={s.title}>{initial.title}</h1>
          </div>
        </div>
        <div className={s.headRight}>
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

      {!plan ? (
        /* ---------------------------------------------------- nothing written yet */
        <section className={s.startPanel}>
          <h2 className={s.startTitle}>
            {isCard ? 'One card, written from the article.' : 'Ten slides, written from the article.'}
          </h2>
          <p className={s.startNote}>
            {isCard
              ? 'April reduces the argument to one claim, writes the words for the card and the picture behind them, then you make it.'
              : 'April writes the slide narrative first: the words on each slide, the picture behind each one, and the caption. Then you go through them one at a time. Each slide has to land on its own, because there is no voiceover on a carousel.'}
          </p>
          {conceptBody ? (
            <details className={s.source}>
              <summary className={s.sourceHead}>{sourceLabel}</summary>
              <div className={s.sourceBody}>{conceptBody}</div>
            </details>
          ) : null}
          <textarea
            className={s.steer}
            value={steer}
            onChange={(e) => setSteer(e.target.value)}
            placeholder="Optional. Anything you already know you want on these slides, in your words. A line you write here goes on as written."
            aria-label="Steer"
            disabled={writing}
          />
          {error ? <p className={s.error}>{error}</p> : null}
          <button type="button" className={s.primary} onClick={writePlan} disabled={writing}>
            {writing ? 'Writing…' : isCard ? 'Write the card' : `Write the ${wanted} slides`}
          </button>
        </section>
      ) : (
        <>
          {/* ------------------------------------------------ where the run is up to */}
          {!isCard ? (
            <nav className={s.strip} aria-label="Slides">
              {plan.slides.map((sl) => (
                <button
                  key={sl.n}
                  type="button"
                  className={`${s.chip} ${sl.n === cursor ? s.chipOn : ''} ${
                    sl.approved ? s.chipDone : sl.url ? s.chipMade : ''
                  }`}
                  onClick={() => setCursor(sl.n)}
                  aria-current={sl.n === cursor}
                  title={sl.headline.replace(/\*/g, '') || `Slide ${sl.n}`}
                >
                  {sl.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sl.url} alt="" className={s.chipImg} loading="lazy" />
                  ) : null}
                  <span className={s.chipNum}>{sl.n}</span>
                  {sl.approved ? (
                    <span className={s.chipTick} aria-hidden>
                      ✓
                    </span>
                  ) : null}
                </button>
              ))}
            </nav>
          ) : null}

          <p className={s.count}>
            {done} of {total} approved
            {cursor !== runAt && !allDone ? (
              <button type="button" className={s.resume} onClick={() => setCursor(runAt)}>
                Back to slide {runAt} →
              </button>
            ) : null}
          </p>

          {allDone ? (
            <section className={s.donePanel}>
              <h2 className={s.startTitle}>
                {isCard ? 'The card is done.' : `All ${total} slides are done.`}
              </h2>
              <p className={s.startNote}>
                They are attached to this piece in slide order, so the post carries them in
                that order. Attach the images BEFORE you lay out the week: the calendar
                copies them when the week is planned and does not pick up anything added
                after.
              </p>
            </section>
          ) : null}

          {/* ------------------------------------------------------- one slide, big */}
          {slide ? (
            <section className={s.stage}>
              <div className={s.frame}>
                {slide.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={slide.url} alt={`Slide ${slide.n}`} className={s.frameImg} />
                ) : rendering === slide.n ? (
                  <div className={s.framePlaceholder}>
                    <span className={s.spinner} aria-hidden />
                    <span>Making slide {slide.n}. This takes up to a minute.</span>
                  </div>
                ) : (
                  <div className={s.framePlaceholder}>
                    <span className={s.frameNum}>{slide.n}</span>
                    <span>{slide.headline.replace(/\*/g, '') || 'No words on this one yet.'}</span>
                  </div>
                )}
              </div>

              <div className={s.sideCol}>
                <span className={s.roleTag}>
                  {slide.role === 'cover'
                    ? isCard
                      ? 'The card'
                      : 'Cover slide'
                    : slide.role === 'close'
                      ? 'Closing slide'
                      : `Slide ${slide.n}`}
                </span>
                {slide.note ? <p className={s.note}>{slide.note}</p> : null}

                <label className={s.field}>
                  <span className={s.fieldLabel}>The words on it</span>
                  <textarea
                    className={s.words}
                    value={slide.headline}
                    onChange={(e) =>
                      patchSlide(slide.n, (sl) => ({ ...sl, headline: e.target.value }))
                    }
                    onBlur={flush}
                    disabled={busy}
                    rows={3}
                    aria-label="The words on this slide"
                  />
                </label>
                <p className={s.hint}>
                  Wrap a phrase in *asterisks* to put it in mint. A line break is where the
                  line breaks.
                </p>

                <details className={s.tweak}>
                  <summary className={s.tweakHead}>The picture behind it</summary>
                  <textarea
                    className={s.prompt}
                    value={slide.prompt}
                    onChange={(e) =>
                      patchSlide(slide.n, (sl) => ({ ...sl, prompt: e.target.value }))
                    }
                    onBlur={flush}
                    disabled={busy}
                    rows={4}
                    aria-label="The picture prompt"
                  />
                  <div className={s.tweakRow}>
                    <label className={s.select}>
                      <span>Words sit</span>
                      <select
                        value={slide.position}
                        onChange={(e) =>
                          patchSlide(slide.n, (sl) => ({
                            ...sl,
                            position: e.target.value as Slide['position'],
                          }))
                        }
                        onBlur={flush}
                        disabled={busy}
                      >
                        <option value="top">Top</option>
                        <option value="upper">Upper</option>
                        <option value="centre">Centre</option>
                        <option value="lower">Lower</option>
                        <option value="bottom">Bottom</option>
                      </select>
                    </label>
                    <label className={s.select}>
                      <span>Size</span>
                      <select
                        value={slide.size}
                        onChange={(e) =>
                          patchSlide(slide.n, (sl) => ({
                            ...sl,
                            size: e.target.value as Slide['size'],
                          }))
                        }
                        onBlur={flush}
                        disabled={busy}
                      >
                        <option value="small">Small</option>
                        <option value="medium">Medium</option>
                        <option value="large">Large</option>
                      </select>
                    </label>
                    {slide.bg_url ? (
                      <button
                        type="button"
                        className={s.ghost}
                        onClick={() => void makeSlide(slide.n, true)}
                        disabled={busy}
                      >
                        Redo the words only
                      </button>
                    ) : null}
                  </div>
                </details>

                {error ? <p className={s.error}>{error}</p> : null}
              </div>
            </section>
          ) : null}

          {/* -------------------------------------------------- one action, always here */}
          <div className={s.actions}>
            {slide && !slide.url ? (
              <button
                type="button"
                className={s.primary}
                onClick={() => void makeSlide(slide.n)}
                disabled={busy || !slide.headline.trim()}
              >
                {rendering === slide.n ? 'Making…' : `Make slide ${slide.n}`}
              </button>
            ) : null}

            {slide && slide.url && !slide.approved ? (
              <>
                <button
                  type="button"
                  className={s.primary}
                  onClick={() => void approve(slide.n)}
                  disabled={busy}
                >
                  {approving ? 'Approving…' : 'Approve, next slide'}
                </button>
                <button
                  type="button"
                  className={s.ghost}
                  onClick={() => void makeSlide(slide.n)}
                  disabled={busy}
                >
                  Try another picture
                </button>
              </>
            ) : null}

            {slide && slide.approved ? (
              <>
                <span className={s.approvedTag}>Slide {slide.n} approved ✓</span>
                <button
                  type="button"
                  className={s.ghost}
                  onClick={() => void makeSlide(slide.n)}
                  disabled={busy}
                >
                  Redo this one
                </button>
              </>
            ) : null}

            {!isCard && plan.slides.some((sl) => !sl.url) ? (
              runningRest ? (
                <button
                  type="button"
                  className={s.ghost}
                  onClick={() => {
                    stopRun.current = true;
                  }}
                >
                  Stop
                </button>
              ) : (
                <button type="button" className={s.ghost} onClick={makeRest} disabled={busy}>
                  Make the rest, I will review them
                </button>
              )
            ) : null}
          </div>

          {/* ------------------------------------------------------------- the caption */}
          {plan.caption ? (
            <details className={s.captionBlock} open={allDone}>
              <summary className={s.tweakHead}>The caption</summary>
              <textarea
                className={s.caption}
                value={plan.caption}
                onChange={(e) => commitPlan({ ...plan, caption: e.target.value })}
                onBlur={flush}
                rows={6}
                aria-label="The caption"
              />
              <button type="button" className={s.ghost} onClick={copyCaption}>
                {copied ? 'Copied ✓' : 'Copy caption'}
              </button>
            </details>
          ) : null}

          {/* --------------------------------------------------------- the escape hatch */}
          <details className={s.hand}>
            <summary className={s.tweakHead}>Do this slide by hand</summary>
            <p className={s.startNote}>
              The same two tools as the media library. Anything you save here lands on
              slide {cursor} and moves you on.
            </p>
            <MediaGenerate
              stream={initial.stream}
              images={library}
              base={streamMediaRef.current}
              onSaved={attachFromLibrary}
            />
            <MediaTextOverlay
              stream={initial.stream}
              images={library}
              base={streamMediaRef.current}
              onSaved={attachFromLibrary}
            />
          </details>
        </>
      )}
    </div>
  );
}
