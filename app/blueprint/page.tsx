'use client';

import { useEffect, useState } from 'react';
import type { SalesBlueprint } from '@/lib/agents/sales-blueprint-schema';
import { BlueprintDoc } from './BlueprintDoc';
import s from './blueprint.module.css';

type Stage = 'input' | 'loading' | 'done' | 'error';

const LOADING_MESSAGES: { from: number; text: string }[] = [
  { from: 0, text: 'reading the session notes' },
  { from: 8000, text: 'identifying capabilities' },
  { from: 18000, text: 'allocating human, hybrid, agent' },
  { from: 30000, text: 'scoring against what good looks like' },
  { from: 42000, text: 'designing the agent team' },
  { from: 55000, text: 'assembling your blueprint' },
];

const PLACEHOLDER = `Paste the session notes here. For example:

CAPABILITY MAPPING INPUT
Client: ...
Session: ...

BOTTLENECK
...

WORKFLOW WALKTHROUGH
...

CHOKE POINT AND COST
...

INFORMATION SOURCES AND WHERE THEY LIVE
...

JUDGEMENT CALLS AND WHO MAKES THEM
...

WHAT GOOD LOOKS LIKE
...`;

export default function BlueprintPage() {
  const [stage, setStage] = useState<Stage>('input');
  const [payload, setPayload] = useState('');
  const [data, setData] = useState<SalesBlueprint | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0].text);

  useEffect(() => {
    if (stage !== 'loading') return;
    setLoadingMessage(LOADING_MESSAGES[0].text);
    const timers = LOADING_MESSAGES.slice(1).map((m) => setTimeout(() => setLoadingMessage(m.text), m.from));
    return () => timers.forEach(clearTimeout);
  }, [stage]);

  async function mapBottleneck() {
    setStage('loading');
    setErrorDetail(null);
    try {
      const res = await fetch('/api/blueprint-map/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
      });
      const text = await res.text();
      let parsed: { ok: boolean; data?: SalesBlueprint; error?: string; detail?: string } | null = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
      if (parsed && parsed.ok && parsed.data) {
        setData(parsed.data);
        setStage('done');
        return;
      }
      setErrorDetail(parsed?.detail ?? parsed?.error ?? `Server returned HTTP ${res.status}: ${text.slice(0, 200)}`);
      setStage('error');
    } catch (e) {
      setErrorDetail(e instanceof Error ? e.message : 'Network error');
      setStage('error');
    }
  }

  function restart() {
    setData(null);
    setStage('input');
  }

  if (stage === 'done' && data) {
    return (
      <div className={s.wrap}>
        <BlueprintDoc initialData={data} onRestart={restart} />
      </div>
    );
  }

  return (
    <div className={s.wrap}>
      {stage === 'input' && (
        <div className={s.inputStage}>
          <div className={s.inputCard}>
            <div className={s.eyebrow}>Polynize · capability mapping</div>
            <h1 className={s.inputTitle}>Enter your bottleneck.</h1>
            <p className={s.inputSub}>
              Paste the working-session notes for the client. The map will read them, decompose the
              work into capabilities, allocate each to human, hybrid, or agent, and extend the picture
              into benchmarks, a transformation plan, and a proposed team.
            </p>
            <textarea
              className={s.textarea}
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              placeholder={PLACEHOLDER}
              spellCheck={false}
            />
            <div className={s.inputFoot}>
              <span className={s.hint}>
                {payload.trim().length < 20
                  ? 'Paste at least a few lines to map.'
                  : `${payload.trim().length.toLocaleString()} characters ready`}
              </span>
              <button
                type="button"
                className={s.mapBtn}
                disabled={payload.trim().length < 20}
                onClick={mapBottleneck}
              >
                Map the Bottleneck →
              </button>
            </div>
          </div>
        </div>
      )}

      {stage === 'loading' && (
        <div className={s.loadStage}>
          <div className={s.loadTag}>mapping the bottleneck</div>
          <div className={s.scan}>
            <div className={s.scanLine} />
          </div>
          <div key={loadingMessage} className={s.loadMsg}>
            {loadingMessage}
          </div>
        </div>
      )}

      {stage === 'error' && (
        <div className={s.errStage}>
          <div className={s.errTag}>capability_map / failed</div>
          <h2 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>We could not map that.</h2>
          <p style={{ color: 'var(--text-2)', fontSize: 14, maxWidth: 440 }}>
            Sometimes the model gets stuck. Try again, or trim the notes and retry.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="button" className={s.mapBtn} onClick={mapBottleneck}>
              Try again
            </button>
            <button type="button" className={s.restartLink} onClick={restart}>
              Edit notes
            </button>
          </div>
          {errorDetail && <div className={s.errDetail}>{errorDetail}</div>}
        </div>
      )}
    </div>
  );
}
