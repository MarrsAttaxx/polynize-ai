'use client';

/**
 * GATE 1 · IDEA (D40, narrowed by D45). ONE decision now: which idea.
 *
 * The ideas come from the inbox (this stream's, newest first) and the box on top takes a fresh
 * one, because ideas arrive "in the flow of my week" and the gate must accept them at the exact
 * moment they exist. Typing in the box deselects the list; picking from the list clears the box:
 * one idea is the input, never a blend.
 *
 * THE LANE PICKER IS GONE when you arrive from a stream, which is now the only way in: you got
 * here from that person's board, so asking whose narrative it is would be asking a question the
 * click already answered. It still appears when there is no stream in the url, so the screen
 * cannot become unreachable if something links to it bare.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { streamLabel } from '@/lib/marketing/streams';
import { USE_CASES, guessUseCase } from '@/lib/marketing/use-case';
import g from '../gates.module.css';

export type IdeaRow = { id: string; lane: string; text: string; when: string };

export function NewNarrative({
  ideas,
  streams,
  fixedLane,
}: {
  ideas: IdeaRow[];
  /** Every stream, for the fallback picker. */
  streams: { id: string; label: string }[];
  /** The stream we came from. When set, there is nothing to pick. */
  fixedLane?: string;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [chosenLane, setChosenLane] = useState<string | null>(null);
  const lane = fixedLane ?? chosenLane;

  const chosenText = typed.trim() || ideas.find((i) => i.id === picked)?.text || '';
  const ready = chosenText !== '' && lane !== null;

  /**
   * THE USE CASE (D96): what this Story is about and for whom. April's suggestion comes from the
   * idea's own words and is shown pre-selected; a click changes it. Nothing is stored until Develop,
   * and the Story screen can change it again, so this is a default and not a commitment.
   */
  const [pickedUseCase, setPickedUseCase] = useState<string | null>(null);
  const suggested = chosenText ? guessUseCase(chosenText) : undefined;
  const useCase = pickedUseCase ?? suggested ?? null;

  const develop = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/console/marketing/narrative/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          lane,
          idea: chosenText,
          idea_ref: typed.trim() ? undefined : (picked ?? undefined),
          use_case: useCase ?? undefined,
        }),
      });
      const b = (await res.json().catch(() => null)) as { id?: string; error?: string } | null;
      if (!res.ok || !b?.id) {
        setErr(b?.error ?? 'Could not create the narrative.');
        setBusy(false);
        return;
      }
      router.push(`/console/marketing/narrative/${b.id}`);
    } catch {
      setErr('Network error. Try again.');
      setBusy(false);
    }
  };

  return (
    <div className={g.app}>
      <div className={g.top}>
        <span className={g.where}>
          Gate 1 · Idea{fixedLane ? ` · ${streamLabel(fixedLane)}` : ''}
        </span>
      </div>

      <textarea
        className={g.newidea}
        rows={2}
        placeholder="What's your idea?"
        value={typed}
        onChange={(e) => {
          setTyped(e.target.value);
          if (e.target.value.trim()) setPicked(null);
        }}
        disabled={busy}
      />

      {ideas.map((i) => (
        <button
          key={i.id}
          type="button"
          className={`${g.idea} ${picked === i.id ? g.ideaOn : ''}`}
          onClick={() => {
            setPicked(i.id);
            setTyped('');
          }}
          disabled={busy}
        >
          {i.text}
          <span className={g.meta}>caught {i.when}</span>
        </button>
      ))}

      {fixedLane ? null : (
        <div className={g.lanes}>
          {streams.map((st) => (
            <button
              key={st.id}
              type="button"
              className={`${g.lane} ${lane === st.id ? g.laneOn : ''}`}
              onClick={() => setChosenLane(st.id)}
              disabled={busy}
            >
              {st.label}
            </button>
          ))}
        </div>
      )}

      <p className={g.useCaseHead}>
        Who is this for?
        {suggested && !pickedUseCase ? <span className={g.meta}> suggested from the idea</span> : null}
      </p>
      <div className={g.useCases}>
        {USE_CASES.map((u) => (
          <button
            key={u.id}
            type="button"
            className={`${g.useCase} ${useCase === u.id ? g.useCaseOn : ''}`}
            onClick={() => setPickedUseCase(u.id)}
            disabled={busy}
            title={u.hint}
          >
            {u.label}
          </button>
        ))}
      </div>

      {err ? <p className={g.err}>{err}</p> : null}

      <div className={g.bar}>
        <button type="button" className={g.go} onClick={develop} disabled={!ready || busy}>
          {busy
            ? 'Creating…'
            : !chosenText
              ? 'Pick an idea'
              : !lane
                ? 'Pick whose it is'
                : 'Develop →'}
        </button>
      </div>
    </div>
  );
}
