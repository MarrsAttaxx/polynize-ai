'use client';

/**
 * Generic inline text editor — a client island embedded in the otherwise
 * server-rendered section tables. Click to edit (team-scope, unlocked),
 * save POSTs to the given endpoint, then router.refresh().
 *
 * Mirrors the existing RAG / gap inline-edit pattern for consistency.
 *
 * When canEdit is false (client-scope) it renders plain text. When locked
 * it renders plain text with a small lock affordance so the reason for
 * non-editability is visible.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import s from './v2-sections.module.css';

export function EditableText({
  value,
  endpoint,
  bodyKey,
  extraBody,
  canEdit,
  locked,
  multiline = true,
  placeholder = 'Add…',
  emptyDash = true,
}: {
  value: string | null;
  endpoint: string;
  /** The JSON body key this field maps to (e.g. "current_state"). */
  bodyKey: string;
  /** Extra fields merged into the POST body (e.g. { approvedBy }). */
  extraBody?: Record<string, unknown>;
  canEdit: boolean;
  locked: boolean;
  multiline?: boolean;
  placeholder?: string;
  emptyDash?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const display = value && value.trim() ? value : emptyDash ? '—' : '';

  if (!canEdit) {
    return <span className={value ? undefined : s.moveEmpty}>{display}</span>;
  }

  if (locked && !editing) {
    return (
      <span className={s.lockedField} title="Engagement section is locked">
        {display} <span className={s.lockGlyph} aria-hidden>🔒</span>
      </span>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        className={s.editableTrigger}
        onClick={() => {
          setDraft(value ?? '');
          setEditing(true);
        }}
        title="Click to edit"
      >
        <span className={value ? undefined : s.moveEmpty}>{display}</span>
      </button>
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ [bodyKey]: draft, ...(extraBody ?? {}) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 423) {
          setError('Locked: this section is read-only until unlocked.');
        } else {
          setError(body.error ?? `Save failed (${res.status})`);
        }
        setSaving(false);
        return;
      }
      setEditing(false);
      setSaving(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
      setSaving(false);
    }
  }

  return (
    <div className={s.editorInline}>
      {multiline ? (
        <textarea
          className={s.editorTextarea}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          rows={3}
          autoFocus
           
        />
      ) : (
        <input
          className={s.editorInput}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          autoFocus
        />
      )}
      {error && <span className={s.editorErrorInline}>{error}</span>}
      <div className={s.editorInlineActions}>
        <button
          type="button"
          className={s.btnGhostSm}
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          className={s.btnPrimarySm}
          onClick={save}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
