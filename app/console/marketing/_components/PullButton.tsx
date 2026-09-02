'use client';

/**
 * PULL NOW (D86). The one interactive thing on the analytics panel.
 *
 * A BUTTON BEFORE A CRON, deliberately. The pull had never run against a real account, and a nightly
 * job that fails at 3am is the worst possible first version: nobody sees the failure and the
 * dashboard simply stays empty. A person pressing a button and reading the result is how the first
 * pull should happen. The cron is this same call on a timer once it is boring.
 *
 * `scope` is a stream id, or 'engine' for every stream at once.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import s from './analytics.module.css';

export function PullButton({ scope }: { scope: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pull = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      /**
       * ABSOLUTE, not path-relative like the rest of the console's fetches: this component renders
       * at the bottom of two different routes, so there is no sibling to be relative to. The
       * pam.polynize.ai rewrite prepends /console to the PATH, which this path already carries, so
       * it resolves on both hosts.
       */
      const res = await fetch('/console/marketing/analytics/pull', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(scope === 'engine' ? {} : { stream: scope }),
      });
      const b = (await res.json().catch(() => null)) as
        | { pulled?: number; error?: string; results?: { stream: string; error?: string }[] }
        | null;
      if (!res.ok) {
        setError(b?.error ?? 'The pull failed.');
        return;
      }
      /**
       * A refresh rather than local state: the panel is a server component reading a store, so the
       * server has to rebuild it. Nothing here holds the numbers, which is what keeps one source.
       */
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className={s.pullWrap}>
      {error ? <span className={s.pullErr}>{error}</span> : null}
      <button type="button" className={s.pullBtn} onClick={pull} disabled={busy}>
        {busy ? 'Pulling…' : 'Pull now'}
      </button>
    </span>
  );
}
