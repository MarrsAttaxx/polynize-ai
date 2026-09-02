'use client';

/**
 * THE REVIEW LIST (D93). Each note, what it applies to, and the three things you can do to it.
 *
 * WIDEN OR NARROW, RETIRE, OR CALL IT A DEFECT. Nothing else, because those are the three real
 * decisions: the scope was guessed from where he typed it and needs correcting sometimes; a rule
 * that has done its job should stop spending prompt budget; and some feedback is a bug report, which
 * an instruction cannot fix.
 *
 * OPTIMISTIC, then reconciled by a refresh. A scope change that appears to work and silently did
 * not would be the worst outcome here, so a failure puts the row back and says why.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { JOBS, type FeedbackNote, type JobId } from '@/lib/marketing/feedback';
import s from './feedback.module.css';

type Stream = { id: string; label: string };

export function FeedbackList({
  live,
  defects,
  retired,
  overflow,
  streams,
}: {
  live: FeedbackNote[];
  defects: FeedbackNote[];
  retired: FeedbackNote[];
  /** Ids of notes that matched a scope but did not fit its cap. */
  overflow: string[];
  streams: Stream[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const over = new Set(overflow);

  const save = async (id: string, patch: Record<string, unknown>) => {
    if (busy) return;
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(window.location.pathname.replace(/\/+$/, '') + '/save', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(b?.error ?? 'Could not save that change.');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const row = (n: FeedbackNote, mode: 'live' | 'defect' | 'retired') => (
    <li key={n.id} className={`${s.note} ${over.has(n.id) ? s.noteOver : ''}`}>
      <p className={s.noteText}>{n.text}</p>
      <div className={s.noteMeta}>
        {/* WHERE IT APPLIES, and changeable, because it was guessed from where he typed it. */}
        <select
          className={s.scopeSelect}
          value={
            n.scope === 'house' ? 'house' : n.scope === 'stream' ? `stream:${n.stream}` : `job:${n.job}`
          }
          disabled={busy === n.id || mode === 'retired'}
          aria-label="Where this applies"
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'house') return void save(n.id, { scope: 'house' });
            if (v.startsWith('stream:')) {
              return void save(n.id, { scope: 'stream', stream: v.slice(7) });
            }
            void save(n.id, { scope: 'job', job: v.slice(4) });
          }}
        >
          <option value="house">Everything she writes</option>
          {streams.map((st) => (
            <option key={st.id} value={`stream:${st.id}`}>
              The {st.label} stream
            </option>
          ))}
          {JOBS.map((j) => (
            <option key={j.id} value={`job:${j.id}`}>
              {j.label}
            </option>
          ))}
        </select>

        <span className={s.noteWhen}>{n.at.slice(0, 10)}</span>

        {mode !== 'retired' ? (
          <>
            {/* A note cannot fix a bug: marking it takes it out of every prompt. */}
            <button
              type="button"
              className={s.noteBtn}
              disabled={busy === n.id}
              onClick={() => void save(n.id, { kind: mode === 'defect' ? 'rule' : 'defect' })}
              title={
                mode === 'defect'
                  ? 'Treat this as a rule again and put it back in her brief'
                  : 'This is a bug rather than a preference. Takes it out of every prompt and lists it to be fixed in code.'
              }
            >
              {mode === 'defect' ? 'Make it a rule' : 'This is a bug'}
            </button>
            <button
              type="button"
              className={s.noteBtn}
              disabled={busy === n.id}
              onClick={() => void save(n.id, { retired: true })}
              title="Stop applying it. Nothing is deleted."
            >
              Retire
            </button>
          </>
        ) : (
          <button
            type="button"
            className={s.noteBtn}
            disabled={busy === n.id}
            onClick={() => void save(n.id, { retired: false })}
          >
            Bring it back
          </button>
        )}
      </div>
      {over.has(n.id) ? (
        <p className={s.overWarn}>
          Not being applied: its scope is already full. Retire another note in the same scope to make
          room.
        </p>
      ) : null}
    </li>
  );

  return (
    <div className={s.wrap}>
      {error ? <p className={s.err}>{error}</p> : null}

      <section>
        <h2 className={s.sectionTitle}>In force ({live.length})</h2>
        {live.length === 0 ? (
          <p className={s.empty}>No rules in force.</p>
        ) : (
          <ul className={s.notes}>{live.map((n) => row(n, 'live'))}</ul>
        )}
      </section>

      {defects.length > 0 ? (
        <section>
          <h2 className={s.sectionTitle}>Bugs to fix in code ({defects.length})</h2>
          <p className={s.sectionHint}>
            Not in any prompt. An instruction cannot undo a contradiction: she would be told two
            opposite things and pick one. These need the code changing.
          </p>
          <ul className={s.notes}>{defects.map((n) => row(n, 'defect'))}</ul>
        </section>
      ) : null}

      {retired.length > 0 ? (
        <section>
          <h2 className={s.sectionTitle}>Retired ({retired.length})</h2>
          <p className={s.sectionHint}>
            Kept on purpose. Seeing what was said and what happened to it is most of the value here.
          </p>
          <ul className={s.notes}>{retired.map((n) => row(n, 'retired'))}</ul>
        </section>
      ) : null}
    </div>
  );
}

/** Re-exported so the page's scope loop and this list cannot disagree about the vocabulary. */
export type { JobId };
