'use client';

/**
 * Copy a concept from another stream into the target stream (Concept Library).
 * POSTs to /console/marketing/library/copy and lands on the new copy.
 */

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import s from './library.module.css';

export function CopyConceptButton({
  slug,
  targetStream,
  targetLabel,
}: {
  slug: string;
  targetStream: string;
  targetLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // Path-relative base so it works on pam.polynize.ai and www/console.
      const url = (pathname ?? window.location.pathname).replace(/\/+$/, '') + '/copy';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, targetStream }),
      });
      const b = (await res.json().catch(() => null)) as
        | { slug?: string; error?: string }
        | null;
      if (!res.ok || !b?.slug) {
        setError(b?.error ?? 'Could not copy the concept.');
        setBusy(false);
        return;
      }
      router.push(`/console/marketing/concept/${b.slug}`);
    } catch {
      setError('Network error. Try again.');
      setBusy(false);
    }
  };

  return (
    <span className={s.copyWrap}>
      <button type="button" className={s.copyBtn} onClick={copy} disabled={busy}>
        {busy ? 'Copying…' : `Copy to ${targetLabel} →`}
      </button>
      {error ? <span className={s.copyError}>{error}</span> : null}
    </span>
  );
}
