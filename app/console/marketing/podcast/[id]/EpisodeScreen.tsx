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
import {
  clipAsProse,
  DEFAULT_CLIP_STYLE,
  type ClipProposal,
  type ClipStyle,
  type PodcastEpisode,
} from '@/lib/marketing/podcast-store';
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
  /**
   * THE REVISION LOOP, one clip at a time.
   *
   * Marrs asked for the prezie loop in here: "the ability to read, alter, or give a bit more direction
   * on the clip." One box open at a time and one call in flight, because a revision replaces the cut he
   * is looking at and two overlapping ones would race for the same clip.
   */
  const [openBox, setOpenBox] = useState<string | null>(null);
  const [direction, setDirection] = useState('');
  const [busyClip, setBusyClip] = useState<string | null>(null);
  /** Her reply about the last revision, per clip. Cleared when a new revision starts. */
  const [replies, setReplies] = useState<Record<string, string>>({});
  /** The house standard, edited here and inherited by every clip cut from this episode. */
  const [style, setStyle] = useState<ClipStyle>({ ...DEFAULT_CLIP_STYLE, ...(episode.style ?? {}) });
  const [showStyle, setShowStyle] = useState(false);

  const base = `/console/marketing/podcast/${ep.episode_id}`;

  const inFlight = working || busyClip !== null;
  useEffect(() => {
    if (!inFlight) {
      setElapsed(0);
      setThink(null);
      return;
    }
    setElapsed(0);
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [inFlight]);

  /**
   * Read one of the console's newline-delimited progress streams.
   *
   * Shared by proposing and revising rather than written twice: they are the same protocol, and two
   * copies of a stream reader is two places for a partial-line bug to hide.
   */
  const readStream = async (
    res: Response,
    onOk: (ev: Record<string, unknown>) => void
  ): Promise<string | null> => {
    if (!res.ok || !res.body || !(res.headers.get('content-type') ?? '').includes('ndjson')) {
      const b = (await res.json().catch(() => null)) as { error?: string } | null;
      return b?.error ?? 'Could not reach her.';
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let failed: string | null = null;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let ev: Record<string, unknown>;
        try {
          ev = JSON.parse(line) as Record<string, unknown>;
        } catch {
          continue;
        }
        if (ev.t === 'think') {
          setThink({
            phase: (ev.phase as 'thinking' | 'writing') ?? 'thinking',
            text: (ev.d as string) ?? '',
          });
        } else if (ev.t === 'err') {
          failed = (ev.error as string) ?? 'She could not finish that.';
        } else if (ev.t === 'ok') {
          onOk(ev);
        }
      }
    }
    return failed;
  };

  /** Ask April to re-cut one clip. */
  const revise = async (clip: ClipProposal) => {
    const said = direction.trim();
    if (!said || busyClip) return;
    setBusyClip(clip.clip_id);
    setError(null);
    setNote(null);
    setReplies((r) => {
      const { [clip.clip_id]: _drop, ...rest } = r;
      return rest;
    });
    try {
      const res = await fetch(`${base}/clip/revise`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clip_id: clip.clip_id, direction: said, stream: true }),
      });
      const failed = await readStream(res, (ev) => {
        if (Array.isArray(ev.clips)) setClips(ev.clips as ClipProposal[]);
        if (typeof ev.model === 'string') setModel(ev.model);
        if (typeof ev.note === 'string') {
          setReplies((r) => ({ ...r, [clip.clip_id]: ev.note as string }));
        }
        setDirection('');
      });
      if (failed) setError(failed);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusyClip(null);
    }
  };

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

  /** Declare that the export is already composed for a centre crop. */
  const setPreFramed = async (on: boolean) => {
    setEp((e) => ({ ...e, pre_framed: on }));
    try {
      const res = await fetch(`${base}/transcript`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pre_framed: on }),
      });
      if (!res.ok) {
        // Put it back rather than leave the checkbox lying about what the server holds.
        setEp((e) => ({ ...e, pre_framed: !on }));
        setError('Could not save that.');
      }
    } catch {
      setEp((e) => ({ ...e, pre_framed: !on }));
      setError('Network error. Try again.');
    }
  };

  /** Save the house standard. Debounced by the caller committing on blur rather than per keystroke. */
  const saveStyle = async (next: ClipStyle) => {
    setStyle(next);
    try {
      const res = await fetch(`${base}/transcript`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ style: next }),
      });
      if (!res.ok) setError('Could not save the clip standard.');
    } catch {
      setError('Network error. Try again.');
    }
  };

  /** Delete a clip, and by default stop her proposing that section again. */
  const removeClip = async (clip: ClipProposal) => {
    if (
      !window.confirm(
        `Delete "${clip.title}"?\n\nShe will not propose that section again. Anything already cut stays in Descript.`
      )
    ) {
      return;
    }
    setError(null);
    setNote(null);
    try {
      const res = await fetch(`${base}/clip`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clip_id: clip.clip_id, remember: true }),
      });
      const b = (await res.json().catch(() => null)) as
        | { clips?: ClipProposal[]; note?: string; error?: string }
        | null;
      if (!res.ok || !b?.clips) {
        setError(b?.error ?? 'Could not delete it.');
        return;
      }
      setClips(b.clips);
      setNote(b.note ?? 'Deleted.');
    } catch {
      setError('Network error. Try again.');
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
      const failed = await readStream(res, (ev) => {
        if (Array.isArray(ev.clips)) setClips(ev.clips as ClipProposal[]);
        if (typeof ev.model === 'string') setModel(ev.model);
        const added = Number(ev.added ?? 0);
        const kept = Number(ev.kept ?? 0);
        setNote(
          `${added} clip${added === 1 ? '' : 's'} proposed${
            kept ? `, ${kept} you had already ruled on kept as they were` : ''
          }.`
        );
      });
      if (failed) setError(failed);
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

  const cut = async (clip: ClipProposal, action: 'cut' | 'finish' = 'cut') => {
    setError(null);
    setNote(null);
    try {
      const res = await fetch(`${base}/clip`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clip_id: clip.clip_id, action }),
      });
      const b = (await res.json().catch(() => null)) as
        | { clips?: ClipProposal[]; error?: string }
        | null;
      if (b?.clips) setClips(b.clips);
      if (!res.ok) {
        setError(b?.error ?? 'Descript would not take the cut.');
        return;
      }
      setNote(
        action === 'finish'
          ? 'Descript is adding the title and captions. This takes a few minutes.'
          : 'Descript is cutting it. This takes a few minutes.'
      );
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

        {/* THE FRAMING DECLARATION. Not detectable and not guessable: a landscape frame gives no clue
            whether its subjects were placed for a vertical crop. Only the person who made the export
            knows, so he says it once per episode and every clip inherits it. */}
        <label className={d.check}>
          <input
            type="checkbox"
            checked={Boolean(ep.pre_framed)}
            onChange={(e) => void setPreFramed(e.target.checked)}
            disabled={pulling}
          />
          <span>
            <b>Already framed for vertical.</b> The 16:9 export has both speakers in the centre, so a
            straight centre crop keeps them both and no speaker tracking is needed. Tick this for a
            Final Cut export composed for shorts; leave it clear for a raw landscape recording.
          </span>
        </label>

        {/* THE HOUSE STANDARD. "Preferably, when I open it, it's already done, and I can set a
            standard for that." So the finish is configuration, set once and inherited by every clip. */}
        <button
          type="button"
          className={d.ghostBtn}
          style={{ marginTop: 14 }}
          onClick={() => setShowStyle((v) => !v)}
        >
          {showStyle ? 'Hide the clip standard' : 'Clip standard'}
        </button>
        {showStyle ? (
          <div className={d.styleBox}>
            <label className={d.check}>
              <input
                type="checkbox"
                checked={style.remove_filler}
                onChange={(e) => void saveStyle({ ...style, remove_filler: e.target.checked })}
              />
              <span>
                <b>Cut filler words.</b> Runs Descript&apos;s own filler removal over the clip.
              </span>
            </label>
            <label className={d.check}>
              <input
                type="checkbox"
                checked={style.remove_silences}
                onChange={(e) => void saveStyle({ ...style, remove_silences: e.target.checked })}
              />
              <span>
                <b>Close the silences.</b> Takes out the dead air within and between the spans so it
                plays as one thought.
              </span>
            </label>
            <label className={d.check}>
              <input
                type="checkbox"
                checked={style.captions}
                onChange={(e) => void saveStyle({ ...style, captions: e.target.checked })}
              />
              <span>
                <b>Burned-in captions.</b> Continuous, lower third, plain white, no karaoke.
              </span>
            </label>
            <div className={d.styleRow}>
              <span className={d.styleLabel}>Title held for</span>
              <input
                className={d.styleNum}
                type="number"
                min={0}
                max={15}
                value={style.title_seconds}
                onChange={(e) =>
                  setStyle({ ...style, title_seconds: Number(e.target.value) || 0 })
                }
                onBlur={() => void saveStyle(style)}
                aria-label="Title seconds"
              />
              <span className={d.styleLabel}>seconds, centred. 0 for no title.</span>
            </div>
            <div className={d.styleRow}>
              <span className={d.styleLabel}>Music bed</span>
              <input
                className={d.styleText}
                value={style.music_file ?? ''}
                onChange={(e) => setStyle({ ...style, music_file: e.target.value })}
                onBlur={() => void saveStyle(style)}
                placeholder="Clip Bed.wav"
                aria-label="Music file name"
              />
              <span className={d.styleLabel}>at</span>
              <input
                className={d.styleNum}
                type="number"
                min={-60}
                max={0}
                value={style.music_gain_db ?? -20}
                onChange={(e) =>
                  setStyle({ ...style, music_gain_db: Number(e.target.value) || -20 })
                }
                onBlur={() => void saveStyle(style)}
                aria-label="Music level in dB"
              />
              <span className={d.styleLabel}>dB</span>
            </div>
            <p className={d.hint}>
              The music file has to be in the Descript project already: drop it into the project once
              and put its exact filename here. If she cannot find it she adds no music and says so,
              rather than substituting a different track.
            </p>
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
              {/* The words on this card have changed since the video was cut. Said rather than fixed:
                  deleting a composition in Descript is not this system's call, and a new cut list
                  sitting beside a link to the old video is the more dangerous state. */}
              {/* WHAT THE FINISH ACTUALLY DID. Reported rather than assumed, because the combined pass
                  claimed a title and captions that were not on the timeline. */}
              {c.finish ? (
                <p className={c.finish.captions === false || c.finish.title === false ? d.manual : d.finishLine}>
                  {[
                    c.finish.title === true ? 'title on' : c.finish.title === false ? 'NO title' : null,
                    c.finish.captions === true
                      ? 'captions on'
                      : c.finish.captions === false
                        ? 'NO captions'
                        : null,
                    c.finish.music === true
                      ? 'music bed on'
                      : c.finish.music === false
                        ? 'music file not found'
                        : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Finished, but it did not say what it did.'}
                </p>
              ) : null}
              {c.recut_needed ? (
                <p className={d.manual}>
                  This has changed since it was cut, so the composition in Descript is the OLD version.
                  Cut it again when you are happy with the words below.
                </p>
              ) : null}
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
                {c.status === 'assembling' ? (
                  <span className={d.cutting}>
                    {c.stage === 'finishing' ? 'Adding title and captions…' : 'Cutting…'}
                  </span>
                ) : null}
                {/* THE FINISH PASS, on its own button. A missed caption track needs the finish run
                    again, not the whole clip re-cut, which would cost the credits twice. */}
                {c.status === 'assembled' ? (
                  <button
                    type="button"
                    className={d.btn}
                    onClick={() => void cut(c, 'finish')}
                    disabled={busyClip !== null}
                    title="Add the title, captions and music bed to the cut"
                  >
                    {c.finish ? 'Redo title and captions' : 'Add title and captions'}
                  </button>
                ) : null}
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
                  onClick={() => {
                    setOpenBox(openBox === c.clip_id ? null : c.clip_id);
                    setDirection('');
                  }}
                  disabled={busyClip !== null}
                >
                  {openBox === c.clip_id ? 'Cancel' : 'Change it'}
                </button>
                <button
                  type="button"
                  className={d.ghostBtn}
                  onClick={() => setShowEdl(showEdl === c.clip_id ? null : c.clip_id)}
                >
                  {showEdl === c.clip_id ? 'Hide the cut list' : 'Cut list'}
                </button>
                <button
                  type="button"
                  className={d.delInline}
                  onClick={() => void removeClip(c)}
                  disabled={c.status === 'assembling' || busyClip !== null}
                  title="Delete this clip and stop her proposing that section again"
                >
                  Delete
                </button>
              </div>

              {/* WHAT HE HAS ALREADY ASKED FOR. Shown because every one of these still applies on the
                  next revision, so he should be able to see them rather than remember them. */}
              {c.directions?.length ? (
                <ol className={d.directions}>
                  {c.directions.map((dir, i) => (
                    <li key={`${c.clip_id}-dir-${i}`}>{dir}</li>
                  ))}
                </ol>
              ) : null}

              {replies[c.clip_id] ? <p className={d.reply}>{replies[c.clip_id]}</p> : null}

              {/* THE REVISION BOX. She gets the whole transcript back, so a direction can send her
                  anywhere in the episode: that is the point of it. */}
              {openBox === c.clip_id ? (
                <div className={d.reviseBox}>
                  <textarea
                    className={d.paste}
                    value={direction}
                    onChange={(e) => setDirection(e.target.value)}
                    placeholder="Tell her what to change. She has the whole episode, so you can send her to a section this clip does not touch yet: for example, later on I name three classes, the AI Addicts, the AI Illiterate and the AI Amplified. Bring a short piece of each into this clip."
                    rows={4}
                    disabled={busyClip !== null}
                    autoFocus
                  />
                  <div className={d.row}>
                    <button
                      type="button"
                      className={d.primaryBtn}
                      onClick={() => void revise(c)}
                      disabled={busyClip !== null || !direction.trim()}
                    >
                      {busyClip === c.clip_id ? `Re-cutting… ${elapsed}s` : 'Re-cut it'}
                    </button>
                  </div>
                  <p className={d.hint}>
                    She only selects and orders real words from the transcript, so she cannot write a
                    linking sentence. If what you are describing is not said anywhere in the episode she
                    will tell you instead of approximating it.
                  </p>
                </div>
              ) : null}

              {busyClip === c.clip_id ? (
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
                    <b>{think?.phase === 'writing' ? 'writing the new cut' : 'searching the episode'}</b>
                    {elapsed}s
                  </p>
                  <p className={d.stream}>
                    {think?.text ? <span>{think.text}</span> : <em>reading the whole transcript</em>}
                  </p>
                </div>
              ) : null}

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
