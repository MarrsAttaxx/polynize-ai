/**
 * THE ANALYTICS PROBE (D69). One page, six read-only calls, four answers.
 *
 * Marrs: "How do we make the analytics numbers real?"
 *
 * Everything on the analytics panel waits on four facts about his Metricool account, not on our
 * code. This asks all four at once and prints exactly what came back, so the next step is a
 * decision rather than a guess. Todo item 8 has carried these as "one authenticated call" for
 * weeks; this is the call.
 *
 * NOTHING IS WRITTEN. Every request is a GET and no result is stored. Safe to open, safe to reload,
 * safe to open while a wave is running.
 *
 * Team scope only, and it prints raw response bodies, so it is deliberately not linked from
 * anywhere: it is a diagnostic, reached by url.
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { BackLink } from '@/app/console/marketing/_components/BackLink';
import { isMetricoolConfigured } from '@/lib/marketing/metricool-client';
import {
  getBrandMap,
  getPostingSchedule,
  type PostingSchedule,
} from '@/lib/marketing/metricool-config-store';
import { listEntries } from '@/lib/marketing/calendar-store';
import { isStreamId, streamLabel, STREAMS } from '@/lib/marketing/streams';
import { runProbe } from '@/lib/marketing/analytics-probe';
import { laneTimezone } from '@/lib/marketing/channel-schedule';
import s from './probe.module.css';

export const dynamic = 'force-dynamic';

/** A 90 day window by default: wide enough to contain something, narrow enough to come back. */
function windowDays(days: number): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { start: from.toISOString().slice(0, 10), end };
}

export default async function ProbePage({
  searchParams,
}: {
  searchParams: Promise<{ stream?: string; days?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.scope.type === 'client') redirect(`/console/${user.scope.slug}/blueprint`);

  const sp = await searchParams;
  const stream = isStreamId(sp.stream ?? '') ? (sp.stream as string) : STREAMS[0].id;
  const days = Math.min(365, Math.max(7, Number(sp.days) || 90));
  const { start, end } = windowDays(days);

  if (!isMetricoolConfigured()) {
    return (
      <div className={s.root}>
        <BackLink fallbackHref="/console/marketing/metricool" className={s.back} />
        <h1 className={s.title}>Analytics probe</h1>
        <p className={s.bad}>
          Metricool is not connected, so there is nothing to ask. Add METRICOOL_USER_TOKEN and
          METRICOOL_USER_ID in Vercel first.
        </p>
      </div>
    );
  }

  const [map, schedule] = await Promise.all([
    getBrandMap().catch(() => ({}) as Record<string, string>),
    getPostingSchedule().catch(() => ({}) as PostingSchedule),
  ]);
  const blogId = map[stream];
  const timezone = laneTimezone(stream, schedule[stream]?.timezone);

  if (!blogId) {
    return (
      <div className={s.root}>
        <BackLink fallbackHref="/console/marketing/metricool" className={s.back} />
        <h1 className={s.title}>Analytics probe</h1>
        <p className={s.bad}>
          {streamLabel(stream)} is not mapped to a Metricool brand yet. Map it on the Connect
          Metricool page, then come back.
        </p>
      </div>
    );
  }

  /**
   * OUR SIDE OF THE JOIN. Every id we hold from publishing, which is what `external_ref` is. If
   * this is empty the join question cannot be answered yet, and the probe says so rather than
   * reporting a false negative: send one post through first, even as a draft.
   */
  let ourIds: string[] = [];
  let entryCount = 0;
  try {
    const entries = (await listEntries(user.email)).filter((e) => e.stream === stream);
    entryCount = entries.length;
    ourIds = entries.map((e) => e.external_ref).filter((x): x is string => Boolean(x));
  } catch {
    ourIds = [];
  }

  const run = await runProbe({ blogId, timezone, start, end }, ourIds);

  return (
    <div className={s.root}>
      <BackLink fallbackHref="/console/marketing/metricool" className={s.back} />
      <span className={s.eyebrow}>diagnostic · read only</span>
      <h1 className={s.title}>Analytics probe</h1>
      <p className={s.sub}>
        {streamLabel(stream)}, brand {blogId}, {start} to {end}, {timezone}. Six GET requests, and
        nothing is written anywhere.
      </p>

      <div className={s.streams}>
        {STREAMS.map((st) => (
          <a
            key={st.id}
            className={`${s.streamLink} ${st.id === stream ? s.streamOn : ''}`}
            href={`?stream=${st.id}&days=${days}`}
          >
            {st.label}
          </a>
        ))}
      </div>

      {/* QUESTION 1: the gate. Everything else is moot if this one refuses. */}
      <section className={s.answer}>
        <h2 className={s.aTitle}>1. Is the account tier good enough?</h2>
        <p className={run.tier === 'looks available' ? s.good : run.tier.startsWith('refused') ? s.bad : s.meh}>
          {run.tier}
        </p>
        <p className={s.note}>
          API analytics are documented as Advanced or Custom tiers only. If the analytics calls
          refuse while the brand list below works, that is the tier and not the token, and the panel
          stays a mock until the plan changes.
        </p>
      </section>

      {/* QUESTION 2: the one that decides whether analytics can ever mean anything per piece. */}
      <section className={s.answer}>
        <h2 className={s.aTitle}>2. Does the join work?</h2>
        <p
          className={
            run.join.verdict === 'they match, the loop closes'
              ? s.good
              : run.join.verdict === 'no overlap, a fallback join is needed'
                ? s.bad
                : s.meh
          }
        >
          {run.join.verdict}
        </p>
        <p className={s.note}>
          We hold <strong>{ourIds.length}</strong> published id{ourIds.length === 1 ? '' : 's'} on
          this stream, out of {entryCount} calendar entr{entryCount === 1 ? 'y' : 'ies'}. Their
          analytics feed returned <strong>{run.join.theirs.length}</strong>.{' '}
          {run.join.matched.length > 0
            ? `${run.join.matched.length} of ours appear in theirs, so a post's numbers can be attached to the piece that made it.`
            : ourIds.length === 0
              ? 'Send one post through Metricool first, a draft is enough, then reload this page.'
              : 'Nothing overlaps, so the numbers would have to be matched on public url or on time plus text, both of which are fragile.'}
        </p>
        {ourIds.length > 0 ? (
          <pre className={s.pre}>
            ours:   {ourIds.slice(0, 8).join(', ')}
            {'\n'}theirs: {run.join.theirs.slice(0, 8).join(', ') || '(none)'}
          </pre>
        ) : null}
      </section>

      {/* QUESTIONS 3 AND 4 are read straight off the calls: the content type and the counts. */}
      <section className={s.answer}>
        <h2 className={s.aTitle}>3 and 4. What each endpoint actually returns</h2>
        <p className={s.note}>
          A 200 carrying <code>text/csv</code> answers the TikTok question. A LinkedIn feed with far
          fewer posts than you have published answers the enumeration one, and remember his personal
          LinkedIn is hand-posted so those were never published through Metricool at all.
        </p>
      </section>

      <div className={s.calls}>
        {run.calls.map((c) => (
            <div key={c.path} className={s.call}>
              <div className={s.callHead}>
                <code className={s.callPath}>{c.path}</code>
                <span
                  className={`${s.status} ${
                    c.status === 200 ? s.stOk : c.status ? s.stBad : s.stErr
                  }`}
                >
                  {c.error ? 'network error' : (c.status ?? '?')}
                </span>
                <span className={s.ctype}>{c.contentType ?? ''}</span>
              </div>
              {c.error ? <p className={s.bad}>{c.error}</p> : null}
              <pre className={s.pre}>{c.bodyHead || '(empty body)'}</pre>
            </div>
          ))}
      </div>

      <p className={s.foot}>
        Send me this page and the next step is a build rather than a question.
      </p>
    </div>
  );
}
