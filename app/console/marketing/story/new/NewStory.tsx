'use client';

/**
 * GATE 1 · IDEA (D40). One screen, two decisions: which idea, which lane.
 *
 * The ideas come from the inbox (both lanes merged, newest first) and the box on top
 * takes a fresh one, because ideas arrive "in the flow of my week" and the gate must
 * accept them at the exact moment they exist. Typing in the box deselects the list;
 * picking from the list clears the box: one idea is the input, never a blend.
 *
 * The lane decision is the fork that sets channels, voice and CTA downstream, so it
 * happens here, before a single word is drafted. Marrs is opinion in his own voice;
 * Polynize is educational. He knows what they are, so the buttons say only the names,
 * taken from streamLabel so the board and this screen cannot disagree.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { streamLabel } from '@/lib/marketing/streams';
import g from '../gates.module.css';

export type IdeaRow = { id: string; lane: string; text: string; when: string };

export function NewStory({ ideas }: { ideas: IdeaRow[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lane, setLane] = useState<'marrs' | 'polynize' | null>(null);

  const chosenText = typed.trim() || ideas.find((i) => i.id === picked)?.text || '';
  const ready = chosenText !== '' && lane !== null;

  const develop = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/console/marketing/story/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          lane,
          idea: chosenText,
          idea_ref: typed.trim() ? undefined : (picked ?? undefined),
        }),
      });
      const b = (await res.json().catch(() => null)) as { id?: string; error?: string } | null;
      if (!res.ok || !b?.id) {
        setErr(b?.error ?? 'Could not create the story.');
        setBusy(false);
        return;
      }
      router.push(`/console/marketing/story/${b.id}`);
    } catch {
      setErr('Network error. Try again.');
      setBusy(false);
    }
  };

  return (
    <div className={g.app}>
      <div className={g.top}>
        <span className={g.where}>Gate 1 · Idea</span>
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

      <div className={g.lanes}>
        <button
          type="button"
          className={`${g.lane} ${lane === 'marrs' ? g.laneOn : ''}`}
          onClick={() => setLane('marrs')}
          disabled={busy}
        >
          {streamLabel('marrs')}
        </button>
        <button
          type="button"
          className={`${g.lane} ${lane === 'polynize' ? g.laneOn : ''}`}
          onClick={() => setLane('polynize')}
          disabled={busy}
        >
          {streamLabel('polynize')}
        </button>
      </div>

      {err ? <p className={g.err}>{err}</p> : null}

      <div className={g.bar}>
        <button type="button" className={g.go} onClick={develop} disabled={!ready || busy}>
          {busy
            ? 'Creating…'
            : !chosenText
              ? 'Pick an idea'
              : !lane
                ? 'Pick a lane'
                : 'Develop →'}
        </button>
      </div>
    </div>
  );
}
