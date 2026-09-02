'use client';

/**
 * PULL NOW (D86, made legible in D88).
 *
 * Marrs: "The pull now button is not working anymore. Just have a look into that."
 *
 * WHAT WAS WRONG IS THAT IT SAID NOTHING, and on the engine page it said nothing for a long time.
 * One press fired a single request that walked all five brands one after another, on somebody else's
 * analytics API, inside a 120 second budget. A press that takes most of a minute and then reports
 * neither a number nor an error is indistinguishable from a dead button, and there was no way to
 * tell "still going" from "finished with nothing" from "broken".
 *
 * WORSE: A PULL COULD SUCCEED AND STILL LEAVE THE PANEL EMPTY. The route returns `ok` when it has
 * recorded a per-stream failure, because one unmapped brand must not fail the other four. So five
 * refused brands returned 200 and the button showed nothing at all. That is the shape of bug that
 * makes a person distrust a tool rather than report it.
 *
 * SO IT IS NOW ONE REQUEST PER STREAM, driven from here:
 *   - the label names the stream it is on, so a slow brand looks slow rather than broken;
 *   - each request stands alone, so no single hang can eat the whole run's budget;
 *   - the outcome is printed and stays printed: how many posts, from how many streams, and every
 *     stream that failed, with its reason.
 *
 * A TIMEOUT PER REQUEST, because "not working" was a real report and a hung fetch has no natural
 * end. Ninety seconds is far beyond a healthy call and well inside the route's own budget.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { STREAMS } from '@/lib/marketing/streams';
import s from './analytics.module.css';

const TIMEOUT_MS = 90_000;

type Outcome = { posts: number; streams: number; failures: string[] };

export function PullButton({ scope }: { scope: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ at: number; of: number } | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** 'engine' means every stream, one request each. A stream page pulls only itself. */
  const targets =
    scope === 'engine' ? STREAMS.map((x) => ({ id: x.id, label: x.label })) : [{ id: scope, label: scope }];

  const pull = async () => {
    if (busy) return;
    setError(null);
    setOutcome(null);

    let posts = 0;
    let streams = 0;
    const failures: string[] = [];

    for (let i = 0; i < targets.length; i += 1) {
      const t = targets[i];
      setBusy(t.label);
      setProgress({ at: i + 1, of: targets.length });

      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
      try {
        /**
         * ABSOLUTE, unlike most fetches in this console, because this component renders at the
         * bottom of two different routes so there is no sibling to be relative to. Safe on
         * pam.polynize.ai: the middleware only rewrites a path that does NOT already start with
         * /console, and this one does.
         */
        const res = await fetch('/console/marketing/analytics/pull', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ stream: t.id }),
          signal: abort.signal,
        });
        const b = (await res.json().catch(() => null)) as
          | { error?: string; results?: { stream: string; ok: boolean; posts: number; error?: string }[] }
          | null;

        if (!res.ok) {
          failures.push(`${t.label}: ${b?.error ?? `the request failed (${res.status})`}`);
          continue;
        }
        const r = b?.results?.[0];
        if (!r || !r.ok) {
          failures.push(`${t.label}: ${r?.error ?? 'nothing came back'}`);
          continue;
        }
        posts += r.posts;
        if (r.posts > 0) streams += 1;
      } catch (e) {
        failures.push(
          `${t.label}: ${
            e instanceof Error && e.name === 'AbortError'
              ? 'no answer in 90 seconds'
              : 'network error'
          }`
        );
      } finally {
        clearTimeout(timer);
      }
    }

    setBusy(null);
    setProgress(null);
    setOutcome({ posts, streams, failures });
    /**
     * A refresh rather than local state: the panel is a server component reading the store, so the
     * server has to rebuild it. Nothing here holds the numbers, which is what keeps one source.
     */
    router.refresh();
  };

  return (
    <span className={s.pullWrap}>
      {error ? <span className={s.pullErr}>{error}</span> : null}
      {outcome ? (
        <span className={outcome.failures.length && !outcome.posts ? s.pullErr : s.pullSaid}>
          {outcome.posts > 0
            ? `${outcome.posts} post${outcome.posts === 1 ? '' : 's'} from ${outcome.streams} stream${outcome.streams === 1 ? '' : 's'}`
            : 'no posts came back'}
          {outcome.failures.length ? ` · ${outcome.failures.join(' · ')}` : ''}
        </span>
      ) : null}
      <button type="button" className={s.pullBtn} onClick={pull} disabled={busy !== null}>
        {busy
          ? `Pulling ${busy}${progress && progress.of > 1 ? ` (${progress.at}/${progress.of})` : ''}…`
          : 'Pull now'}
      </button>
    </span>
  );
}
