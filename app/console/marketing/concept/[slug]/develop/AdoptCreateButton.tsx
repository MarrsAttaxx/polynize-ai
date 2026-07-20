'use client';

/**
 * "Create content" for a hub whose pieces predate the concept bank: one click
 * promotes the group into a real core concept (via ./adopt) and lands on the
 * template picker. After that, the hub is fully concept-backed.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import s from '../concept.module.css';

export function AdoptCreateButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const url = window.location.pathname.replace(/\/+$/, '') + '/adopt';
      const res = await fetch(url, { method: 'POST' });
      const b = (await res.json().catch(() => null)) as
        | { slug?: string; error?: string }
        | null;
      if (!res.ok || !b?.slug) {
        setError(b?.error ?? 'Could not set up the core concept.');
        setBusy(false);
        return;
      }
      router.push(`/console/marketing/concept/${b.slug}/create`);
    } catch {
      setError('Network error. Try again.');
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className={s.developBtn} onClick={go} disabled={busy}>
        {busy ? 'Setting up…' : 'Create content →'}
      </button>
      {error ? <span className={s.developError}>{error}</span> : null}
    </>
  );
}
