'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { JobBlueprint } from '@/lib/agents/job-blueprint-schema';
import { track } from '@/lib/analytics';
import { JobBlueprintDoc } from './JobBlueprintDoc';
import s from './job-mapping.module.css';

/**
 * The /job-mapping flow: paste, gate, work, read.
 *
 * WHY THE GATE IS WHERE IT IS. Pressing Go does not start anything. It swaps the panel for
 * the name and email fields, and submitting those is the real trigger (Marrs, 12 Aug 2026).
 * That ordering is the whole commercial design of the page: the reader has already done the
 * work of pasting, so the ask arrives when they are most invested and least likely to
 * abandon, and the wait they are agreeing to is the reason to hand over an address.
 *
 * WHY IT BOTH POLLS AND EMAILS. The server returns an id immediately and finishes in the
 * background, so a visitor who stays watches it land and reads it here, and one who closes
 * the tab gets the email. Neither path is the fallback for the other.
 *
 * THE JOB DESCRIPTION IS NEVER SENT ANYWHERE UNTIL THE GATE IS SUBMITTED, and never stored
 * at all. It sits in this component's state, goes up with the trigger request, and the
 * server holds it in memory only. There is no column for it.
 */

type Stage = 'input' | 'gate' | 'working' | 'done' | 'error';

/** Roughly what a JD needs to be worth mapping. Short enough to allow a terse real one. */
const MIN_CHARS = 400;

/**
 * What the working screen says, and when.
 *
 * Marrs wanted the wait to feel like work is happening, because it is. These are the actual
 * stages of the generation in order, not invented progress: read, break into capabilities,
 * allocate, then write the reasoning. Nothing here is a fake delay; if the model finishes
 * early the poll ends the screen early.
 *
 * PACED TO THE REAL GENERATION, which measured 29.6s end to end against gemini-3.5-flash
 * with this prompt. An earlier version spread these over 70s and a reader would only ever
 * have seen the first three, which makes the screen look stalled rather than busy. The
 * last message is the over-run case and sits well past the expected finish.
 */
const WORKING_MESSAGES: { from: number; text: string }[] = [
  { from: 0, text: 'Reading the job description' },
  { from: 4000, text: 'Stripping out the boilerplate' },
  { from: 9000, text: 'Breaking the role into capabilities' },
  { from: 15000, text: 'Allocating each one: human, hybrid or agentic' },
  { from: 21000, text: 'Working out what has to stay human' },
  { from: 27000, text: 'Writing up the reasoning' },
  { from: 45000, text: 'Nearly there. This one is taking a little longer' },
];

const POLL_MS = 2500;

export function JobMappingFlow() {
  const [stage, setStage] = useState<Stage>('input');
  const [jd, setJd] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(WORKING_MESSAGES[0].text);
  const [blueprint, setBlueprint] = useState<JobBlueprint | null>(null);
  const [id, setId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState('');
  const gateRef = useRef<HTMLInputElement | null>(null);

  const chars = jd.trim().length;
  const longEnough = chars >= MIN_CHARS;

  useEffect(() => {
    if (stage === 'gate') gateRef.current?.focus();
  }, [stage]);

  // The working-screen copy advances on its own clock; the poll below ends the stage.
  useEffect(() => {
    if (stage !== 'working') return;
    setMessage(WORKING_MESSAGES[0].text);
    const timers = WORKING_MESSAGES.slice(1).map((m) =>
      window.setTimeout(() => setMessage(m.text), m.from)
    );
    return () => timers.forEach(window.clearTimeout);
  }, [stage]);

  // Poll until the row is ready. Stops on ready, on failure, or when the component goes.
  useEffect(() => {
    if (stage !== 'working' || !id) return;
    let live = true;
    const tick = async () => {
      try {
        const res = await fetch(`/api/job-map/${id}`, { cache: 'no-store' });
        const json = await res.json();
        if (!live) return;
        if (json.status === 'ready' && json.blueprint) {
          setBlueprint(json.blueprint);
          setStage('done');
          track('blueprint_created', { id, surface: 'job_mapping' });
          return;
        }
        if (json.status === 'failed') {
          setErrorText(
            'The map did not come through. Nothing was kept, so pasting it again is the fastest way through.'
          );
          setStage('error');
          return;
        }
      } catch {
        /* a dropped poll is not a failure; the next tick tries again */
      }
      if (live) window.setTimeout(tick, POLL_MS);
    };
    const first = window.setTimeout(tick, POLL_MS);
    return () => {
      live = false;
      window.clearTimeout(first);
    };
  }, [stage, id]);

  function toGate() {
    if (!longEnough) return;
    // No PII and no document text: just that somebody got this far.
    track('phase_a_complete', { surface: 'job_mapping', chars });
    setStage('gate');
  }

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setStage('working');
    track('email_captured', { surface: 'job_mapping', domain: email.split('@')[1] ?? '' });
    try {
      const res = await fetch('/api/job-map/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd: jd.trim(), name: name.trim(), email: email.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok || !json.id) {
        setErrorText('We could not start that. Try again in a moment.');
        setStage('error');
        return;
      }
      setId(json.id);
    } catch {
      setErrorText('We could not reach the server. Check your connection and try again.');
      setStage('error');
    }
  }

  if (stage === 'done' && blueprint) {
    return (
      <>
        <JobBlueprintDoc blueprint={blueprint} />
        <div className={s.afterDoc}>
          <p className={s.afterLine}>
            We have emailed you this link. The map is yours to keep and to share.
          </p>
          <Link className={s.btnGhost} href="/job-mapping">
            Map another role
          </Link>
        </div>
      </>
    );
  }

  return (
    <div className={s.flow}>
      <header className={s.hero}>
        <h1 className={s.h1}>
          How can AI
          <br />
          <span className={s.mint}>Amplify your Job?</span>
        </h1>
        <p className={s.sub}>
          Paste your job description. We will break the role into the capabilities it really
          asks for and show you which ones stay human, which become hybrid, and which an agent
          can run.
        </p>
      </header>

      {stage === 'input' && (
        <section className={s.panel}>
          <label className={s.panelLabel} htmlFor="jd">
            Cut and paste your job description here
          </label>
          <textarea
            id="jd"
            className={s.textarea}
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            placeholder="Paste the whole thing. Duties, responsibilities, requirements, all of it. The more of the real document, the better the map."
            rows={12}
            spellCheck={false}
          />
          <div className={s.panelFoot}>
            <span className={longEnough ? s.countOk : s.count}>
              {chars === 0
                ? 'Nothing pasted yet'
                : longEnough
                  ? `${chars.toLocaleString()} characters. That is plenty.`
                  : `${chars.toLocaleString()} of about ${MIN_CHARS} characters`}
            </span>
            <button
              type="button"
              className={s.btnPrimary}
              onClick={toGate}
              disabled={!longEnough}
            >
              Map this role <span aria-hidden>→</span>
            </button>
          </div>
          <p className={s.privacy}>
            We do not keep your job description. It is used to build the map and then dropped.
          </p>
        </section>
      )}

      {stage === 'gate' && (
        <section className={s.panel}>
          <div className={s.gateHead}>
            <h2 className={s.gateTitle}>This takes up to about a minute and a half.</h2>
            <p className={s.gateBody}>
              Stay on this page and it will appear here as soon as it is done. If you would
              rather not wait, give us your email and we will send it to you.
            </p>
          </div>
          <form className={s.gateForm} onSubmit={start}>
            <div className={s.field}>
              <label className={s.fieldLabel} htmlFor="name">
                Your name
              </label>
              <input
                id="name"
                ref={gateRef}
                className={s.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel} htmlFor="email">
                Your email
              </label>
              <input
                id="email"
                type="email"
                className={s.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <button type="submit" className={s.btnPrimary} disabled={!name.trim() || !email.trim()}>
              Start mapping <span aria-hidden>→</span>
            </button>
          </form>
          <button type="button" className={s.backLink} onClick={() => setStage('input')}>
            Back to the job description
          </button>
        </section>
      )}

      {stage === 'working' && (
        <section className={`${s.panel} ${s.workingPanel}`} aria-live="polite">
          <div className={s.spinner} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className={s.workingMsg}>{message}</div>
          <p className={s.workingNote}>
            You can close this tab. We will email it to {email || 'you'} when it is ready.
          </p>
        </section>
      )}

      {stage === 'error' && (
        <section className={s.panel}>
          <h2 className={s.gateTitle}>That did not work.</h2>
          <p className={s.gateBody}>{errorText}</p>
          <button type="button" className={s.btnPrimary} onClick={() => setStage('input')}>
            Try again
          </button>
        </section>
      )}

      {/* Below the fold: the reasons to trust it, then what you actually get. Only shown
          before the gate, because once somebody has committed, more selling is noise. */}
      {stage === 'input' && (
        <>
          <section className={s.proof}>
            <div className={s.eyebrow}>Proof</div>
            <h2 className={s.proofH2}>Proven at enterprise scale.</h2>
            <p className={s.proofBody}>
              We work with some of the world&apos;s largest companies to build capability and
              turn spend into outcomes. From professional services to engineering, finance and
              any other industry, our platform is proven to map capability with speed, accuracy
              and scale, generating over 100,000 capability data points across enterprises.
            </p>
            <p className={s.proofNote}>
              All data is isolated per client and kept secure to industry standards.
            </p>
          </section>

          <section className={s.gets}>
            <div className={s.eyebrow}>What you get</div>
            <h2 className={s.getsH2}>Four answers about your role.</h2>
            <div className={s.getsGrid}>
              {WHAT_YOU_GET.map((g) => (
                <div key={g.title} className={`${s.getCard} ${g.lane ? s[g.lane] : ''}`}>
                  <div className={s.getTitle}>{g.title}</div>
                  <div className={s.getBody}>{g.body}</div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/**
 * The four answers, mapped onto three lanes.
 *
 * The brief named four things a reader wants to know and the site has three lanes, so the
 * agentic lane carries two of the four cards: AI doing part of the work, and a workflow
 * running without you. On the map itself that distinction is the `mechanism` line.
 */
const WHAT_YOU_GET: { title: string; body: string; lane?: 'lHuman' | 'lHybrid' | 'lAgentic' }[] = [
  {
    title: 'What has to stay human',
    body: 'The judgment, the relationships and the accountability that do not survive being handed over. Named specifically, not as a platitude.',
    lane: 'lHuman',
  },
  {
    title: 'What becomes hybrid',
    body: 'The parts where you stay in the loop and AI does the work with you. Faster, still yours.',
    lane: 'lHybrid',
  },
  {
    title: 'What AI can already do',
    body: 'The work a model can take a first pass at today, with you approving it rather than producing it.',
    lane: 'lAgentic',
  },
  {
    title: 'What an agent can run',
    body: 'The workflows that can run end to end without you once they are set up, and what that frees you to do instead.',
    lane: 'lAgentic',
  },
];
