'use client';

/**
 * Context chat, shared by the Script screen (video) and the Text screen (posts).
 * Interface-driving: a command here ("tighten this line", "three sharper hooks",
 * "cut the intro") rewrites the content in place. The panel POSTs the CURRENT
 * content + the command to ./chat, shows the assistant's note, and when revised
 * content comes back it hands it to the parent via onApply, which updates the
 * editor and autosaves (the single validated write path).
 */

import { useCallback, useRef, useState } from 'react';
import s from './chat.module.css';

type Msg = { role: 'user' | 'assistant'; content: string };

const QUICK_ACTIONS = [
  'Tighten every line',
  'Give me three sharper hooks',
  'Cut the intro, start on the hook',
  'Make it punchier',
] as const;

export function ChatPanel({
  content,
  kind = 'script',
  format,
  title,
  conceptBody,
  onApply,
  onBusyChange,
  disabled = false,
}: {
  content: string;
  /** 'script' (video) or 'body' (post) — picks the editing prompt + the noun. */
  kind?: 'script' | 'body';
  format?: string;
  title?: string;
  /** The source concept doc, if this piece was developed from one — lets April
   *  draft/refine grounded in the full concept, not just what is on screen. */
  conceptBody?: string;
  onApply: (next: string) => void;
  /** Notifies the parent when a command is in flight, so it can lock the editor. */
  onBusyChange?: (busy: boolean) => void;
  /** Locked from outside (e.g. a redraft is in flight): a chat command here would
   *  race that through the shared onApply and clobber it, so block sending. */
  disabled?: boolean;
}) {
  const noun = kind === 'body' ? 'post' : 'script';
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  // Synchronous guard: the `sending` state lags one render, so two submits fired
  // before re-render (double Enter, or Enter + a chip click) would both pass a
  // state-based check and fire two concurrent requests. A ref is set/checked in
  // the same tick, so only the first submit proceeds.
  const sendingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Always read the latest content at send time via a ref, so a command acts on
  // whatever is in the editor right now (including untyped-then-typed edits).
  const contentRef = useRef(content);
  contentRef.current = content;

  const send = useCallback(
    async (instruction: string) => {
      const trimmed = instruction.trim();
      if (!trimmed || sendingRef.current || disabled) return;
      sendingRef.current = true;
      setSending(true);
      onBusyChange?.(true);
      setInput('');
      const history = messages.slice(-8);
      setMessages((m) => [...m, { role: 'user', content: trimmed }]);

      try {
        const url = window.location.pathname.replace(/\/+$/, '') + '/chat';
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            instruction: trimmed,
            content: contentRef.current,
            kind,
            format,
            title,
            concept: conceptBody,
            history,
          }),
        });
        if (!res.ok) {
          const b = (await res.json().catch(() => null)) as { error?: string } | null;
          setMessages((m) => [
            ...m,
            {
              role: 'assistant',
              content: b?.error ?? 'Something went wrong. Try again.',
            },
          ]);
          return;
        }
        const data = (await res.json()) as { message: string; content: string | null };
        setMessages((m) => [...m, { role: 'assistant', content: data.message }]);
        if (data.content !== null && data.content !== contentRef.current) {
          onApply(data.content);
        }
      } catch {
        setMessages((m) => [
          ...m,
          { role: 'assistant', content: 'Network error. Try again.' },
        ]);
      } finally {
        sendingRef.current = false;
        setSending(false);
        onBusyChange?.(false);
        // Scroll the transcript to the newest message.
        requestAnimationFrame(() => {
          const el = scrollRef.current;
          if (el) el.scrollTop = el.scrollHeight;
        });
      }
    },
    [messages, sending, kind, format, title, conceptBody, onApply, onBusyChange, disabled]
  );

  // When the piece has a source concept, offer the draft-from-concept action first.
  const quickActions = conceptBody
    ? [`Write the full ${noun} from the concept`, ...QUICK_ACTIONS]
    : QUICK_ACTIONS;

  return (
    <aside className={s.panel} aria-label={`${noun} chat`}>
      <div className={s.head}>
        <span className={s.eyebrow}>context chat</span>
        <p className={s.blurb}>
          {conceptBody
            ? `April has the concept. Ask her to draft the ${noun}, or change it in place.`
            : `Tell it what to change. It edits the ${noun} in place.`}
        </p>
      </div>

      <div className={s.transcript} ref={scrollRef}>
        {messages.length === 0 ? (
          <div className={s.empty}>
            <p>Try a command, or start typing your own.</p>
            <div className={s.quick}>
              {quickActions.map((q) => (
                <button
                  key={q}
                  type="button"
                  className={s.chip}
                  disabled={sending || disabled}
                  onClick={() => void send(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`${s.msg} ${m.role === 'user' ? s.user : s.assistant}`}
            >
              {m.content}
            </div>
          ))
        )}
        {sending ? <div className={`${s.msg} ${s.assistant} ${s.thinking}`}>Working…</div> : null}
      </div>

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
          placeholder="tighten this line, cut the intro, sharper hook…"
          aria-label="Chat command"
          disabled={sending || disabled}
        />
        <button
          className={s.send}
          type="submit"
          disabled={sending || disabled || !input.trim()}
        >
          Send
        </button>
      </form>
    </aside>
  );
}
