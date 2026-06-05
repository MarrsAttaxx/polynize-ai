'use client';

/**
 * Client signature slot (DocuSign-style). Unsigned: the client types their
 * name, sees it render live in the cursive font, and submits. The submit is
 * gated on all client (orange) fields being filled. Signed: the recorded
 * cursive signature with "signed by <email> on <date>", read-only.
 *
 * The server re-checks the same gate (authorizeSowSign) and locks the doc, so
 * this is a UX layer over a server-enforced rule, not the rule itself.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SowSigning } from '@/lib/sow/schema';
import type { SowViewerScope } from './SowField';
import s from '../sow.module.css';

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function SowSignature({
  slug,
  scope,
  signing,
  clientRemaining,
}: {
  slug: string;
  scope: SowViewerScope;
  signing: SowSigning;
  clientRemaining: number;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Signed → show the recorded signature, read-only (any viewer).
  if (signing.client_signature) {
    return (
      <div className={s.sigSigned}>
        <div className={s.cursive}>{signing.client_signature}</div>
        <div className={s.sigMeta}>
          Signed by {signing.signed_by} on {fmtDate(signing.signed_at)}
        </div>
      </div>
    );
  }

  // Unsigned. Only the client gets the signing affordance.
  if (scope !== 'client') {
    return <div className={s.sigAwaiting}>Awaiting client signature.</div>;
  }

  const ready = clientRemaining === 0;

  const submit = async () => {
    const value = name.trim();
    if (!value || !ready) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/console/${slug}/sow/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature: value }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit signature');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={s.sigForm}>
      <label className={s.sigLabel} htmlFor="sow-sign-input">
        Sign here
      </label>
      <input
        id="sow-sign-input"
        className={s.sigInput}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Type your full name"
        disabled={!ready}
        autoComplete="name"
      />
      {name.trim() && <div className={s.cursive}>{name}</div>}
      <button
        type="button"
        className={s.sigSubmit}
        onClick={submit}
        disabled={!ready || submitting || !name.trim()}
      >
        {submitting ? 'Signing…' : 'Submit signature'}
      </button>
      {!ready && (
        <div className={s.sigHint}>
          Complete your {clientRemaining} field
          {clientRemaining === 1 ? '' : 's'} before signing.
        </div>
      )}
      {error && (
        <div className={s.sigError} role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
