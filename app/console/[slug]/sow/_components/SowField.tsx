'use client';

/**
 * One editable SoW field. Click to edit (team scope); saves POST to the SoW
 * field endpoint with { path, value }, then router.refresh().
 *
 * Empty (null / blank) + editable → a coral "NEEDS INPUT" badge naming the
 * field. Filled → the value, with a subtle edit affordance. Read-only viewers
 * (client scope) see the value or a muted "to be completed" placeholder, never
 * a badge or an input.
 *
 * Defined at module scope (not nested in a parent render) so its identity is
 * stable across keystrokes and the caret never resets.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import s from '../sow.module.css';

export function SowField({
  slug,
  path,
  value,
  label,
  canEdit,
  multiline = false,
  placeholder,
}: {
  slug: string;
  path: string;
  value: string | null;
  /** Human-readable field name, shown in the NEEDS INPUT badge. */
  label: string;
  canEdit: boolean;
  multiline?: boolean;
  placeholder?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filled = !!(value && value.trim());

  if (!canEdit) {
    return filled ? (
      <span className={s.fieldValue}>{value}</span>
    ) : (
      <span className={s.fieldTodo}>to be completed</span>
    );
  }

  if (editing) {
    const save = async () => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`/api/console/${slug}/sow/field`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path, value: draft.trim() }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        setEditing(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed');
      } finally {
        setSaving(false);
      }
    };
    return (
      <span className={s.fieldEditor}>
        {multiline ? (
          <textarea
            className={s.fieldTextarea}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder={placeholder ?? label}
            autoFocus
          />
        ) : (
          <input
            className={s.fieldInput}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder ?? label}
            autoFocus
          />
        )}
        <span className={s.fieldActions}>
          <button
            type="button"
            className={s.fieldSave}
            onClick={save}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            className={s.fieldCancel}
            onClick={() => {
              setEditing(false);
              setDraft(value ?? '');
              setError(null);
            }}
          >
            Cancel
          </button>
          {error && <span className={s.fieldError}>{error}</span>}
        </span>
      </span>
    );
  }

  if (filled) {
    return (
      <button
        type="button"
        className={s.fieldFilled}
        onClick={() => {
          setDraft(value ?? '');
          setEditing(true);
        }}
        title="Click to edit"
      >
        {value}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={s.needsInput}
      onClick={() => {
        setDraft('');
        setEditing(true);
      }}
      title={`Click to complete: ${label}`}
    >
      NEEDS INPUT: {label}
    </button>
  );
}
