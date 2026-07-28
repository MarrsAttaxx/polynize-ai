'use client';

/**
 * The SCREEN PROMPT stage (D29, revised 2026-07-21 after Marrs's first real pass).
 *
 * It used to render a prose build brief that opened with BUILD BRIEF / DESIGN SYSTEM /
 * OPERATOR STRIP boilerplate. That existed for an external animator; the console builds
 * the deck itself now, so the engine already knows all of it and printing it only made
 * the panel unreadable. "Hide the rest of the system prompt, all I want is slide 1
 * description, slide 2 description, slide 3 description."
 *
 * So the stage is now two columns:
 *  - LEFT  the script, split into its sections, for reference: this section needs that
 *          slide.
 *  - RIGHT the plan as SLIDE CARDS. Each card is the only two things a human decides:
 *          what is on screen, and what it says. Add, edit, reorder and delete by hand,
 *          or ask April to propose the set. Everything technical (classes, colour
 *          roles, depth, gestures, the figure transitions) stays hidden and is applied
 *          by the engine when the deck is built.
 *
 * Slides persist as JSON on `piece.slides` through the existing /state autosave.
 *
 * Below both columns, once a deck exists, sits THE BUILT DECK: the states as chips, a
 * live preview of the selected one, and a line to tell April what to change about THAT
 * STATE ALONE. Rebuilding re-decides every state, so it was impossible to fix one
 * slide without disturbing the others; this is the surgical path.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { MarketingPiece } from '@/lib/marketing/piece-store';
import { parseSlides, serializeSlides, scriptSections, type Slide } from '@/lib/marketing/slides';
import { StageRail } from '../StageRail';
import { BackLink } from '@/app/console/marketing/_components/BackLink';
import s from '../script.module.css';
import d from './slides.module.css';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type DeckStateInfo = { label: string; cue: string };

export function ScreenPromptScreen({
  initial,
  deckStates,
}: {
  initial: MarketingPiece;
  deckStates: DeckStateInfo[] | null;
}) {
  const [slides, setSlides] = useState<Slide[]>(() => parseSlides(initial.slides));
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [direction, setDirection] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deckUrl, setDeckUrl] = useState<string | null>(
    deckStates?.length ? `/console/deck/${initial.piece_id}` : null
  );
  const [built, setBuilt] = useState<DeckStateInfo[]>(deckStates ?? []);
  const [sel, setSel] = useState(0);
  const [tweak, setTweak] = useState('');
  const [revising, setRevising] = useState(false);
  // Bumped on every change so the preview iframe reloads instead of serving its cache.
  const [previewV, setPreviewV] = useState(0);
  // Deck feedback is kept separate from the slide-planning feedback: they sit in
  // different parts of the page, and a note appearing far from the button that caused
  // it reads as unrelated.
  const [deckNote, setDeckNote] = useState<string | null>(null);
  const [deckError, setDeckError] = useState<string | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<Slide[]>(slides);
  const inFlight = useRef(false);
  const script = (initial.script ?? '').trim();
  const hasScript = Boolean(script);
  const sections = scriptSections(script);

  const stateUrlRef = useRef('');
  const baseUrlRef = useRef('');
  useEffect(() => {
    const base = window.location.pathname
      .replace(/\/screen-prompt\/?$/, '')
      .replace(/\/+$/, '');
    baseUrlRef.current = base;
    stateUrlRef.current = base + '/state';
  }, []);

  // Serialized autosave: one PUT in flight, latest content coalesced.
  const save = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      for (;;) {
        const content = latest.current;
        setSaveState('saving');
        let ok = false;
        try {
          const res = await fetch(stateUrlRef.current, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ ...initial, slides: serializeSlides(content) }),
          });
          ok = res.ok;
        } catch {
          ok = false;
        }
        if (!ok) {
          setSaveState('error');
          break;
        }
        if (latest.current !== content) continue;
        setSaveState('saved');
        break;
      }
    } finally {
      inFlight.current = false;
    }
  }, [initial]);

  const commit = useCallback(
    (next: Slide[]) => {
      setSlides(next);
      latest.current = next;
      setSaveState('saving');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void save();
      }, 900);
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
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => flushRef.current(), []);

  const setField = (i: number, field: keyof Slide, value: string) =>
    commit(slides.map((sl, k) => (k === i ? { ...sl, [field]: value } : sl)));
  const addSlide = () => commit([...slides, { visual: '', text: '' }]);
  const removeSlide = (i: number) => commit(slides.filter((_, k) => k !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= slides.length) return;
    const next = slides.slice();
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };

  const propose = async () => {
    if (busy || !hasScript) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(baseUrlRef.current + '/screen-prompt/slides', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ direction: direction.trim(), current: slides }),
      });
      const b = (await res.json().catch(() => null)) as
        | { slides?: Slide[]; note?: string; error?: string }
        | null;
      if (!res.ok || !b?.slides?.length) {
        setError(b?.error ?? 'Could not plan the slides.');
        return;
      }
      commit(b.slides);
      setNote(b.note ?? null);
      setDirection('');
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const buildDeck = async () => {
    if (building || !hasScript) return;
    setBuilding(true);
    setDeckError(null);
    flush();
    try {
      const res = await fetch(baseUrlRef.current + '/screen-prompt/deck', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ direction: direction.trim() }),
      });
      const b = (await res.json().catch(() => null)) as
        | { url?: string; states?: DeckStateInfo[]; note?: string; error?: string }
        | null;
      if (!res.ok || !b?.url) {
        setDeckError(b?.error ?? 'Could not build the deck.');
        return;
      }
      setDeckUrl(b.url);
      setBuilt(b.states ?? []);
      setSel(0);
      setPreviewV((v) => v + 1);
      setDeckNote(b.note ?? `Built the deck in ${b.states?.length ?? 0} states.`);
    } catch {
      setDeckError('Network error. Try again.');
    } finally {
      setBuilding(false);
    }
  };

  // One state, one instruction. Every other state is written back untouched.
  const reviseState = async () => {
    const instruction = tweak.trim();
    if (revising || !instruction || !built[sel]) return;
    setRevising(true);
    setDeckError(null);
    try {
      const res = await fetch(baseUrlRef.current + '/screen-prompt/deck/revise', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ index: sel, instruction }),
      });
      const b = (await res.json().catch(() => null)) as
        | { states?: DeckStateInfo[]; note?: string; error?: string }
        | null;
      if (!res.ok || !b?.states) {
        setDeckError(b?.error ?? 'Could not change that state.');
        return;
      }
      setBuilt(b.states);
      setDeckNote(b.note ?? null);
      setTweak('');
      setPreviewV((v) => v + 1);
    } catch {
      setDeckError('Network error. Try again.');
    } finally {
      setRevising(false);
    }
  };

  const removeState = async () => {
    if (revising || !built[sel]) return;
    setRevising(true);
    setDeckError(null);
    try {
      const res = await fetch(baseUrlRef.current + '/screen-prompt/deck/revise', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ index: sel }),
      });
      const b = (await res.json().catch(() => null)) as
        | { states?: DeckStateInfo[]; note?: string; error?: string }
        | null;
      if (!res.ok || !b?.states) {
        setDeckError(b?.error ?? 'Could not remove that state.');
        return;
      }
      setBuilt(b.states);
      setSel((i) => Math.max(0, Math.min(i, b.states!.length - 1)));
      setDeckNote(b.note ?? null);
      setPreviewV((v) => v + 1);
    } catch {
      setDeckError('Network error. Try again.');
    } finally {
      setRevising(false);
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
      <StageRail pieceId={initial.piece_id} current="treatment_map" />
      <header className={s.head}>
        <div className={s.headLeft}>
          <BackLink
            fallbackHref={`/console/marketing/piece/${initial.piece_id}`}
            className={s.back}
            dashboardHref={`/console/marketing/stream/${initial.stream}`}
          />
          <div className={s.titleWrap}>
            <span className={s.eyebrow}>
              {(initial.format ?? '').replace(/_/g, ' ')} · screen prompt
            </span>
            <h1 className={s.title}>{initial.title}</h1>
          </div>
        </div>
        <div className={s.headRight}>
          <Link href={`/console/marketing/piece/${initial.piece_id}`} className={s.prompterLink}>
            ← Script
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
        </div>
      </header>

      <div className={d.cols}>
        <section className={d.scriptCol}>
          <h2 className={d.colTitle}>The script</h2>
          {sections.length === 0 ? (
            <p className={d.empty}>Write the script first. The slides are planned from it.</p>
          ) : (
            sections.map((sec, i) => (
              <div key={i} className={d.section}>
                {sec.label ? <span className={d.sectionLabel}>{sec.label}</span> : null}
                <p className={d.sectionBody}>{sec.body}</p>
              </div>
            ))
          )}
        </section>

        <section className={d.slideCol}>
          <div className={d.colHead}>
            <h2 className={d.colTitle}>Slides</h2>
            <span className={d.count}>
              {slides.length}/6{slides.length > 6 ? ' (too many)' : ''}
            </span>
          </div>

          {slides.length === 0 ? (
            <p className={d.empty}>
              No slides yet. Add one, or tell April what you want below and let her
              propose the set.
            </p>
          ) : (
            slides.map((sl, i) => (
              <article key={i} className={d.card}>
                <div className={d.cardHead}>
                  <span className={d.cardNum}>Slide {i + 1}</span>
                  <div className={d.cardActions}>
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} title="Move up">
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === slides.length - 1}
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button type="button" onClick={() => removeSlide(i)} title="Delete slide">
                      ✕
                    </button>
                  </div>
                </div>
                <label className={d.field}>
                  <span>Visual</span>
                  <textarea
                    value={sl.visual}
                    onChange={(e) => setField(i, 'visual', e.target.value)}
                    onBlur={flush}
                    placeholder="e.g. Three pillars side by side"
                    rows={2}
                  />
                </label>
                <label className={d.field}>
                  <span>Text on screen</span>
                  <textarea
                    value={sl.text}
                    onChange={(e) => setField(i, 'text', e.target.value)}
                    onBlur={flush}
                    placeholder="e.g. THREE POST-AI HUMAN CLASSES (leave empty for a purely visual slide)"
                    rows={2}
                  />
                </label>
              </article>
            ))
          )}

          <button type="button" className={d.addBtn} onClick={addSlide}>
            + Add a slide
          </button>

          <div className={d.aprilBox}>
            <input
              className={d.aprilInput}
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              placeholder="Tell April what you want, e.g. open on three pillars, no text"
              aria-label="Direction for April"
              disabled={busy || !hasScript}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void propose();
                }
              }}
            />
            <button
              type="button"
              className={d.aprilBtn}
              onClick={propose}
              disabled={busy || !hasScript}
            >
              {busy ? 'Planning…' : slides.length ? 'Ask April to revise' : 'Ask April to plan'}
            </button>
          </div>
          {note ? <p className={d.note}>April: {note}</p> : null}
          {error ? <p className={d.error}>{error}</p> : null}

          <div className={d.buildRow}>
            <button
              type="button"
              className={d.buildBtn}
              onClick={buildDeck}
              disabled={building || !hasScript || slides.length === 0}
            >
              {building
                ? 'Building the deck…'
                : built.length
                  ? '▶ Rebuild the whole deck'
                  : '▶ Build the deck'}
            </button>
            {built.length ? (
              <span className={d.rebuildWarn}>
                Rebuilding re-decides every state. To change one, use the deck below.
              </span>
            ) : null}
          </div>
        </section>
      </div>

      {built.length ? (
        <section className={d.deckPanel}>
          <div className={d.colHead}>
            <h2 className={d.colTitle}>The built deck</h2>
            {deckUrl ? (
              <a href={deckUrl} target="_blank" rel="noopener noreferrer" className={d.openLink}>
                Open the deck ↗
              </a>
            ) : null}
          </div>

          <div className={d.chips}>
            {built.map((st, i) => (
              <button
                key={i}
                type="button"
                className={`${d.chip} ${i === sel ? d.chipOn : ''}`}
                onClick={() => setSel(i)}
              >
                <span className={d.chipNum}>{i + 1}</span>
                {st.label || 'state'}
              </button>
            ))}
          </div>

          <div className={d.previewWrap}>
            <iframe
              key={`${sel}-${previewV}`}
              className={d.preview}
              src={`/console/deck/${initial.piece_id}?state=${sel}&v=${previewV}`}
              title={`State ${sel + 1} preview`}
            />
          </div>

          <div className={d.aprilBox}>
            <input
              className={d.aprilInput}
              value={tweak}
              onChange={(e) => setTweak(e.target.value)}
              placeholder={`Change state ${sel + 1}, e.g. drop the other pillars' names`}
              aria-label={`What to change about state ${sel + 1}`}
              disabled={revising}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void reviseState();
                }
              }}
            />
            <button
              type="button"
              className={d.aprilBtn}
              onClick={reviseState}
              disabled={revising || !tweak.trim()}
            >
              {revising ? 'Changing…' : 'Change this state'}
            </button>
            <button
              type="button"
              className={d.removeBtn}
              onClick={removeState}
              disabled={revising || built.length < 2}
              title="Remove this state from the deck"
            >
              Remove
            </button>
          </div>
          <p className={d.hint}>
            Only this state changes. The rest of the deck is left exactly as it is.
          </p>
          {deckNote ? <p className={d.note}>April: {deckNote}</p> : null}
          {deckError ? <p className={d.error}>{deckError}</p> : null}
        </section>
      ) : deckNote || deckError ? (
        <section className={d.deckPanel}>
          {deckNote ? <p className={d.note}>April: {deckNote}</p> : null}
          {deckError ? <p className={d.error}>{deckError}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
