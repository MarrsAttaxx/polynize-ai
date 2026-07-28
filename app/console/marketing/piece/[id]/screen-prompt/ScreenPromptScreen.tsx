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

export function ScreenPromptScreen({ initial }: { initial: MarketingPiece }) {
  const [slides, setSlides] = useState<Slide[]>(() => parseSlides(initial.slides));
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [direction, setDirection] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deckUrl, setDeckUrl] = useState<string | null>(null);

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
    setError(null);
    flush();
    try {
      const res = await fetch(baseUrlRef.current + '/screen-prompt/deck', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ direction: direction.trim() }),
      });
      const b = (await res.json().catch(() => null)) as
        | { url?: string; states?: number; note?: string; error?: string }
        | null;
      if (!res.ok || !b?.url) {
        setError(b?.error ?? 'Could not build the deck.');
        return;
      }
      setDeckUrl(b.url);
      setNote(b.note ?? `Built the deck in ${b.states ?? 0} states.`);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBuilding(false);
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
              {building ? 'Building the deck…' : '▶ Build the deck'}
            </button>
            {deckUrl ? (
              <a href={deckUrl} target="_blank" rel="noopener noreferrer" className={d.openLink}>
                Open deck ↗
              </a>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
