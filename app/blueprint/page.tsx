'use client';

import { useEffect, useState } from 'react';
import type { SalesBlueprint } from '@/lib/agents/sales-blueprint-schema';
import { BlueprintDoc } from './BlueprintDoc';
import s from './blueprint.module.css';

type Stage = 'input' | 'loading' | 'done' | 'error';

const LOADING_MESSAGES: { from: number; text: string }[] = [
  { from: 0, text: 'reading your answers' },
  { from: 8000, text: 'identifying capabilities' },
  { from: 18000, text: 'allocating human, hybrid, agent' },
  { from: 30000, text: 'scoring against what good looks like' },
  { from: 42000, text: 'designing the agent team' },
  { from: 55000, text: 'assembling your blueprint' },
];

type QKey =
  | 'business'
  | 'bottleneck'
  | 'workflow'
  | 'choke'
  | 'info'
  | 'judgement'
  | 'good'
  | 'name'
  | 'email';
type Question = {
  key: QKey;
  label: string;
  sub?: string;
  placeholder: string;
  /** 'contact' renders name + email on one screen; both are lead fields, not mapped. */
  type: 'input' | 'textarea' | 'contact';
  required?: boolean;
};

const QUESTIONS: Question[] = [
  {
    key: 'business',
    label: "What's the business?",
    sub: 'The company this blueprint is for.',
    placeholder: '',
    type: 'input',
    required: true,
  },
  {
    key: 'bottleneck',
    label: 'Name the bottleneck',
    sub: 'Where does work slow down, pile up, or depend on too few people? Short, honest answers beat polished ones.',
    placeholder: 'e.g. Finding prior assessments and site data when senior staff have moved on',
    type: 'input',
    required: true,
  },
  {
    key: 'workflow',
    label: 'Walk us through the workflow',
    sub: 'What kicks it off, the main steps, who touches it, the finished output.',
    placeholder: 'What kicks it off, the main steps, who touches it, the finished output.',
    type: 'textarea',
  },
  {
    key: 'choke',
    label: 'Where exactly does it choke, and what does that cost?',
    sub: 'Time lost, rework, missed deadlines, reliance on one or two people.',
    placeholder: 'Time lost, rework, missed deadlines, reliance on one or two people.',
    type: 'textarea',
  },
  {
    key: 'info',
    label: 'What information does it depend on, and where does that live?',
    sub: "Systems, drives, archives, people's heads. Flag anything culturally sensitive or confidential.",
    placeholder: "Systems, drives, archives, people's heads.",
    type: 'textarea',
  },
  {
    key: 'judgement',
    label: 'What judgement calls happen inside it, and who makes them?',
    sub: 'The decisions that must stay with your experts, whatever else changes.',
    placeholder: 'The decisions that must stay with your experts.',
    type: 'textarea',
  },
  {
    key: 'good',
    label: 'What would good look like?',
    sub: 'If this bottleneck disappeared, what would you actually see?',
    placeholder: 'If this bottleneck disappeared, what would you actually see?',
    type: 'textarea',
  },
  {
    key: 'email',
    label: 'Where should we send your blueprint?',
    sub: 'We will not share it. Your blueprint appears on the next screen.',
    placeholder: '',
    type: 'contact',
    required: true,
  },
];

const EMPTY: Record<QKey, string> = {
  business: '',
  bottleneck: '',
  workflow: '',
  choke: '',
  info: '',
  judgement: '',
  good: '',
  name: '',
  email: '',
};

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function assemblePayload(a: Record<QKey, string>): string {
  const val = (v: string) => (v.trim() ? v.trim() : 'Not enough information');
  const session = (() => {
    try {
      return new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return '';
    }
  })();
  return [
    'CAPABILITY MAPPING INPUT',
    `Client: ${a.business.trim() || 'Not enough information'}`,
    session ? `Session: Polynize working session, ${session}` : '',
    '',
    'BOTTLENECK',
    val(a.bottleneck),
    '',
    'WORKFLOW WALKTHROUGH',
    val(a.workflow),
    '',
    'CHOKE POINT AND COST',
    val(a.choke),
    '',
    'INFORMATION SOURCES AND WHERE THEY LIVE',
    val(a.info),
    '',
    'JUDGEMENT CALLS AND WHO MAKES THEM',
    val(a.judgement),
    '',
    'WHAT GOOD LOOKS LIKE',
    val(a.good),
  ]
    .filter((l) => l !== undefined)
    .join('\n');
}

export default function BlueprintPage() {
  const [stage, setStage] = useState<Stage>('input');
  const [mode, setMode] = useState<'form' | 'paste'>('form');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<QKey, string>>(EMPTY);
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

  async function generate(rawPayload: string) {
    setStage('loading');
    setErrorDetail(null);
    try {
      const res = await fetch('/api/blueprint-map/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: rawPayload }),
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

  function retry() {
    // Regenerate from whatever the user last submitted (form or paste).
    void generate(mode === 'paste' ? payload : assemblePayload(answers));
  }

  function restart() {
    setData(null);
    setStep(0);
    setStage('input');
  }

  if (stage === 'done' && data) {
    return (
      <div className={s.wrap}>
        <BlueprintDoc
          initialData={data}
          lead={{
            name: answers.name.trim(),
            email: answers.email.trim(),
            business: answers.business.trim(),
          }}
          onRestart={restart}
        />
      </div>
    );
  }

  if (stage === 'loading') {
    return (
      <div className={s.wrap}>
        <div className={s.loadStage}>
          <div className={s.loadTag}>mapping the bottleneck</div>
          <div className={s.scan}>
            <div className={s.scanLine} />
          </div>
          <div key={loadingMessage} className={s.loadMsg}>
            {loadingMessage}
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'error') {
    return (
      <div className={s.wrap}>
        <div className={s.errStage}>
          <div className={s.errTag}>capability_map / failed</div>
          <h2 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>We could not map that.</h2>
          <p style={{ color: 'var(--text-2)', fontSize: 14, maxWidth: 440 }}>
            Sometimes the model gets stuck. Try again, or edit your answers and retry.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="button" className={s.mapBtn} onClick={retry}>
              Try again
            </button>
            <button type="button" className={s.restartLink} onClick={() => setStage('input')}>
              Edit answers
            </button>
          </div>
          {errorDetail && <div className={s.errDetail}>{errorDetail}</div>}
        </div>
      </div>
    );
  }

  // ---- input stage ----
  if (mode === 'paste') {
    return (
      <div className={s.wrap}>
        <div className={s.inputStage}>
          <div className={s.inputCard}>
            <div className={s.eyebrow}>Polynize · capability mapping</div>
            <h1 className={s.inputTitle}>Paste your notes.</h1>
            <p className={s.inputSub}>
              Already have the detail written down? Drop it in and map it straight through.
            </p>
            <textarea
              className={s.textarea}
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              placeholder=""
              spellCheck={false}
            />
            <div className={s.inputFoot}>
              <button type="button" className={s.pasteToggle} onClick={() => setMode('form')}>
                ← use the guided questions
              </button>
              <button
                type="button"
                className={s.mapBtn}
                disabled={payload.trim().length < 20}
                onClick={() => generate(payload)}
              >
                Map the Bottleneck →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const q = QUESTIONS[step];
  const isLast = step === QUESTIONS.length - 1;
  const value = answers[q.key];
  const canAdvance =
    q.type === 'contact'
      ? answers.name.trim().length > 0 && isEmail(answers.email)
      : !q.required || value.trim().length > 0;

  function setValue(v: string) {
    setAnswers((prev) => ({ ...prev, [q.key]: v }));
  }
  function setField(key: QKey, v: string) {
    setAnswers((prev) => ({ ...prev, [key]: v }));
  }
  function next() {
    if (!canAdvance) return;
    if (isLast) void generate(assemblePayload(answers));
    else setStep((n) => n + 1);
  }

  return (
    <div className={s.wrap}>
      <div className={s.inputStage}>
        <div className={s.inputCard}>
          <div className={s.qTop}>
            <div className={s.eyebrow}>Polynize · capability mapping</div>
            <div className={s.qCount}>
              {step + 1} / {QUESTIONS.length}
            </div>
          </div>
          <div className={s.qProgress} aria-hidden="true">
            <div className={s.qProgressFill} style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }} />
          </div>

          <h1 className={s.qTitle}>{q.label}</h1>
          {q.sub && <p className={s.inputSub}>{q.sub}</p>}

          {q.type === 'contact' ? (
            <div className={s.qContact}>
              <input
                className={s.qInput}
                value={answers.name}
                autoFocus
                placeholder="Your name"
                aria-label="Your name"
                onChange={(e) => setField('name', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    next();
                  }
                }}
              />
              <input
                className={s.qInput}
                type="email"
                value={answers.email}
                placeholder="Your email"
                aria-label="Your email"
                onChange={(e) => setField('email', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    next();
                  }
                }}
              />
            </div>
          ) : q.type === 'input' ? (
            <input
              className={s.qInput}
              value={value}
              autoFocus
              placeholder=""
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  next();
                }
              }}
            />
          ) : (
            <textarea
              className={s.textarea}
              value={value}
              autoFocus
              placeholder=""
              spellCheck={false}
              onChange={(e) => setValue(e.target.value)}
            />
          )}

          <div className={s.qNav}>
            <div className={s.qNavLeft}>
              {step > 0 && (
                <button type="button" className={s.qBack} onClick={() => setStep((n) => n - 1)}>
                  ← back
                </button>
              )}
              {step === 0 && (
                <button type="button" className={s.pasteToggle} onClick={() => setMode('paste')}>
                  paste raw notes instead
                </button>
              )}
            </div>
            <button type="button" className={s.mapBtn} disabled={!canAdvance} onClick={next}>
              {isLast ? 'Generate →' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
