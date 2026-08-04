'use client';

/**
 * The concept's name, edited in place.
 *
 * Marrs needs this because generated concept names do not come out right and a concept is
 * the thing everything else hangs off: if it is called the wrong thing, the whole stream
 * becomes unreadable. It renames the CONCEPT and nothing else, which matters because the
 * in-development card, the hub, and the pieces beneath it are three different things that
 * were previously sharing one label by accident.
 *
 * The slug never moves, so nothing keyed to it (piece refs, dev groups, prezies) breaks.
 */

import { useRef, useState } from 'react';

type Save = 'idle' | 'saving' | 'saved' | 'error';

export function ConceptTitle({
  slug,
  initial,
  className,
}: {
  slug: string;
  initial: string;
  className?: string;
}) {
  const [title, setTitle] = useState(initial);
  const [state, setState] = useState<Save>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(initial);

  const save = async () => {
    const next = latest.current.trim();
    // Nothing to do for a no-op or an empty box: an empty name is worse than the old one.
    if (!next || next === initial) return;
    setState('saving');
    try {
      const res = await fetch(`/console/marketing/concept/${slug}/rename`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: next }),
      });
      setState(res.ok ? 'saved' : 'error');
    } catch {
      setState('error');
    }
  };

  return (
    <span className={className} style={{ display: 'block', position: 'relative' }}>
      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          latest.current = e.target.value;
          setState('saving');
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            timer.current = null;
            void save();
          }, 900);
        }}
        onBlur={() => {
          if (timer.current) {
            clearTimeout(timer.current);
            timer.current = null;
            void save();
          }
        }}
        aria-label="Concept name"
        spellCheck={false}
        style={{
          font: 'inherit',
          color: 'inherit',
          letterSpacing: 'inherit',
          lineHeight: 'inherit',
          width: '100%',
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid transparent',
          padding: '0 0 2px',
          margin: 0,
          outline: 'none',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderBottomColor = 'var(--mint)';
        }}
        onMouseEnter={(e) => {
          if (document.activeElement !== e.currentTarget) {
            e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.14)';
          }
        }}
        onMouseLeave={(e) => {
          if (document.activeElement !== e.currentTarget) {
            e.currentTarget.style.borderBottomColor = 'transparent';
          }
        }}
      />
      {state === 'error' ? (
        <span
          style={{
            position: 'absolute',
            right: 0,
            bottom: -18,
            fontSize: 12,
            color: 'var(--coral)',
          }}
        >
          Rename failed
        </span>
      ) : null}
    </span>
  );
}
