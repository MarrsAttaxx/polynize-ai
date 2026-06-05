'use client';

/**
 * Sign-in form + confirmation, owned ENTIRELY by client state.
 *
 * Root-cause fix for the recurring "confirmation card only shows after a hard
 * refresh" bug. Previously the confirmation was a server-rendered card gated on
 * a flash cookie set by a Server Action that then redirect()ed; the post-action
 * render did not observe the just-set cookie, so it re-rendered the form (the
 * "flash"), and only a fresh GET (hard refresh) that re-sent the stored cookie
 * showed the card.
 *
 * Here the confirmation is local React state set synchronously on submit, so it
 * appears immediately with no navigation, no cookie, no redirect, and no cache
 * dependency. The email send runs in the background via a non-redirecting
 * server action. There is no server round-trip left for the confirmation to
 * depend on, so it cannot regress to the cookie/redirect/cache failure mode.
 */

import { useState } from 'react';
import { sendMagicLinkAction } from '../_actions';
import s from './sign-in-gate.module.css';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function SignInForm({ initialError }: { initialError?: string }) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | undefined>(initialError);
  const [pending, setPending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setError('invalid_email');
      return;
    }
    setError(undefined);
    setSendFailed(false);
    // Show the confirmation IMMEDIATELY from local state. No navigation, so it
    // cannot be wiped by a redirect/re-render reading a stale cookie.
    setSubmitted(true);
    setPending(true);
    try {
      const res = await sendMagicLinkAction(value);
      if (!res.ok) setSendFailed(true);
    } catch {
      setSendFailed(true);
    } finally {
      setPending(false);
    }
  }

  if (submitted) {
    const shown = email.trim().toLowerCase();
    return (
      <main className={s.gateRoot}>
        <div className={s.gateCard}>
          <div className={s.eyebrow}>§ polynize agentic management console</div>
          <h1 className={s.gateTitle}>
            Check your inbox<span className={s.titleAccent}>.</span>
          </h1>
          <p className={s.gateLede}>
            Sign-in link sent to{' '}
            <span className={s.confirmEmail}>{shown}</span>.
          </p>
          <p className={s.gateMeta}>The link will expire in 15 minutes.</p>
          {sendFailed && (
            <div className={s.gateError} role="alert">
              We could not confirm the send. If the email does not arrive,
              try again.
            </div>
          )}
          <button
            type="button"
            className={s.linkLikeBtn}
            onClick={() => {
              setSubmitted(false);
              setError(undefined);
              setSendFailed(false);
            }}
          >
            Use a different email
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className={s.gateRoot}>
      <form onSubmit={onSubmit} className={s.gateCard}>
        <div className={s.eyebrow}>§ polynize agentic management console</div>
        <h1 className={s.gateTitle}>
          Polynize Agentic Management Console (PAM)
          <span className={s.titleAccent}>.</span>
        </h1>
        <p className={s.gateLede}>
          Sign in with your @polynize.io email to continue.
        </p>
        <input
          type="email"
          name="email"
          required
          autoFocus
          autoComplete="email"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email address"
          aria-invalid={
            error === 'invalid_link' || error === 'invalid_email'
              ? 'true'
              : undefined
          }
          placeholder="you@polynize.io"
          className={s.gateInput}
        />
        {error === 'invalid_link' && (
          <div className={s.gateError} role="alert">
            That sign-in link is invalid or has expired. Please request a new
            one.
          </div>
        )}
        {error === 'invalid_email' && (
          <div className={s.gateError} role="alert">
            That doesn&apos;t look like a valid email address. Please check and
            try again.
          </div>
        )}
        <button type="submit" className={s.gateButton} disabled={pending}>
          Send sign-in link <span className={s.btnArr}>→</span>
        </button>
      </form>
    </main>
  );
}
