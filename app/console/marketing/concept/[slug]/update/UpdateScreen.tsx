'use client';

/**
 * The Update-concept chat (D25 living concepts). April opens with "what's
 * changed?", the owner talks it through, and Apply has April restructure the
 * WHOLE concept doc to weave the new thinking in (saved in place, same slug).
 * Reuses the intake screen's chat styles; draft persists per owner+concept so an
 * in-progress update survives a reload.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import s from '../../../intake/intake.module.css';
import { BackLink } from '@/app/console/marketing/_components/BackLink';

type Msg = { role: 'user' | 'assistant'; content: string };

const DRAFT_KEY_BASE = 'pam-update-draft-v1';

const opener = (title: string): Msg => ({
  role: 'assistant',
  content: `We're updating "${title}". What has changed, or what should this concept now include? Tell me what you've learned, what no longer holds, or the new idea to work in.`,
});

export function UpdateScreen({
  owner,
  slug,
  title,
}: {
  owner: string;
  slug: string;
  title: string;
}) {
  const router = useRouter();
  const draftKey = `${DRAFT_KEY_BASE}:${owner}:${slug}`;
  const [messages, setMessages] = useState<Msg[]>([opener(title)]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const applyingRef = useRef(false);
  const doneRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw) as { messages?: unknown };
      if (Array.isArray(d.messages) && d.messages.length > 0) {
        setMessages(d.messages as Msg[]);
      }
    } catch {
      // ignore a corrupt draft
    }
  }, [draftKey]);

  useEffect(() => {
    if (doneRef.current) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ messages }));
    } catch {
      // non-fatal
    }
  }, [draftKey, messages]);

  const busy = sending || applying;
  const canApply = messages.some((m) => m.role === 'user');

  const scrollDown = () =>
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });

  const reset = useCallback(() => {
    if (!window.confirm('Clear this update conversation?')) return;
    sendingRef.current = false;
    applyingRef.current = false;
    try {
      localStorage.removeItem(draftKey);
    } catch {
      // non-fatal
    }
    setMessages([opener(title)]);
    setInput('');
    setError(null);
    setSending(false);
    setApplying(false);
  }, [draftKey, title]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sendingRef.current || applying) return;
      sendingRef.current = true;
      setSending(true);
      setError(null);
      setInput('');
      const history = messages.slice(-24);
      setMessages((m) => [...m, { role: 'user', content: trimmed }]);
      scrollDown();
      try {
        const res = await fetch(
          window.location.pathname.replace(/\/+$/, '') + '/turn',
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ message: trimmed, history }),
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
    [messages, applying]
  );

  const apply = useCallback(async () => {
    if (!canApply || applyingRef.current || sendingRef.current) return;
    applyingRef.current = true;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(
        window.location.pathname.replace(/\/+$/, '') + '/apply',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ transcript: messages }),
        }
      );
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(b?.error ?? 'Could not update the concept.');
        applyingRef.current = false;
        setApplying(false);
        return;
      }
      doneRef.current = true;
      try {
        localStorage.removeItem(draftKey);
      } catch {
        // non-fatal
      }
      router.push(`/console/marketing/concept/${slug}`);
    } catch {
      setError('Network error while updating the concept.');
      applyingRef.current = false;
      setApplying(false);
    }
  }, [canApply, messages, router, slug, draftKey]);

  return (
    <div className={s.root}>
      <header className={s.head}>
        <div className={s.headTop}>
          <BackLink
            fallbackHref={`/console/marketing/concept/${slug}`}
            className={s.back}
          />
          <button type="button" className={s.resetBtn} onClick={reset}>
            ↺ Start over
          </button>
        </div>
        <span className={s.eyebrow}>update · core concept</span>
        <h1 className={s.title}>{title}</h1>
        <p className={s.lede}>
          Tell April what has changed. She restructures the concept doc so the new
          thinking is woven in, and it stays in its evolved state.
        </p>
      </header>

      <div className={s.transcript} ref={scrollRef}>
        {messages.map((m, i) => (
          <div
            key={i}
            className={`${s.msg} ${m.role === 'user' ? s.user : s.assistant}`}
          >
            {m.content}
          </div>
        ))}
        {sending ? (
          <div className={`${s.msg} ${s.assistant} ${s.thinking}`}>April is thinking…</div>
        ) : null}
        {applying ? (
          <div className={`${s.msg} ${s.assistant} ${s.thinking}`}>
            April is restructuring the concept doc…
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
          placeholder="tell April what changed…"
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
          onClick={apply}
          disabled={!canApply || busy}
          title={
            canApply
              ? 'Restructure the concept doc with these changes'
              : 'Tell April at least one change first'
          }
        >
          {applying ? 'Updating…' : 'Update concept doc'}
        </button>
        <span className={s.finalizeHint}>
          Rewrites the doc in place. No versions; the concept simply evolves.
        </span>
      </div>
    </div>
  );
}
