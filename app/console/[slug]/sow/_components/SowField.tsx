'use client';

/**
 * One editable SoW field, two-colour by ownership and role-aware.
 *
 * Colour: POLYNIZE-owned unfilled fields show a MINT "NEEDS INPUT" badge;
 * CLIENT-owned unfilled fields show an ORANGE one.
 *
 * Who can edit: team edits any field; a client edits only client-owned fields.
 *
 * What a client sees:
 *   - their own (orange) unfilled fields  → orange NEEDS INPUT badge (editable)
 *   - filled fields (any owner)           → the value
 *   - UNFILLED Polynize fields            → a plain blank underline, NOT a mint
 *                                           badge (clients never see our
 *                                           internal to-do markers)
 *
 * Module scope (not nested in a parent render) so the caret never resets.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import s from '../sow.module.css';

export type SowViewerScope = 'team' | 'client' | 'anon';

export function SowField({
  slug,
  path,
  value,
  label,
  owner,
  scope,
  multiline = false,
  placeholder,
}: {
  slug: string;
  path: string;
  value: string | null;
  label: string;
  owner: 'polynize' | 'client';
  scope: SowViewerScope;
  multiline?: boolean;
  placeholder?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filled = !!(value && value.trim());
  // Team edits everything; a client edits only their own (client-owned) fields.
  const canEdit = scope === 'team' || (scope === 'client' && owner === 'client');

  if (!canEdit) {
    if (filled) return <span className={s.fieldValue}>{value}</span>;
    // Unfilled + not editable by this viewer: a plain blank underline. For a
    // client this is an unfilled Polynize field — they must NOT see our mint
    // to-do badge, just a blank where our value will go.
    return (
      <span
        className={s.fieldBlank}
        aria-label={`${label}: to be completed by Polynize`}
      />
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

  // Unfilled + editable: NEEDS INPUT badge, coloured by owner.
  const badgeClass = owner === 'polynize' ? s.needsInputMint : s.needsInput;
  return (
    <button
      type="button"
      className={badgeClass}
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
