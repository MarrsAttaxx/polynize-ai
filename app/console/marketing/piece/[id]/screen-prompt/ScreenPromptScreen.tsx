'use client';

/**
 * The SCREEN PROMPT stage (D29 amended): the PRE-RECORD plan for what the 32in
 * touchscreen does. It prompts twice over, which is where the name comes from: it
 * cues the presenter's gestures during the take, and it is the build brief the
 * animator codes the HTML page from. Deliberately a SEPARATE artifact from the
 * script: the script is read straight off the teleprompter and must stay
 * spoken-only, while this must exist BEFORE the shoot because the screen is touched
 * live on camera (a prop, not post-production).
 *
 * Stored on `piece.treatment` — the code identifier keeps the original name so
 * already-drafted pieces are not orphaned (same display-only rename pattern as D26's
 * series/templates).
 *
 * Autosave mirrors the Script screen: debounced (1s) + flushed on blur + flushed on
 * unmount, and SERIALIZED (one PUT in flight, latest content coalesced) so a slow
 * write can never overwrite a newer edit. The whole piece is PUT each time, through
 * the same validated /state route.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { MarketingPiece } from '@/lib/marketing/piece-store';
import { StageRail } from '../StageRail';
import { BackLink } from '@/app/console/marketing/_components/BackLink';
import s from '../script.module.css';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function ScreenPromptScreen({ initial }: { initial: MarketingPiece }) {
  const [treatment, setTreatment] = useState(initial.treatment ?? '');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [copied, setCopied] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(initial.treatment ?? '');
  const inFlight = useRef(false);

  // Snapshot the state URL at mount: on the unmount flush the router has already
  // changed the pathname, so deriving it then would PUT to the wrong route.
  const stateUrlRef = useRef('');
  useEffect(() => {
    stateUrlRef.current =
      window.location.pathname.replace(/\/screen-prompt\/?$/, '').replace(/\/+$/, '') +
      '/state';
  }, []);

  const save = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const url = stateUrlRef.current;
    try {
      for (;;) {
        const content = latest.current;
        setSaveState('saving');
        let ok = false;
        try {
          const res = await fetch(url, {
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

  const onEdit = (next: string) => {
    setTreatment(next);
    latest.current = next;
    setSaveState('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void save();
    }, 1000);
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

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(treatment);
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

      <div className={s.editorCol}>
        <div className={s.toolbar}>
          <button
            type="button"
            className={s.draftBtn}
            onClick={copy}
            disabled={!treatment.trim()}
          >
            {copied ? 'Copied ✓' : 'Copy for the animation build'}
          </button>
        </div>
        <textarea
          className={s.script}
          value={treatment}
          spellCheck={false}
          onChange={(e) => onEdit(e.target.value)}
          onBlur={flush}
          placeholder={
            'Generated with the script when you draft it, and editable here.\n\nBUILD BRIEF / DESIGN SYSTEM / OPERATOR STRIP, then one state per beat:\n\nHOOK\n- COMPOSITION: what is on screen and where\n- TYPE: the exact words\n- COLOUR: which brand colour, doing what\n- MATERIAL: raised card, recessed well, emphasised\n- MOTION: how it enters and resolves\n- GESTURE: the touch you perform\n- CUE: your faint on-screen reminder'
          }
          aria-label="Screen prompt"
        />
        <p className={s.hint}>
          The build brief your animator codes the touchscreen page from, and the
          gesture cues that prompt you through the take. It has to exist before you
          record, because you touch the screen live on camera. It shares the
          script&rsquo;s beat labels, so keep them matching. Edits autosave. Redrafting
          the script regenerates this too.
        </p>
      </div>
    </div>
  );
}
