'use client';

/**
 * "Questions for Polynize" — the one client-writable blueprint section.
 *
 * Client scope: can add questions, and edit their own still-open question
 * text. Cannot change status or write an answer.
 * Team scope: sees all questions, sets status via the same pill/dropdown the
 * gap register uses, and can write an answer note.
 *
 * Mirrors the gap-register interaction (type -> commit -> persists as a row),
 * and reuses its status + note CSS. Helper render is a closure called via
 * .map (not a nested <Component/>), so there is no remount/caret bug.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Question, QuestionStatus } from '@/lib/blueprint/questions-io';
import s from './blueprint-sections.module.css';

const STATUS_OPTIONS: QuestionStatus[] = ['open', 'answered', 'closed'];

function statusClass(status: string): string {
  const n = status.trim().toLowerCase();
  if (n === 'answered') return s.statusAnswered;
  if (n === 'closed') return s.statusClosed;
  return s.statusOpen;
}

function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

type Props = {
  questions: Question[];
  slug: string;
  /** Team scope viewer: can set status + answer. */
  isTeam: boolean;
  /** Signed-in viewer's email (any scope); null if not signed in. */
  viewerEmail: string | null;
};

export function QuestionsForPolynize({
  questions: initial,
  slug,
  isTeam,
  viewerEmail,
}: Props) {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>(initial);
  const [statusOpenFor, setStatusOpenFor] = useState<string | null>(null);
  const [editingFor, setEditingFor] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [answeringFor, setAnsweringFor] = useState<string | null>(null);
  const [answerDraft, setAnswerDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Re-sync with the server prop after router.refresh (and out-of-band edits).
  useEffect(() => {
    setQuestions(initial);
  }, [initial]);

  const canAdd = !!viewerEmail;
  const ownEmail = (viewerEmail ?? '').toLowerCase();

  async function postUpdate(id: string, partial: Record<string, unknown>) {
    setSavingId(id);
    setError(null);
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? ({ ...q, ...partial } as Question) : q))
    );
    try {
      const res = await fetch(`/api/console/${slug}/questions/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      setQuestions(initial); // rollback
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingId(null);
    }
  }

  async function addQuestion() {
    const text = addDraft.trim();
    if (!text) return;
    setSavingId('__add__');
    setError(null);
    try {
      const res = await fetch(`/api/console/${slug}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setAdding(false);
      setAddDraft('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the question');
    } finally {
      setSavingId(null);
    }
  }

  function renderRow(q: Question) {
    const ownOpen =
      !isTeam &&
      q.author_role === 'client' &&
      !!q.author_email &&
      q.author_email.toLowerCase() === ownEmail &&
      q.status === 'open';

    return (
      <div key={q.id} className={s.qRowGroup}>
        <div className={s.qRow}>
          <div className={s.qBody}>
            {editingFor === q.id ? (
              <div className={s.notesEditor}>
                <textarea
                  className={s.notesTextarea}
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  rows={2}
                  autoFocus
                />
                <div className={s.notesActions}>
                  <button
                    type="button"
                    className={s.notesSaveBtn}
                    onClick={() => {
                      const t = editDraft.trim();
                      setEditingFor(null);
                      if (t && t !== q.text) postUpdate(q.id, { text: t });
                    }}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className={s.notesCancelBtn}
                    onClick={() => setEditingFor(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className={s.qText}>{q.text}</div>
            )}
            <div className={s.qMeta}>
              <span className={s.qAuthor}>
                {q.author_role === 'polynize' ? 'Polynize' : 'Client'}
              </span>
              {q.created_at && (
                <span className={s.qTime}>{fmtDate(q.created_at)}</span>
              )}
              {ownOpen && editingFor !== q.id && (
                <button
                  type="button"
                  className={s.qEditLink}
                  onClick={() => {
                    setEditDraft(q.text);
                    setEditingFor(q.id);
                  }}
                >
                  Edit
                </button>
              )}
            </div>
          </div>

          <div className={s.qStatus}>
            {isTeam ? (
              <>
                <button
                  type="button"
                  className={`${s.statusPill} ${statusClass(q.status)} ${s.statusPillButton}`}
                  onClick={() =>
                    setStatusOpenFor((prev) => (prev === q.id ? null : q.id))
                  }
                  disabled={savingId === q.id}
                  aria-haspopup="menu"
                  aria-expanded={statusOpenFor === q.id}
                >
                  {q.status}
                </button>
                {statusOpenFor === q.id && (
                  <div className={s.statusDropdown} role="menu">
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        role="menuitem"
                        className={`${s.statusOption} ${statusClass(opt)} ${
                          opt === q.status ? s.statusOptionCurrent : ''
                        }`}
                        onClick={() => {
                          setStatusOpenFor(null);
                          if (opt !== q.status) postUpdate(q.id, { status: opt });
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <span className={`${s.statusStatic} ${statusClass(q.status)}`}>
                {q.status}
              </span>
            )}
          </div>
        </div>

        {/* Answer row: team can write/edit; client sees it read-only. */}
        <div className={s.qAnswerRow}>
          {isTeam ? (
            answeringFor === q.id ? (
              <div className={s.notesEditor}>
                <textarea
                  className={s.notesTextarea}
                  value={answerDraft}
                  onChange={(e) => setAnswerDraft(e.target.value)}
                  rows={2}
                  placeholder="Answer for the client"
                  autoFocus
                />
                <div className={s.notesActions}>
                  <button
                    type="button"
                    className={s.notesSaveBtn}
                    onClick={() => {
                      const a = answerDraft.trim();
                      setAnsweringFor(null);
                      postUpdate(q.id, {
                        answer: a || null,
                        status: q.status === 'open' ? 'answered' : q.status,
                      });
                    }}
                  >
                    Save answer
                  </button>
                  <button
                    type="button"
                    className={s.notesCancelBtn}
                    onClick={() => setAnsweringFor(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : q.answer ? (
              <button
                type="button"
                className={s.notesDisplay}
                onClick={() => {
                  setAnswerDraft(q.answer ?? '');
                  setAnsweringFor(q.id);
                }}
              >
                <span className={s.notesLabel}>Polynize</span>
                <span className={s.notesText}>{q.answer}</span>
              </button>
            ) : (
              <button
                type="button"
                className={s.notesAddLink}
                onClick={() => {
                  setAnswerDraft('');
                  setAnsweringFor(q.id);
                }}
              >
                + Add answer
              </button>
            )
          ) : (
            q.answer && (
              <div className={s.notesStatic}>
                <span className={s.notesLabel}>Polynize</span>
                <span className={s.notesText}>{q.answer}</span>
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={s.qRegister}>
      {questions.length === 0 ? (
        <p className={s.qEmpty}>
          {isTeam
            ? 'No questions from the client yet.'
            : 'No questions yet. Add one below for the Polynize team.'}
        </p>
      ) : (
        <div className={s.qList}>{questions.map(renderRow)}</div>
      )}

      {canAdd &&
        (adding ? (
          <div className={s.notesEditor}>
            <textarea
              className={s.notesTextarea}
              value={addDraft}
              onChange={(e) => setAddDraft(e.target.value)}
              rows={2}
              placeholder="Your question or note for the Polynize team"
              autoFocus
            />
            <div className={s.notesActions}>
              <button
                type="button"
                className={s.notesSaveBtn}
                onClick={addQuestion}
                disabled={savingId === '__add__'}
              >
                {savingId === '__add__' ? 'Saving…' : 'Add question'}
              </button>
              <button
                type="button"
                className={s.notesCancelBtn}
                onClick={() => {
                  setAdding(false);
                  setAddDraft('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className={s.qAddBtn}
            onClick={() => {
              setAddDraft('');
              setAdding(true);
            }}
          >
            + Add question
          </button>
        ))}

      {error && (
        <div className={s.notesError} role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
