'use client';

/**
 * Intake screen (T5). April interviews the owner through the console's own chat
 * (D16 — in-console, not Slack), then the interview is finalized into a concept
 * doc (core-concept-{framing}.md) via the async socket. On success we route to
 * the concept view. Backed today by the interim OpenRouter stand-in; the real
 * April swaps in behind the same routes with no change here.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import s from './intake.module.css';
import { STREAMS, isStreamId, type StreamId } from '@/lib/marketing/streams';

type Msg = { role: 'user' | 'assistant'; content: string };

// Draft persistence so an in-progress interview survives a reload/navigation
// before it is finalized (the concept doc is only written at finalize). The key
// is OWNER-SCOPED so one team member's draft never rehydrates into another's
// screen on a shared browser profile.
const DRAFT_KEY_BASE = 'pam-intake-draft-v1';

const OPENER: Msg = {
  role: 'assistant',
  content:
    "I'm April. Let's find the one sharp idea worth making. In a sentence, what is the thing you believe about your work that most people get wrong?",
};

export function IntakeScreen({
  owner,
  initialStream,
}: {
  owner: string;
  initialStream: StreamId;
}) {
  const router = useRouter();
  const draftKey = `${DRAFT_KEY_BASE}:${owner}`;
  const [framing, setFraming] = useState('');
  const [stream, setStream] = useState<StreamId>(initialStream);
  const [messages, setMessages] = useState<Msg[]>([OPENER]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const finalizingRef = useRef(false);
  const doneRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Rehydrate a saved draft on mount (client-only).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw) as {
        framing?: unknown;
        stream?: unknown;
        messages?: unknown;
      };
      if (typeof d.framing === 'string') setFraming(d.framing);
      if (isStreamId(d.stream)) {
        setStream(d.stream);
      }
      if (Array.isArray(d.messages) && d.messages.length > 0) {
        setMessages(d.messages as Msg[]);
      }
    } catch {
      // ignore a corrupt draft
    }
  }, [draftKey]);

  // Persist the draft on change (until finalized, when we clear it).
  useEffect(() => {
    if (doneRef.current) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ framing, stream, messages }));
    } catch {
      // storage unavailable / quota — non-fatal
    }
  }, [draftKey, framing, stream, messages]);

  const busy = sending || finalizing;
  // Enough to write a concept: a framing plus at least one real exchange (the
  // owner has answered at least once beyond the opener).
  const canFinalize =
    framing.trim().length > 0 && messages.some((m) => m.role === 'user');

  const scrollDown = () =>
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sendingRef.current || finalizing) return;
      sendingRef.current = true;
      setSending(true);
      setError(null);
      setInput('');
      const history = messages.slice(-24);
      setMessages((m) => [...m, { role: 'user', content: trimmed }]);
      scrollDown();
      try {
        const res = await fetch(
          window.location.pathname.replace(/\/+$/, '') + '/interview',
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ framing, message: trimmed, history }),
          }
        );
        if (!res.ok) {
          const b = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(b?.error ?? 'Something went wrong. Try again.');
          return;
        }
        const data = (await res.json()) as { reply: string };
        setMessages((m) => [...m, { role: 'assistant', content: data.reply }]);
      } catch {
        setError('Network error. Try again.');
      } finally {
        sendingRef.current = false;
        setSending(false);
        scrollDown();
      }
    },
    [messages, framing, finalizing]
  );

  const finalize = useCallback(async () => {
    // Synchronous re-entry guard: the button's disabled state lags a render, so
    // two fast clicks could otherwise fire two finalize jobs.
    if (!canFinalize || finalizingRef.current || sendingRef.current) return;
    finalizingRef.current = true;
    setFinalizing(true);
    setError(null);
    const stop = () => {
      finalizingRef.current = false;
      setFinalizing(false);
    };
    try {
      const base = window.location.pathname.replace(/\/+$/, '');
      const res = await fetch(base + '/finalize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ framing: framing.trim(), stream, transcript: messages }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(b?.error ?? 'Could not start the concept doc.');
        stop();
        return;
      }
      const { jobId } = (await res.json()) as { jobId: string };

      // Poll until the job resolves. Interim finishes immediately; a real worker
      // may take longer, so allow a generous window.
      for (let i = 0; i < 150; i++) {
        const jr = await fetch(`${base}/job/${jobId}`, { cache: 'no-store' });
        if (jr.ok) {
          const j = (await jr.json()) as {
            status: string;
            conceptSlug: string | null;
            error: string | null;
          };
          if (j.status === 'done' && j.conceptSlug) {
            // Clear the draft and suppress further autosave before navigating.
            doneRef.current = true;
            try {
              localStorage.removeItem(draftKey);
            } catch {
              // non-fatal
            }
            router.push(`/console/marketing/concept/${j.conceptSlug}`);
            return;
          }
          if (j.status === 'failed') {
            setError(j.error ?? 'The concept doc could not be written.');
            stop();
            return;
          }
        }
        await new Promise((r) => setTimeout(r, 1200));
      }
      setError('The concept doc is taking longer than expected. Try again shortly.');
      stop();
    } catch {
      setError('Network error while writing the concept doc.');
      stop();
    }
  }, [canFinalize, framing, stream, messages, router, draftKey]);

  return (
    <div className={s.root}>
      <header className={s.head}>
        <Link href="/console/marketing" className={s.back}>
          ← Marketing
        </Link>
        <span className={s.eyebrow}>intake · new concept</span>
        <h1 className={s.title}>Interview with April</h1>
        <p className={s.lede}>
          April draws the concept out of you, then writes the concept doc the rest
          of the pipeline drafts from.
        </p>
      </header>

      <div className={s.meta}>
        <label className={s.field}>
          <span className={s.fieldLabel}>Working framing</span>
          <input
            className={s.framingInput}
            value={framing}
            onChange={(e) => setFraming(e.target.value)}
            placeholder="e.g. strip the AI out first"
            disabled={finalizing}
            aria-label="Working framing"
            autoCapitalize="sentences"
            enterKeyHint="done"
          />
        </label>
        <label className={s.field}>
          <span className={s.fieldLabel}>Stream</span>
          <select
            className={s.streamSelect}
            value={stream}
            onChange={(e) => setStream(e.target.value as StreamId)}
            disabled={finalizing}
            aria-label="Stream"
          >
            {STREAMS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={s.transcript} ref={scrollRef}>
        {messages.map((m, i) => (
          <div
            key={i}
            className={`${s.msg} ${m.role === 'user' ? s.user : s.assistant}`}
          >
            {m.content}
          </div>
        ))}
        {sending ? <div className={`${s.msg} ${s.assistant} ${s.thinking}`}>April is thinking…</div> : null}
        {finalizing ? (
          <div className={`${s.msg} ${s.assistant} ${s.thinking}`}>
            April is writing the concept doc…
          </div>
        ) : null}
      </div>

      {error ? <p className={s.error}>{error}</p> : null}

      <form
        className={s.composer}
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          className={s.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="answer April…"
          aria-label="Answer"
          disabled={busy}
          autoCapitalize="sentences"
          autoCorrect="on"
          enterKeyHint="send"
        />
        <button className={s.send} type="submit" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>

      <div className={s.finalizeRow}>
        <button
          type="button"
          className={s.finalize}
          onClick={finalize}
          disabled={!canFinalize || busy}
          title={
            canFinalize
              ? 'Write the concept doc from this interview'
              : 'Add a working framing and answer at least once first'
          }
        >
          {finalizing ? 'Writing…' : 'Create concept doc'}
        </button>
        <span className={s.finalizeHint}>
          Writes core-concept-{framing.trim() ? framingPreview(framing) : '…'}.md to your concept bank.
        </span>
      </div>
    </div>
  );
}

/** Client-side preview of the slug so the hint matches what will be written. */
function framingPreview(framing: string): string {
  return framing
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
