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

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BackLink } from '@/app/console/marketing/_components/BackLink';
import type { MarketingPiece } from '@/lib/marketing/piece-store';
import s from './text.module.css';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function channelLabel(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

export function TextOutputScreen({ initial }: { initial: MarketingPiece }) {
  const router = useRouter();
  const [body, setBody] = useState(initial.body ?? '');
  const [status, setStatus] = useState(initial.status ?? 'draft');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [drafting, setDrafting] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const channelCount = initial.platforms?.length ?? 0;

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestBody = useRef(initial.body ?? '');
  const latestStatus = useRef(initial.status ?? 'draft');
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
        if (latestBody.current !== contentBody || latestStatus.current !== contentStatus) {
          continue; // a newer edit landed mid-flight
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
  };

  const setStatusNow = (next: string) => {
    setStatus(next);
    latestStatus.current = next;
    flush();
  };

  const draft = async () => {
    if (drafting) return;
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
      setBody(drafted);
      latestBody.current = drafted;
      flush();
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
          <BackLink fallbackHref="/console/marketing" className={s.back} />
          <div className={s.titleWrap}>
            <span className={s.eyebrow}>
              {(initial.format ?? '').replace(/_/g, ' ')} · post
            </span>
            <h1 className={s.title}>{initial.title}</h1>
          </div>
        </div>
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

      <div className={s.toolbar}>
        <button type="button" className={s.draftBtn} onClick={draft} disabled={drafting}>
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

      <textarea
        className={s.body}
        value={body}
        placeholder="Draft from the concept, or write the post here. Edits autosave."
        onChange={(e) => onEditBody(e.target.value)}
        onBlur={flush}
        aria-label="Post copy"
      />
      <p className={s.hint}>
        {error ? (
          <span className={s.error}>{error}</span>
        ) : (
          'Copy the post to publish it for now. Scheduling to your channels arrives with the publish step.'
        )}
      </p>
    </div>
  );
}
