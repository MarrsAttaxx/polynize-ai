'use client';

/**
 * The SCREEN PROMPT stage (D29 amended): the PRE-RECORD plan for what the 32in
 * touchscreen does. It prompts twice over, which is where the name comes from: its
 * cues prompt the presenter's gestures during the take, and it is the build brief the
 * animator codes the HTML page from.
 *
 * It starts BLANK and is generated ON DEMAND from the LOCKED SCRIPT plus the
 * operator's direction, because the screen design is a creative decision the operator
 * owns: auto-generating it with the script produced briefs that were generic and only
 * loosely tied to the words. Talk to April on the right ("three pillars, pixelated, no
 * text on the opening, a risk meter in the header"), hit Generate, and the brief is
 * built from the script and that direction. Regenerate refines rather than restarts,
 * since the current brief and the earlier turns are sent along.
 *
 * Stored on `piece.treatment` (the code identifier keeps its original name so pieces
 * drafted before the rename are not orphaned). Autosave mirrors the Script screen:
 * debounced, flushed on blur and unmount, and serialized so a slow write can never
 * overwrite a newer edit.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { MarketingPiece } from '@/lib/marketing/piece-store';
import { StageRail } from '../StageRail';
import { BackLink } from '@/app/console/marketing/_components/BackLink';
import s from '../script.module.css';
import c from '../chat.module.css';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type Turn = { role: 'user' | 'assistant'; content: string };

const IDEAS = [
  'Keep the opening purely visual, no text',
  'Use a recurring risk meter in the header',
  'Build one object across the whole piece',
];

export function ScreenPromptScreen({ initial }: { initial: MarketingPiece }) {
  const [prompt, setPrompt] = useState(initial.treatment ?? '');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [direction, setDirection] = useState('');
  const [history, setHistory] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(initial.treatment ?? '');
  const inFlight = useRef(false);
  const hasScript = Boolean((initial.script ?? '').trim());

  const stateUrlRef = useRef('');
  const baseUrlRef = useRef('');
  useEffect(() => {
    const base = window.location.pathname
      .replace(/\/screen-prompt\/?$/, '')
      .replace(/\/+$/, '');
    baseUrlRef.current = base;
    stateUrlRef.current = base + '/state';
  }, []);

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
            body: JSON.stringify({ ...initial, treatment: content }),
          });
          ok = res.ok;
        } catch {
          ok = false;
        }
        if (!ok) {
          setSaveState('error');
          break;
        }
        if (latest.current !== content) continue; // newer edit landed mid-flight
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

  const onEdit = (next: string) => {
    setPrompt(next);
    latest.current = next;
    scheduleSave();
  };

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

  const generate = async () => {
    if (busy || !hasScript) return;
    setBusy(true);
    setError(null);
    const said = direction.trim();
    try {
      const res = await fetch(baseUrlRef.current + '/screen-prompt/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ direction: said, history }),
      });
      const b = (await res.json().catch(() => null)) as
        | { screenPrompt?: string; error?: string }
        | null;
      if (!res.ok || !b?.screenPrompt) {
        setError(b?.error ?? 'Could not generate the screen prompt.');
        return;
      }
      setPrompt(b.screenPrompt);
      latest.current = b.screenPrompt;
      // Keep the exchange so a follow-up refines instead of starting over.
      setHistory((h) => [
        ...h,
        { role: 'user', content: said || '(no direction given)' },
        { role: 'assistant', content: b.screenPrompt as string },
      ]);
      setDirection('');
      flush();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked; the textarea is selectable */
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
          <Link
            href={`/console/marketing/piece/${initial.piece_id}`}
            className={s.prompterLink}
          >
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

      <div className={c.workspace}>
        <div className={s.editorCol}>
          <div className={s.toolbar}>
            <button
              type="button"
              className={s.draftBtn}
              onClick={generate}
              disabled={busy || !hasScript}
            >
              {busy
                ? 'Generating…'
                : prompt.trim()
                  ? 'Regenerate from script'
                  : 'Generate from script'}
            </button>
            <button
              type="button"
              className={s.undoBtn}
              onClick={copy}
              disabled={!prompt.trim()}
            >
              {copied ? 'Copied ✓' : 'Copy for the animator'}
            </button>
            {error ? <span className={s.draftError}>{error}</span> : null}
          </div>

          <textarea
            className={s.script}
            value={prompt}
            spellCheck={false}
            disabled={busy}
            onChange={(e) => onEdit(e.target.value)}
            onBlur={flush}
            placeholder={
              hasScript
                ? 'Empty until you generate it.\n\nTell April on the right what you want the screen to do, then hit Generate from script. You get a build brief for the animator (design system, safe area, and one state per beat with composition, type, colour, material, motion, gesture and your operator cue) which you can then edit here.'
                : 'Write the script first. The screen prompt is built from it, beat by beat.'
            }
            aria-label="Screen prompt"
          />
          <p className={s.hint}>
            The build brief your animator codes the touchscreen page from, and the
            gesture cues that prompt you through the take. It has to exist before you
            record, because you touch the screen live on camera. Edits autosave.
          </p>
        </div>

        <aside className={c.panel} aria-label="Screen direction">
          <div className={c.head}>
            <span className={c.eyebrow}>screen direction</span>
            <p className={c.blurb}>
              Describe what you want on screen, in your own words. April builds the
              brief from your direction plus the script. Regenerating keeps the
              conversation, so you can refine it a step at a time.
            </p>
          </div>

          <div className={c.transcript}>
            {history.length === 0 ? (
              <div className={c.empty}>
                <p>
                  For example: three pillars, pixelated, no text at the open. Tap one
                  and it sharpens and moves to centre. A risk meter in the header.
                </p>
                <div className={c.quick}>
                  {IDEAS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      className={c.chip}
                      disabled={busy}
                      onClick={() => setDirection((d) => (d ? `${d}. ${q}` : q))}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              history
                .filter((h) => h.role === 'user')
                .map((h, i) => (
                  <div key={i} className={`${c.msg} ${c.user}`}>
                    {h.content}
                  </div>
                ))
            )}
            {busy ? (
              <div className={`${c.msg} ${c.assistant} ${c.thinking}`}>
                Designing the screen…
              </div>
            ) : null}
          </div>

          <form
            className={c.composer}
            onSubmit={(e) => {
              e.preventDefault();
              void generate();
            }}
          >
            <input
              className={c.input}
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              placeholder="what should the screen do?"
              aria-label="Screen direction"
              disabled={busy || !hasScript}
            />
            <button
              className={c.send}
              type="submit"
              disabled={busy || !hasScript}
              title={hasScript ? undefined : 'Write the script first'}
            >
              {prompt.trim() ? 'Redo' : 'Build'}
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
