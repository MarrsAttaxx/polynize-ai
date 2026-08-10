'use client';

/**
 * ONE EPISODE, and the clips being mined out of it.
 *
 * The screen is built around one instruction from Marrs, after reviewing the first clip ever
 * assembled: **"Operator review = a readable TEXT BLOCK, not an EDL."** He is judging whether sixty
 * seconds plays as a single coherent thought, and timecodes actively obstruct that judgment. So each
 * clip is presented as the hook labelled at the top and then the body as flowing prose IN PLAY ORDER,
 * which is the words as they will actually be heard. The timecoded EDL is for the assembly engine and
 * is folded away behind a disclosure for when something needs debugging.
 *
 * The order of the page follows the order of the work: get the transcript, propose, rule, cut.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { clipAsProse, type ClipProposal, type PodcastEpisode } from '@/lib/marketing/podcast-store';
import s from '../../piece/[id]/script.module.css';
import d from '../podcast.module.css';

type Project = { id: string; name: string; updated_at?: string };

type Props = {
  episode: Omit<PodcastEpisode, 'transcript'> & { transcript_present: boolean };
  descriptConnected: boolean;
};

const STATUS_LABEL: Record<ClipProposal['status'], string> = {
  proposed: 'proposed',
  approved: 'approved',
  rejected: 'rejected',
  assembling: 'cutting',
  assembled: 'cut',
};

export function EpisodeScreen({ episode, descriptConnected }: Props) {
  const [ep, setEp] = useState(episode);
  const [clips, setClips] = useState<ClipProposal[]>(episode.clips);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Transcript
  const [paste, setPaste] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [pulling, setPulling] = useState(false);
  const [transcript, setTranscript] = useState({
    present: episode.transcript_present,
    chars: episode.transcript_chars ?? 0,
    source: episode.transcript_source,
    anchors: -1,
  });

  // Proposing
  const [working, setWorking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [think, setThink] = useState<{ phase: 'thinking' | 'writing'; text: string } | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [showEdl, setShowEdl] = useState<string | null>(null);

  const base = `/console/marketing/podcast/${ep.episode_id}`;

  useEffect(() => {
    if (!working) {
      setElapsed(0);
      setThink(null);
      return;
    }
    setElapsed(0);
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [working]);

  /** Pull the Descript project list once, on demand. */
  const loadProjects = async () => {
    if (projects) return;
    try {
      const res = await fetch(`/console/marketing/podcast/episodes`);
      const b = (await res.json().catch(() => null)) as
        | { projects?: Project[]; error?: string }
        | null;
      if (b?.error) setError(b.error);
      setProjects(b?.projects ?? []);
    } catch {
      setProjects([]);
      setError('Could not reach Descript.');
    }
  };

  const saveTranscript = async (payload: Record<string, unknown>) => {
    setPulling(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(`${base}/transcript`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const b = (await res.json().catch(() => null)) as {
        source?: 'pasted' | 'descript';
        chars?: number;
        anchors?: number;
        warning?: string;
        error?: string;
      } | null;
      if (!res.ok || !b?.chars) {
        setError(b?.error ?? 'Could not save the transcript.');
        return;
      }
      setTranscript({
        present: true,
        chars: b.chars,
        source: b.source,
        anchors: b.anchors ?? -1,
      });
      if (typeof payload.descript_project_id === 'string') {
        setEp((e) => ({ ...e, descript_project_id: payload.descript_project_id as string }));
      }
      setPaste('');
      setShowPaste(false);
      setNote(b.warning ?? `Transcript in: ${b.chars.toLocaleString()} characters.`);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setPulling(false);
    }
  };

  /** Ask April for proposals, reading her progress as it arrives. */
  const propose = async () => {
    if (working) return;
    setWorking(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(`${base}/propose`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stream: true }),
      });
      if (!res.ok || !res.body || !(res.headers.get('content-type') ?? '').includes('ndjson')) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(b?.error ?? 'Could not reach her.');
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let ev: {
            t?: string;
            phase?: 'thinking' | 'writing';
            d?: string;
            error?: string;
            added?: number;
            kept?: number;
            clips?: ClipProposal[];
            model?: string;
          };
          try {
            ev = JSON.parse(line) as typeof ev;
          } catch {
            continue;
          }
          if (ev.t === 'think') setThink({ phase: ev.phase ?? 'thinking', text: ev.d ?? '' });
          else if (ev.t === 'err') setError(ev.error ?? 'She could not finish that.');
          else if (ev.t === 'ok') {
            if (ev.clips) setClips(ev.clips);
            if (ev.model) setModel(ev.model);
            setNote(
              `${ev.added ?? 0} clip${ev.added === 1 ? '' : 's'} proposed${
                ev.kept ? `, ${ev.kept} you had already ruled on kept as they were` : ''
              }.`
            );
          }
        }
      }
    } catch {
      setError('Network error. Try again.');
    } finally {
      setWorking(false);
    }
  };

  const rule = async (clip: ClipProposal, status: ClipProposal['status']) => {
    setError(null);
    try {
      const res = await fetch(`${base}/clip`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clip_id: clip.clip_id, status }),
      });
      const b = (await res.json().catch(() => null)) as
        | { clips?: ClipProposal[]; error?: string }
        | null;
      if (!res.ok || !b?.clips) {
        setError(b?.error ?? 'Could not save that.');
        return;
      }
      setClips(b.clips);
    } catch {
      setError('Network error. Try again.');
    }
  };

  const cut = async (clip: ClipProposal) => {
    setError(null);
    setNote(null);
    try {
      const res = await fetch(`${base}/clip`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clip_id: clip.clip_id }),
      });
      const b = (await res.json().catch(() => null)) as
        | { clips?: ClipProposal[]; error?: string }
        | null;
      if (b?.clips) setClips(b.clips);
      if (!res.ok) {
        setError(b?.error ?? 'Descript would not take the cut.');
        return;
      }
      setNote('Descript is cutting it. This takes a few minutes.');
    } catch {
      setError('Network error. Try again.');
    }
  };

  /**
   * Poll any cut that is running.
   *
   * One interval for the whole page rather than one per clip: several cuts can be in flight at once
   * and a timer per card would multiply the requests for no benefit.
   */
  const poll = useCallback(async () => {
    const running = clips.filter((c) => c.status === 'assembling');
    if (running.length === 0) return;
    for (const c of running) {
      try {
        const res = await fetch(`${base}/clip?clip_id=${encodeURIComponent(c.clip_id)}`);
        const b = (await res.json().catch(() => null)) as
          | { clips?: ClipProposal[]; state?: string; error?: string }
          | null;
        if (b?.clips) setClips(b.clips);
        if (b?.state === 'approved' && b.error) setError(b.error);
      } catch {
        // A failed poll is not a failed cut; the next tick tries again.
      }
    }
  }, [clips, base]);

  const polling = useRef(false);
  useEffect(() => {
    if (!clips.some((c) => c.status === 'assembling')) return;
    const t = setInterval(() => {
      if (polling.current) return;
      polling.current = true;
      void poll().finally(() => {
        polling.current = false;
      });
    }, 8000);
    return () => clearInterval(t);
  }, [clips, poll]);

  const ordered = clips.slice().sort((a, b) => a.rank - b.rank);
  const live = ordered.filter((c) => c.status !== 'rejected');
  const dropped = ordered.filter((c) => c.status === 'rejected');

  return (
    <div className={s.root}>
      <div className={d.head}>
        <Link href="/console/marketing/podcast" className={d.back}>
          ← Episodes
        </Link>
        <div className={d.eyebrow}>{ep.number ? `Episode ${ep.number}` : 'Episode'}</div>
        <h1 className={d.title}>{ep.title}</h1>
        {ep.guest ? <p className={d.sub}>with {ep.guest}</p> : null}
      </div>

      {error ? <p className={d.error}>{error}</p> : null}
      {note ? <p className={d.note}>{note}</p> : null}

      {/* SOURCE. The transcript is the only input the method needs, so it comes first and says
          plainly whether it is in. */}
      <section className={d.panel}>
        <h2 className={d.panelTitle}>Source</h2>
        {transcript.present ? (
          <p className={d.status}>
            <b>Transcript in.</b> {transcript.chars.toLocaleString()} characters
            {transcript.source === 'descript' ? ', pulled from Descript' : ', pasted'}
            {transcript.anchors === 0 ? ' (no timecodes, so clips cannot be cut automatically)' : ''}
            .
          </p>
        ) : (
          <p className={d.status}>
            No transcript yet. Pull it from Descript, or paste one to get proposals now.
          </p>
        )}

        <div className={d.row}>
          {descriptConnected ? (
            <button
              type="button"
              className={d.btn}
              onClick={() => void loadProjects()}
              disabled={pulling}
            >
              {ep.descript_project_id ? 'Change Descript project' : 'Choose Descript project'}
            </button>
          ) : (
            <span className={d.warn}>
              Descript is not connected, so pasting is the only way in for now.
            </span>
          )}
          {ep.descript_project_id ? (
            <button
              type="button"
              className={d.btn}
              onClick={() => void saveTranscript({ descript_project_id: ep.descript_project_id })}
              disabled={pulling}
            >
              {pulling ? 'Pulling…' : 'Pull transcript'}
            </button>
          ) : null}
          <button
            type="button"
            className={d.ghostBtn}
            onClick={() => setShowPaste((v) => !v)}
            disabled={pulling}
          >
            {showPaste ? 'Cancel paste' : 'Paste a transcript'}
          </button>
        </div>

        {projects ? (
          <div className={d.projects}>
            {projects.length === 0 ? (
              <p className={d.hint}>No Descript projects came back.</p>
            ) : (
              projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`${d.project} ${ep.descript_project_id === p.id ? d.projectOn : ''}`}
                  onClick={() => void saveTranscript({ descript_project_id: p.id })}
                  disabled={pulling}
                >
                  {p.name}
                </button>
              ))
            )}
          </div>
        ) : null}

        {showPaste ? (
          <div className={d.pasteBox}>
            <textarea
              className={d.paste}
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder="Paste the full transcript, timecodes included. The [HH:MM:SS] anchors are what let the cut be executed later."
              rows={8}
            />
            <button
              type="button"
              className={d.btn}
              onClick={() => void saveTranscript({ transcript: paste })}
              disabled={pulling || paste.trim().length < 400}
            >
              {pulling ? 'Saving…' : 'Use this transcript'}
            </button>
          </div>
        ) : null}
      </section>

      {/* THE ASK. One button, because the method is not configurable: it is Marrs's own editorial
          judgment written down, and the place to disagree with a result is the clip, not a setting. */}
      <section className={d.panel}>
        <div className={d.panelHead}>
          <h2 className={d.panelTitle}>Clips</h2>
          {model ? <span className={d.model}>found by {model}</span> : null}
        </div>
        <div className={d.row}>
          <button
            type="button"
            className={d.primaryBtn}
            onClick={() => void propose()}
            disabled={working || !transcript.present}
          >
            {working ? `Working… ${elapsed}s` : clips.length ? 'Propose more clips' : 'Propose clips'}
          </button>
        </div>

        {working ? (
          <div className={d.working}>
            <p className={d.workingHead}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={d.workingMark}
                src="/console-assets/mark-loop.png"
                alt=""
                width={18}
                height={18}
              />
              <b>{think?.phase === 'writing' ? 'writing them up' : 'reading the episode'}</b>
              {elapsed}s
            </p>
            <p className={d.stream}>
              {think?.text ? (
                <span>{think.text}</span>
              ) : (
                <em>
                  {elapsed < 15
                    ? 'a full episode takes a couple of minutes to work through'
                    : 'still going'}
                </em>
              )}
            </p>
          </div>
        ) : (
          <p className={d.hint}>
            Proposing again keeps everything you have already approved, cut or rejected, and adds to
            it. Nothing you have ruled on gets overwritten.
          </p>
        )}

        {live.length === 0 && !working ? (
          <p className={d.hint}>Nothing proposed yet.</p>
        ) : null}

        {live.map((c) => {
          const prose = clipAsProse(c);
          const mins = Math.floor(c.est_duration_seconds / 60);
          const secs = c.est_duration_seconds % 60;
          return (
            <article key={c.clip_id} className={d.clip}>
              <div className={d.clipHead}>
                <span className={d.rank}>{c.rank}</span>
                <h3 className={d.clipTitle}>{c.title}</h3>
                <span className={`${d.badge} ${d[`badge_${c.status}`] ?? ''}`}>
                  {STATUS_LABEL[c.status]}
                </span>
                <span className={d.dur}>
                  {mins ? `${mins}m ` : ''}
                  {secs}s
                </span>
              </div>

              {c.theme ? <p className={d.theme}>{c.theme}</p> : null}
              {c.why_strong ? <p className={d.why}>{c.why_strong}</p> : null}

              {/* THE REVIEW ITSELF: the words in the order they will be heard. */}
              <div className={d.readable}>
                <p className={d.hookLabel}>Hook</p>
                <p className={d.hookLine}>{prose.hook}</p>
                {prose.body ? (
                  <>
                    <p className={d.bodyLabel}>Then</p>
                    <p className={d.bodyLine}>{prose.body}</p>
                  </>
                ) : null}
              </div>

              {c.platforms?.length ? (
                <p className={d.platforms}>{c.platforms.join(' · ')}</p>
              ) : null}
              {c.cuts_made ? <p className={d.cuts}>Cut: {c.cuts_made}</p> : null}
              {c.assembly_error ? <p className={d.error}>{c.assembly_error}</p> : null}
              {/* THE ONE STEP AUTOMATION CANNOT DO. A landscape source has to be reframed to 9:16
                  with speaker tracking, and that is a manual toggle in Descript. Said out loud
                  because a clip that merely LOOKS finished is the dangerous outcome: published with
                  a speaker cropped out of shot. */}
              {c.needs_reframe ? (
                <p className={d.manual}>
                  Not publishable yet. The source is{' '}
                  {c.source_aspect === '16:9' ? 'landscape' : 'not vertical'}, so open this in
                  Descript and switch on <b>Center active speaker</b> under Look Good. About thirty
                  seconds, and a static crop will cut a speaker out of frame on a two-person episode.
                </p>
              ) : null}

              <div className={d.row}>
                {c.status === 'proposed' ? (
                  <>
                    <button type="button" className={d.btn} onClick={() => void rule(c, 'approved')}>
                      Approve
                    </button>
                    <button
                      type="button"
                      className={d.ghostBtn}
                      onClick={() => void rule(c, 'rejected')}
                    >
                      Reject
                    </button>
                  </>
                ) : null}
                {c.status === 'approved' ? (
                  <>
                    <button type="button" className={d.primaryBtn} onClick={() => void cut(c)}>
                      Cut it in Descript
                    </button>
                    <button
                      type="button"
                      className={d.ghostBtn}
                      onClick={() => void rule(c, 'proposed')}
                    >
                      Un-approve
                    </button>
                  </>
                ) : null}
                {c.status === 'assembling' ? <span className={d.cutting}>Cutting…</span> : null}
                {c.descript_url ? (
                  <a
                    className={d.btn}
                    href={c.descript_url}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Open in Descript
                  </a>
                ) : null}
                <button
                  type="button"
                  className={d.ghostBtn}
                  onClick={() => setShowEdl(showEdl === c.clip_id ? null : c.clip_id)}
                >
                  {showEdl === c.clip_id ? 'Hide the cut list' : 'Cut list'}
                </button>
              </div>

              {/* The EDL is for the engine. It is here for debugging a bad cut, not for reviewing. */}
              {showEdl === c.clip_id ? (
                <ol className={d.edl}>
                  {c.edl.map((span, i) => (
                    <li key={`${c.clip_id}-${i}`}>
                      <code>{span.at || 'no timecode'}</code> {span.text}
                      {span.cut_note ? <em> — {span.cut_note}</em> : null}
                    </li>
                  ))}
                </ol>
              ) : null}
            </article>
          );
        })}

        {dropped.length ? (
          <details className={d.dropped}>
            <summary>
              {dropped.length} rejected
            </summary>
            {dropped.map((c) => (
              <div key={c.clip_id} className={d.droppedRow}>
                <span>{c.title}</span>
                <button type="button" className={d.ghostBtn} onClick={() => void rule(c, 'proposed')}>
                  Put back
                </button>
              </div>
            ))}
          </details>
        ) : null}
      </section>
    </div>
  );
}
