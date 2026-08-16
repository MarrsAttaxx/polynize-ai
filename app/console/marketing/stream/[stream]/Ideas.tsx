'use client';

/**
 * IDEAS. The rough notes that come before a concept.
 *
 * Marrs: "I take a lot of notes on my phone where I just type around the core concept before I
 * actually create the core concept... It's basically a text box that I can write in, and then
 * there's a button that says 'Create Core Concept'."
 *
 * So it is a text box and a button, and nothing else. Every field this does not have is
 * deliberate: the moment a note needs a title or a category it stops being faster than the
 * notes app, and the notes go back to the phone.
 *
 * COLLAPSED BY DEFAULT, because half-formed thinking should not be the loudest thing on the
 * stream page. The count on the header is enough to remember it is there.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Idea } from '@/lib/marketing/idea-store';
import s from './ideas.module.css';

export function Ideas({ stream, initial }: { stream: string; initial: Idea[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(initial.length > 0);
  const [ideas, setIdeas] = useState<Idea[]>(initial);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/console/marketing/stream/${stream}/ideas`, { method: 'POST' });
      const b = (await res.json().catch(() => null)) as { idea?: Idea; error?: string } | null;
      if (!res.ok || !b?.idea) {
        window.alert(b?.error ?? 'Could not start a note.');
        return;
      }
      setIdeas((prev) => [b.idea as Idea, ...prev]);
      setOpen(true);
    } catch {
      window.alert('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const drop = (id: string) => setIdeas((prev) => prev.filter((i) => i.id !== id));

  return (
    <section className={s.wrap}>
      <div className={s.head}>
        <button
          type="button"
          className={s.toggle}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? '▾' : '▸'} Ideas
        </button>
        <span className={s.count}>{ideas.length}</span>
        <button type="button" className={s.add} onClick={() => void add()} disabled={busy}>
          {busy ? 'Adding…' : '+ New note'}
        </button>
      </div>

      {open ? (
        ideas.length === 0 ? (
          <p className={s.empty}>
            Somewhere to think out loud before a concept exists. Write badly, come back later,
            and turn it into a concept when it is ready.
          </p>
        ) : (
          <div className={s.cards}>
            {ideas.map((idea) => (
              <IdeaCard
                key={idea.id}
                stream={stream}
                idea={idea}
                onDeleted={() => {
                  drop(idea.id);
                  router.refresh();
                }}
              />
            ))}
          </div>
        )
      ) : null}
    </section>
  );
}

type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

function IdeaCard({
  stream,
  idea,
  onDeleted,
}: {
  stream: string;
  idea: Idea;
  onDeleted: () => void;
}) {
  const [text, setText] = useState(idea.text);
  const [state, setState] = useState<SaveState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<string | null>(null);

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const body = pending.current;
    pending.current = null;
    if (body === null) return;
    setState('saving');
    try {
      const res = await fetch(`/console/marketing/stream/${stream}/ideas`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: idea.id, text: body }),
      });
      setState(res.ok ? 'saved' : 'failed');
    } catch {
      setState('failed');
    }
  }, [idea.id, stream]);

  // Anything typed and not yet sent goes on unmount, so navigating away mid-thought does not
  // throw it away. This is a notes app; losing a note is the one unforgivable bug.
  useEffect(() => () => void flush(), [flush]);

  const onChange = (v: string) => {
    setText(v);
    pending.current = v;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 700);
  };

  const remove = async () => {
    if (!window.confirm('Delete this note?')) return;
    try {
      const res = await fetch(`/console/marketing/stream/${stream}/ideas`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: idea.id }),
      });
      if (!res.ok) {
        window.alert('Could not delete that.');
        return;
      }
      onDeleted();
    } catch {
      window.alert('Network error. Try again.');
    }
  };

  const empty = text.trim() === '';

  return (
    <article className={s.card}>
      <textarea
        className={s.text}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => void flush()}
        placeholder="What are you circling around?"
        aria-label="Idea"
      />
      <div className={s.foot}>
        {/* Carries the idea INTO the interview rather than copying it out. April opens with the
            note already in the box, so the thinking is not retyped. */}
        <Link
          className={empty ? s.createOff : s.create}
          href={`/console/marketing/intake?stream=${stream}&idea=${idea.id}`}
          aria-disabled={empty}
          onClick={(e) => {
            if (empty) e.preventDefault();
          }}
          title={empty ? 'Write something first' : 'Take this into the concept interview'}
        >
          Create core concept →
        </Link>
        <span className={`${s.state} ${state === 'saved' ? s.saved : ''} ${state === 'failed' ? s.failed : ''}`}>
          {state === 'saving' ? 'saving…' : state === 'saved' ? 'saved' : state === 'failed' ? 'not saved' : ''}
        </span>
        <button type="button" className={s.del} onClick={() => void remove()}>
          delete
        </button>
      </div>
    </article>
  );
}
