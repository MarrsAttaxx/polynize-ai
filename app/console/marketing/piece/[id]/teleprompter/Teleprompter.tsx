'use client';

/**
 * Teleprompter (T3). Full-screen, chrome-less, one section at a time. Advance
 * section-by-section (not scrolling) so the talent can do several takes of a
 * section then move on. Driven by:
 *   - a remote / clicker or keyboard: → · ↓ · space · PageDown = next; ← · ↑ ·
 *     PageUp = prev (a Bluetooth presenter sends these keys);
 *   - tap zones: right half = next, left half = prev (iPad touch).
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import t from './teleprompter.module.css';

const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Spacebar']);
const PREV_KEYS = new Set(['ArrowLeft', 'ArrowUp', 'PageUp']);

export function Teleprompter({
  title,
  sections,
  backHref,
}: {
  title: string;
  sections: string[];
  backHref: string;
}) {
  const total = sections.length;
  const [i, setI] = useState(0);

  const next = useCallback(() => setI((n) => Math.min(n + 1, total - 1)), [total]);
  const prev = useCallback(() => setI((n) => Math.max(n - 1, 0)), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (NEXT_KEYS.has(e.key)) {
        e.preventDefault();
        next();
      } else if (PREV_KEYS.has(e.key)) {
        e.preventDefault();
        prev();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  const block = sections[i] ?? '';
  const lines = block.split('\n');
  const hasHeader = lines.length > 1;
  const header = hasHeader ? lines[0] : '';
  const body = hasHeader ? lines.slice(1).join('\n') : block;

  return (
    <div className={t.root}>
      <div className={t.topbar}>
        <Link href={backHref} className={t.exit}>
          ✕ Exit
        </Link>
        <span className={t.title}>{title}</span>
        <span className={t.counter}>
          {total ? i + 1 : 0} / {total}
        </span>
      </div>

      {/* Tap zones sit behind the (non-interactive) stage so a tap anywhere
          advances: left half = prev, right half = next. */}
      <button
        type="button"
        className={`${t.zone} ${t.zoneLeft}`}
        onClick={prev}
        aria-label="Previous section"
      />
      <button
        type="button"
        className={`${t.zone} ${t.zoneRight}`}
        onClick={next}
        aria-label="Next section"
      />

      <div className={t.stage}>
        {header && <div className={t.header}>{header}</div>}
        <div className={t.body}>{body || 'No script yet.'}</div>
      </div>

      <div className={t.hint}>
        Tap right / left, or use a remote (arrows · space · page up/down) to move
        section by section.
      </div>
    </div>
  );
}
