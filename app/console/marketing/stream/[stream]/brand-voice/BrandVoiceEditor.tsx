'use client';

/**
 * Edit a stream's brand-voice doc (D20). Explicit Save (a settings doc, not a
 * live draft), PUT to ./save; the button reflects dirty/saving/saved. Path-relative
 * so it works on pam.polynize.ai and www/console.
 */

import { useState } from 'react';
import s from './brand-voice.module.css';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function BrandVoiceEditor({ initial }: { initial: string }) {
  const [md, setMd] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);

  const dirty = md !== saved;

  const save = async () => {
    if (state === 'saving' || !dirty) return;
    setState('saving');
    setError(null);
    try {
      const url = window.location.pathname.replace(/\/+$/, '') + '/save';
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ md }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(b?.error ?? 'Could not save.');
        setState('error');
        return;
      }
      setSaved(md);
      setState('saved');
    } catch {
      setError('Network error. Try again.');
      setState('error');
    }
  };

  const label =
    state === 'saving'
      ? 'Saving…'
      : dirty
        ? 'Save'
        : state === 'saved'
          ? 'Saved ✓'
          : 'Saved';

  return (
    <div className={s.editor}>
      <textarea
        className={s.doc}
        value={md}
        spellCheck={false}
        placeholder="Paste this stream's brand-voice doc here (who they are, their point of view, how they communicate, their audience). Run Marrs's brand-voice builder prompt to generate it, then paste the result."
        onChange={(e) => {
          setMd(e.target.value);
          if (state !== 'idle') setState('idle');
        }}
        aria-label="Brand voice document"
      />
      {/* WHAT MAKES A VOICE DOC ACTUALLY WORK. Shown here because the doc is freeform, so
          what goes in it decides how well every draft in this stream reads, and the single
          biggest difference is whether it contains real sentences or only adjectives. */}
      <details className={s.guide}>
        <summary>What makes a voice doc actually work</summary>
        <p>
          The drafting prompt reads this doc on every piece in this stream. The one thing that
          moves output most is <strong>real sentences in the voice</strong>. A writer can
          imitate a line; it can only approximate an adjective, so &ldquo;direct and
          warm&rdquo; produces far less than three sentences that sound like you.
        </p>
        <ul>
          <li>
            <strong>Five to ten lines you would actually say.</strong> Pull them from posts,
            transcripts or emails, quoted exactly. This is the highest-value section by a
            distance.
          </li>
          <li>
            <strong>Words and phrases you reach for</strong>, and ones you never use.
          </li>
          <li>
            <strong>Sentence length and rhythm.</strong> Short and clipped, or longer and
            considered?
          </li>
          <li>
            <strong>How you open.</strong> Straight into the claim, a question, a story?
          </li>
          <li>
            <strong>Your point of view</strong>, meaning what you argue that others in your
            field do not.
          </li>
          <li>
            <strong>Who you are talking to</strong>, and what they already know.
          </li>
        </ul>
        <p>
          Sample lines demonstrate <em>sound</em>, not subject matter. The prompt is told not
          to reuse what they are about.
        </p>
      </details>

      <div className={s.actions}>
        <button type="button" className={s.save} onClick={save} disabled={!dirty || state === 'saving'}>
          {label}
        </button>
        {error ? <span className={s.error}>{error}</span> : null}
      </div>
    </div>
  );
}
